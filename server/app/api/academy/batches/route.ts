import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseBatchInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/batches
 * Query: sportId, active, coachUserId, limit, cursor
 * Coaches only see their assigned batches.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "batches", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const sportId = sp.get("sportId");
    const active = sp.get("active");
    const coachUserId = sp.get("coachUserId");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyBatchWhereInput = {
      tenantId: ctx.tenantId,
      ...(active !== null ? { active: active === "1" || active === "true" } : {}),
      ...(sportId ? { sportId } : {}),
      // Coach scoping: coaches only see batches they are assigned to
      ...(ctx.role === "COACH"
        ? { coachUserId: ctx.userId }
        : coachUserId
        ? { coachUserId }
        : {}),
    };

    const rows = await prisma.academyBatch.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sport: { select: { id: true, name: true } },
        _count: { select: { enrollments: true, sessions: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((b) => ({
          id: b.id,
          name: b.name,
          sport: b.sport,
          coachUserId: b.coachUserId,
          days: b.days,
          startTime: b.startTime,
          endTime: b.endTime,
          capacity: b.capacity,
          active: b.active,
          enrolledCount: b._count.enrollments,
          sessionsCount: b._count.sessions,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/batches]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load batches");
  }
}

/**
 * POST /api/academy/batches
 * Requires batches:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "batches", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseBatchInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    // Verify sport exists and is active
    const sport = await prisma.academySport.findFirst({
      where: { id: v.sportId, tenantId: ctx.tenantId, active: true },
      select: { id: true, name: true },
    });
    if (!sport) {
      return academyError(400, "VALIDATION_ERROR", "Selected sport does not exist or is inactive");
    }

    // Verify coach belongs to tenant if provided
    if (v.coachUserId) {
      const coach = await prisma.academyMembership.findFirst({
        where: { tenantId: ctx.tenantId, userId: v.coachUserId, active: true },
      });
      if (!coach) {
        return academyError(400, "VALIDATION_ERROR", "Assigned coach is not an active academy member");
      }
    }

    // Duplicate name check under tenant + sport
    const duplicate = await prisma.academyBatch.findUnique({
      where: {
        tenantId_sportId_name: {
          tenantId: ctx.tenantId,
          sportId: v.sportId,
          name: v.name,
        },
      },
    });
    if (duplicate) {
      return academyError(409, "DUPLICATE_BATCH", `A batch named '${v.name}' already exists for ${sport.name}`);
    }

    const operationId = request.headers.get("x-operation-id");

    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.academyBatch.create({
        data: {
          tenantId: ctx.tenantId,
          sportId: v.sportId,
          name: v.name,
          coachUserId: v.coachUserId,
          days: v.days,
          startTime: v.startTime,
          endTime: v.endTime,
          capacity: v.capacity,
          facilityId: v.facilityId,
          active: v.active,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "batch.created",
        entityType: "academy_batch",
        entityId: b.id,
        summary: `Created batch '${b.name}' for ${sport.name}`,
        after: { name: v.name, sportId: v.sportId, days: v.days, startTime: v.startTime, endTime: v.endTime },
        operationId,
      });

      return b;
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: batch.id,
          name: batch.name,
          sportId: batch.sportId,
          days: batch.days,
          startTime: batch.startTime,
          endTime: batch.endTime,
          capacity: batch.capacity,
          active: batch.active,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/academy/batches]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create batch");
  }
}
