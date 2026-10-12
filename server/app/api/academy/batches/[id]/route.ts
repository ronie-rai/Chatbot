import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseTime, str } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

/**
 * GET /api/academy/batches/[id]
 * View batch details, enrolled players, and recent/upcoming sessions.
 */
export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "batches", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const batch = await prisma.academyBatch.findFirst({
      where: {
        id: params.id,
        tenantId: ctx.tenantId,
        ...(ctx.role === "COACH" ? { coachUserId: ctx.userId } : {}),
      },
      include: {
        sport: { select: { id: true, name: true } },
        enrollments: {
          include: {
            player: {
              select: {
                id: true,
                playerCode: true,
                name: true,
                guardianPhone: true,
                status: true,
              },
            },
          },
          orderBy: { startDate: "asc" },
        },
        sessions: {
          orderBy: { date: "desc" },
          take: 10,
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            _count: { select: { attendance: true } },
          },
        },
      },
    });

    if (!batch) {
      return academyError(404, "NOT_FOUND", "Batch not found");
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: batch.id,
        name: batch.name,
        sport: batch.sport,
        coachUserId: batch.coachUserId,
        days: batch.days,
        startTime: batch.startTime,
        endTime: batch.endTime,
        capacity: batch.capacity,
        active: batch.active,
        enrollments: batch.enrollments.map((e) => ({
          id: e.id,
          startDate: e.startDate.toISOString().slice(0, 10),
          endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
          player: e.player,
        })),
        sessions: batch.sessions.map((s) => ({
          id: s.id,
          date: s.date.toISOString().slice(0, 10),
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          attendanceCount: s._count.attendance,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/batches/[id]]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load batch details");
  }
}

/**
 * PATCH /api/academy/batches/[id]
 * Requires batches:edit.
 */
export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "batches", "edit");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const existing = await prisma.academyBatch.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return academyError(404, "NOT_FOUND", "Batch not found");
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const n = str(body.name, "Batch name", 100, true);
      if (!n.ok) return academyError(400, "VALIDATION_ERROR", n.message);
      updates.name = n.value;
    }

    if (body.coachUserId !== undefined) {
      if (body.coachUserId !== null) {
        const coach = await prisma.academyMembership.findFirst({
          where: { tenantId: ctx.tenantId, userId: body.coachUserId, active: true },
        });
        if (!coach) {
          return academyError(400, "VALIDATION_ERROR", "Assigned coach is not an active member");
        }
      }
      updates.coachUserId = body.coachUserId;
    }

    if (body.days !== undefined) {
      if (!Array.isArray(body.days) || body.days.length === 0) {
        return academyError(400, "VALIDATION_ERROR", "Batch must have at least one training day");
      }
      const days = Array.from(new Set(body.days)).sort();
      updates.days = days;
    }

    if (body.startTime !== undefined) {
      const t = parseTime(body.startTime, "Start time", true);
      if (!t.ok) return academyError(400, "VALIDATION_ERROR", t.message);
      updates.startTime = t.value;
    }

    if (body.endTime !== undefined) {
      const t = parseTime(body.endTime, "End time", true);
      if (!t.ok) return academyError(400, "VALIDATION_ERROR", t.message);
      updates.endTime = t.value;
    }

    if (body.capacity !== undefined) {
      updates.capacity = body.capacity ? Number(body.capacity) : null;
    }

    if (body.active !== undefined) {
      updates.active = Boolean(body.active);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.academyBatch.update({
        where: { id: existing.id },
        data: updates,
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "batch.updated",
        entityType: "academy_batch",
        entityId: b.id,
        summary: `Updated batch '${b.name}'`,
        before: existing,
        after: updates,
        operationId: request.headers.get("x-operation-id"),
      });

      return b;
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/academy/batches/[id]]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to update batch");
  }
}
