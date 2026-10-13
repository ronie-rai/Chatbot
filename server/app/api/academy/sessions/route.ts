import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseDateOnly, parseLimit, parseTime, str, SESSION_STATUSES } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/sessions
 * Query: batchId, sportId, date, from, to, status, limit, cursor
 * Coaches only see sessions for their assigned batches.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "attendance", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const batchId = sp.get("batchId");
    const sportId = sp.get("sportId");
    const dateStr = sp.get("date");
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const status = sp.get("status");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    if (status && !(SESSION_STATUSES as readonly string[]).includes(status)) {
      return academyError(400, "VALIDATION_ERROR", `Invalid session status '${status}'`);
    }

    const where: Prisma.AcademySessionWhereInput = {
      tenantId: ctx.tenantId,
      ...(batchId ? { batchId } : {}),
      ...(sportId ? { sportId } : {}),
      ...(status ? { status } : {}),
      ...(dateStr
        ? { date: new Date(`${dateStr}T00:00:00.000Z`) }
        : fromStr || toStr
        ? {
            date: {
              ...(fromStr ? { gte: new Date(`${fromStr}T00:00:00.000Z`) } : {}),
              ...(toStr ? { lte: new Date(`${toStr}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      // Coach scoping: coaches only see sessions of their batches or where they are assigned coach
      ...(ctx.role === "COACH"
        ? {
            OR: [
              { coachUserId: ctx.userId },
              { batch: { coachUserId: ctx.userId } },
            ],
          }
        : {}),
    };

    const rows = await prisma.academySession.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        batch: { select: { id: true, name: true, coachUserId: true } },
        attendance: { select: { id: true, status: true, playerId: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((s) => {
          const attendanceSummary = s.attendance.reduce<Record<string, number>>((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
          }, {});

          return {
            id: s.id,
            batchId: s.batchId,
            batchName: s.batch.name,
            sportId: s.sportId,
            coachUserId: s.coachUserId ?? s.batch.coachUserId,
            date: s.date.toISOString().slice(0, 10),
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
            attendanceCount: s.attendance.length,
            attendanceSummary,
          };
        }),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/sessions]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load sessions");
  }
}

/**
 * POST /api/academy/sessions
 * Generates sessions for a batch. Requires batches:create or batches:edit.
 * Supports:
 * 1. Single session: { batchId, date, startTime?, endTime? }
 * 2. Range generation: { batchId, fromDate, toDate }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "batches", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const batchIdParsed = str(body?.batchId, "Batch ID", 100, true);
    if (!batchIdParsed.ok) return academyError(400, "VALIDATION_ERROR", batchIdParsed.message);
    const batchId = batchIdParsed.value!;

    const batch = await prisma.academyBatch.findFirst({
      where: { id: batchId, tenantId: ctx.tenantId },
    });
    if (!batch) return academyError(404, "NOT_FOUND", "Batch not found");

    const operationId = request.headers.get("x-operation-id");

    // Mode 1: Single ad-hoc session
    if (body.date) {
      const dateParsed = parseDateOnly(body.date, "Session date");
      if (!dateParsed.ok) return academyError(400, "VALIDATION_ERROR", dateParsed.message);
      const sessionDate = new Date(`${dateParsed.value}T00:00:00.000Z`);

      const startTime = body.startTime
        ? parseTime(body.startTime, "Start time", true)
        : ({ ok: true, value: batch.startTime } as const);
      const endTime = body.endTime
        ? parseTime(body.endTime, "End time", true)
        : ({ ok: true, value: batch.endTime } as const);
      if (!startTime.ok) return academyError(400, "VALIDATION_ERROR", startTime.message);
      if (!endTime.ok) return academyError(400, "VALIDATION_ERROR", endTime.message);

      const existing = await prisma.academySession.findUnique({
        where: {
          batchId_date_startTime: {
            batchId,
            date: sessionDate,
            startTime: startTime.value as string,
          },
        },
      });
      if (existing) {
        return academyError(409, "DUPLICATE_SESSION", "Session already exists for this batch at this date/time");
      }

      const session = await prisma.$transaction(async (tx) => {
        const s = await tx.academySession.create({
          data: {
            tenantId: ctx.tenantId,
            batchId: batch.id,
            sportId: batch.sportId,
            coachUserId: batch.coachUserId,
            date: sessionDate,
            startTime: startTime.value as string,
            endTime: endTime.value as string,
            status: "SCHEDULED",
          },
        });

        await recordAudit(tx, {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          action: "session.created",
          entityType: "academy_session",
          entityId: s.id,
          summary: `Created session on ${dateParsed.value} for batch ${batch.name}`,
          after: { batchId: batch.id, date: dateParsed.value, startTime: startTime.value },
          operationId,
        });

        return s;
      });

      return NextResponse.json({
        ok: true,
        data: {
          id: session.id,
          batchId: session.batchId,
          date: session.date.toISOString().slice(0, 10),
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
        },
      }, { status: 201 });
    }

    // Mode 2: Generate sessions over date range
    if (!body?.fromDate && !body?.toDate) {
      return academyError(
        400,
        "VALIDATION_ERROR",
        "Either session 'date' (for single session) or 'fromDate' and 'toDate' range is required"
      );
    }
    const fromParsed = parseDateOnly(body.fromDate, "fromDate");
    const toParsed = parseDateOnly(body.toDate, "toDate");
    if (!fromParsed.ok) return academyError(400, "VALIDATION_ERROR", fromParsed.message);
    if (!toParsed.ok) return academyError(400, "VALIDATION_ERROR", toParsed.message);

    const fromDate = new Date(`${fromParsed.value}T00:00:00.000Z`);
    const toDate = new Date(`${toParsed.value}T00:00:00.000Z`);
    if (toDate < fromDate) {
      return academyError(400, "VALIDATION_ERROR", "toDate must be on or after fromDate");
    }

    // Maximum 90 days generation at once
    const daysDiff = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return academyError(400, "VALIDATION_ERROR", "Cannot generate sessions for more than 90 days at a time");
    }

    const scheduledDates: Date[] = [];
    const cur = new Date(fromDate);
    const batchDaysSet = new Set(batch.days);

    while (cur <= toDate) {
      // 0 = Sunday, 1 = Monday, etc.
      const dayOfWeek = cur.getUTCDay();
      if (batchDaysSet.has(dayOfWeek)) {
        scheduledDates.push(new Date(cur));
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    if (scheduledDates.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No training days match the specified date range",
        createdCount: 0,
      });
    }

    // Query existing to skip
    const existingSessions = await prisma.academySession.findMany({
      where: {
        batchId: batch.id,
        date: { in: scheduledDates },
        startTime: batch.startTime,
      },
      select: { date: true },
    });
    const existingDateStrs = new Set(existingSessions.map((s) => s.date.toISOString().slice(0, 10)));

    const toCreate = scheduledDates.filter(
      (d) => !existingDateStrs.has(d.toISOString().slice(0, 10))
    );

    if (toCreate.length > 0) {
      await prisma.academySession.createMany({
        data: toCreate.map((d) => ({
          tenantId: ctx.tenantId,
          batchId: batch.id,
          sportId: batch.sportId,
          coachUserId: batch.coachUserId,
          date: d,
          startTime: batch.startTime,
          endTime: batch.endTime,
          status: "SCHEDULED",
        })),
        skipDuplicates: true,
      });

      await recordAudit(prisma, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "session.generated",
        entityType: "academy_session",
        summary: `Generated ${toCreate.length} sessions for batch ${batch.name} (${fromParsed.value} to ${toParsed.value})`,
        after: { batchId: batch.id, createdCount: toCreate.length },
        operationId,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Generated ${toCreate.length} sessions`,
      createdCount: toCreate.length,
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/sessions]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to generate sessions");
  }
}
