import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import {
  parseAttendanceBulkInput,
  parseAttendanceCorrectionInput,
  parseLimit,
  str,
} from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";
import { syncAttendanceRecordsToSheet } from "@/lib/sheetsSync";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/attendance
 * Query: sessionId, playerId, batchId, from, to, limit, cursor
 * Coaches are scoped to their assigned batches/sessions.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "attendance", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const sessionId = sp.get("sessionId");
    const playerId = sp.get("playerId");
    const batchId = sp.get("batchId");
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    // Coach scoping filter
    const coachFilter: Prisma.AcademyAttendanceWhereInput = ctx.role === "COACH"
      ? {
          session: {
            OR: [
              { coachUserId: ctx.userId },
              { batch: { coachUserId: ctx.userId } },
            ],
          },
        }
      : {};

    const where: Prisma.AcademyAttendanceWhereInput = {
      tenantId: ctx.tenantId,
      ...(sessionId ? { sessionId } : {}),
      ...(playerId ? { playerId } : {}),
      ...(batchId ? { batchId } : {}),
      ...(fromStr || toStr
        ? {
            session: {
              date: {
                ...(fromStr ? { gte: new Date(`${fromStr}T00:00:00.000Z`) } : {}),
                ...(toStr ? { lte: new Date(`${toStr}T00:00:00.000Z`) } : {}),
              },
            },
          }
        : {}),
      ...coachFilter,
    };

    const rows = await prisma.academyAttendance.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        player: { select: { id: true, playerCode: true, name: true, photoKey: true } },
        session: { select: { id: true, date: true, startTime: true, endTime: true, status: true } },
        corrections: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((a) => ({
          id: a.id,
          sessionId: a.sessionId,
          sessionDate: a.session.date.toISOString().slice(0, 10),
          sessionTime: `${a.session.startTime} - ${a.session.endTime}`,
          player: a.player,
          status: a.status,
          markedBy: a.markedBy,
          opId: a.opId,
          correctionReason: a.correctionReason,
          corrections: a.corrections.map((c) => ({
            id: c.id,
            oldStatus: c.oldStatus,
            newStatus: c.newStatus,
            reason: c.reason,
            correctedBy: c.correctedBy,
            createdAt: c.createdAt.toISOString(),
          })),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/attendance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load attendance");
  }
}

/**
 * POST /api/academy/attendance
 * Bulk attendance marking. Requires attendance:create.
 * Fully idempotent with opId for offline mobile queue support.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "attendance", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseAttendanceBulkInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const { sessionId, records, opId } = parsed.value;

    // 1. Idempotency check: if opId already processed for this tenant, return cached result
    if (opId) {
      const existingWithOp = await prisma.academyAttendance.findMany({
        where: { tenantId: ctx.tenantId, opId },
        select: { id: true, playerId: true, status: true },
      });
      if (existingWithOp.length > 0) {
        return NextResponse.json({
          ok: true,
          idempotent: true,
          message: "Attendance was previously recorded for this operation",
          savedCount: existingWithOp.length,
          data: existingWithOp,
        });
      }
    }

    // 2. Validate session exists under this tenant
    const session = await prisma.academySession.findFirst({
      where: { id: sessionId, tenantId: ctx.tenantId },
      include: { batch: { select: { id: true, name: true, coachUserId: true } } },
    });
    if (!session) {
      return academyError(404, "NOT_FOUND", "Session not found");
    }

    // Coach guard: coach can only submit attendance for their assigned batch/session
    if (ctx.role === "COACH") {
      const isAssigned = session.coachUserId === ctx.userId || session.batch.coachUserId === ctx.userId;
      if (!isAssigned) {
        return academyError(403, "FORBIDDEN", "You can only mark attendance for your assigned batches");
      }
    }

    // 3. Verify all player IDs belong to this tenant
    const playerIds = records.map((r) => r.playerId);
    const foundPlayers = await prisma.academyPlayer.findMany({
      where: { id: { in: playerIds }, tenantId: ctx.tenantId, archivedAt: null },
      select: { id: true },
    });
    if (foundPlayers.length !== playerIds.length) {
      return academyError(400, "VALIDATION_ERROR", "One or more player IDs are invalid or archived");
    }

    const operationId = request.headers.get("x-operation-id") || opId;

    // 4. Atomic transaction: upsert attendance records + advance session status to HELD
    const saved = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const r of records) {
        const item = await tx.academyAttendance.upsert({
          where: {
            sessionId_playerId: {
              sessionId: session.id,
              playerId: r.playerId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            sessionId: session.id,
            playerId: r.playerId,
            sportId: session.sportId,
            batchId: session.batchId,
            status: r.status,
            markedBy: ctx.userId,
            opId: opId ?? null,
          },
          update: {
            status: r.status,
            markedBy: ctx.userId,
            opId: opId ?? null,
          },
        });
        results.push(item);
      }

      // If session is still SCHEDULED, mark as HELD
      if (session.status === "SCHEDULED") {
        await tx.academySession.update({
          where: { id: session.id },
          data: { status: "HELD" },
        });
      }

      // Record audit event
      const summaryStats = records.reduce<Record<string, number>>((acc, cur) => {
        acc[cur.status] = (acc[cur.status] || 0) + 1;
        return acc;
      }, {});

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "attendance.marked",
        entityType: "academy_session",
        entityId: session.id,
        summary: `Marked attendance for ${records.length} players in ${session.batch.name} (${session.date.toISOString().slice(0, 10)})`,
        after: { sessionId: session.id, stats: summaryStats },
        operationId,
      });

      return results;
    }, { timeout: 30000, maxWait: 20000 });

    // Non-blocking fire-and-forget sync to Google Sheet (Attendance tab)
    syncAttendanceRecordsToSheet(saved, ctx.tenantId, {
      sessionName: session.batch.name,
      date: session.date.toISOString().slice(0, 10),
      markedBy: "Coach",
    }).catch((err) => console.error("[sheets-sync] Failed to sync attendance:", err));

    return NextResponse.json({
      ok: true,
      message: `Successfully marked attendance for ${saved.length} players`,
      savedCount: saved.length,
      data: saved.map((s) => ({ id: s.id, playerId: s.playerId, status: s.status })),
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/attendance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to mark attendance");
  }
}

/**
 * PATCH /api/academy/attendance
 * Correct an attendance record with reason. Requires attendance:edit.
 * Enforces 7-day correction policy for coaches.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "attendance", "edit");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseAttendanceCorrectionInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const { attendanceId, newStatus, reason } = parsed.value;

    const existing = await prisma.academyAttendance.findFirst({
      where: { id: attendanceId, tenantId: ctx.tenantId },
      include: {
        player: { select: { id: true, name: true, playerCode: true } },
        session: { select: { id: true, date: true, coachUserId: true, batch: { select: { coachUserId: true } } } },
      },
    });
    if (!existing) {
      return academyError(404, "NOT_FOUND", "Attendance record not found");
    }

    // 7-day policy: coaches cannot modify attendance records older than 7 days
    const daysSince = (Date.now() - existing.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ctx.role === "COACH" && daysSince > 7) {
      return academyError(403, "POLICY_VIOLATION", "Attendance records older than 7 days can only be modified by a manager or owner");
    }

    // If coach, verify assignment
    if (ctx.role === "COACH") {
      const isAssigned = existing.session.coachUserId === ctx.userId || existing.session.batch.coachUserId === ctx.userId;
      if (!isAssigned) {
        return academyError(403, "FORBIDDEN", "You can only correct attendance for your own sessions");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.academyAttendance.update({
        where: { id: existing.id },
        data: {
          status: newStatus,
          correctionReason: reason,
        },
      });

      await tx.academyAttendanceCorrection.create({
        data: {
          attendanceId: existing.id,
          oldStatus: existing.status,
          newStatus,
          reason,
          correctedBy: ctx.userId,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "attendance.corrected",
        entityType: "academy_attendance",
        entityId: existing.id,
        summary: `Corrected attendance for ${existing.player.name} (${existing.player.playerCode}): ${existing.status} -> ${newStatus}`,
        before: { status: existing.status },
        after: { status: newStatus, reason },
        reason,
        operationId: request.headers.get("x-operation-id"),
      });

      return a;
    });

    return NextResponse.json({
      ok: true,
      message: "Attendance status corrected",
      data: {
        id: updated.id,
        oldStatus: existing.status,
        newStatus: updated.status,
        reason,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/academy/attendance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to correct attendance");
  }
}
