import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseDateOnly, str } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

/**
 * POST /api/academy/batches/[id]/enroll
 * Enrolls a player into this batch. Requires batches:edit or batches:create.
 */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "batches", "edit");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const playerIdParsed = str(body?.playerId, "Player ID", 100, true);
    if (!playerIdParsed.ok) return academyError(400, "VALIDATION_ERROR", playerIdParsed.message);
    const playerId = playerIdParsed.value!;

    const todayStr = new Date().toISOString().slice(0, 10);
    const startDateParsed = body?.startDate ? parseDateOnly(body.startDate, "Start date") : { ok: true as const, value: todayStr };
    if (!startDateParsed.ok) return academyError(400, "VALIDATION_ERROR", startDateParsed.message);
    const startDate = new Date(`${startDateParsed.value}T00:00:00.000Z`);

    // Verify batch exists under tenant
    const batch = await prisma.academyBatch.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
    });
    if (!batch) return academyError(404, "NOT_FOUND", "Batch not found");
    if (!batch.active) return academyError(400, "INACTIVE_BATCH", "Cannot enroll into an inactive batch");

    // Check capacity limit
    if (batch.capacity) {
      const activeEnrollmentCount = await prisma.academyBatchEnrollment.count({
        where: {
          batchId: batch.id,
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
      });
      if (activeEnrollmentCount >= batch.capacity) {
        return academyError(409, "BATCH_FULL", `Batch has reached maximum capacity of ${batch.capacity} players`);
      }
    }

    // Verify player belongs to tenant
    const player = await prisma.academyPlayer.findFirst({
      where: { id: playerId, tenantId: ctx.tenantId, archivedAt: null },
      select: { id: true, name: true, playerCode: true },
    });
    if (!player) return academyError(404, "NOT_FOUND", "Player not found");

    // Check if already actively enrolled in this batch
    const existing = await prisma.academyBatchEnrollment.findFirst({
      where: {
        batchId: batch.id,
        playerId,
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
    });
    if (existing) {
      return academyError(409, "ALREADY_ENROLLED", "Player is already enrolled in this batch");
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      const e = await tx.academyBatchEnrollment.create({
        data: {
          batchId: batch.id,
          playerId,
          startDate,
        },
      });

      // Ensure player has sport linked
      const hasSport = await tx.academyPlayerSport.findFirst({
        where: { playerId, sportId: batch.sportId },
      });
      if (!hasSport) {
        await tx.academyPlayerSport.create({
          data: { playerId, sportId: batch.sportId },
        });
      }

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "batch.enrolled",
        entityType: "academy_batch_enrollment",
        entityId: e.id,
        summary: `Enrolled ${player.name} (${player.playerCode}) into ${batch.name}`,
        after: { batchId: batch.id, playerId, startDate: startDateParsed.value },
        operationId: request.headers.get("x-operation-id"),
      });

      return e;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: enrollment.id,
        batchId: enrollment.batchId,
        playerId: enrollment.playerId,
        startDate: enrollment.startDate.toISOString().slice(0, 10),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/batches/[id]/enroll]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to enroll player");
  }
}

/**
 * DELETE /api/academy/batches/[id]/enroll
 * Unenrolls a player from this batch.
 * Body or Query: { playerId: string, endDate?: string }
 */
export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "batches", "edit");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    let playerId = sp.get("playerId");
    let endDateStr = sp.get("endDate");

    if (!playerId) {
      try {
        const body = await request.json();
        playerId = body?.playerId;
        endDateStr = body?.endDate;
      } catch {
        // query params only
      }
    }

    if (!playerId) {
      return academyError(400, "VALIDATION_ERROR", "playerId is required");
    }

    const batch = await prisma.academyBatch.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
    });
    if (!batch) return academyError(404, "NOT_FOUND", "Batch not found");

    const enrollment = await prisma.academyBatchEnrollment.findFirst({
      where: {
        batchId: batch.id,
        playerId,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
    });
    if (!enrollment) {
      return academyError(404, "NOT_FOUND", "Active enrollment not found for this player");
    }

    const effectiveEnd = endDateStr
      ? new Date(`${endDateStr}T00:00:00.000Z`)
      : new Date();

    await prisma.$transaction(async (tx) => {
      await tx.academyBatchEnrollment.update({
        where: { id: enrollment.id },
        data: { endDate: effectiveEnd },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "batch.unenrolled",
        entityType: "academy_batch_enrollment",
        entityId: enrollment.id,
        summary: `Ended enrollment for player ${playerId} in ${batch.name}`,
        after: { batchId: batch.id, playerId, endDate: effectiveEnd.toISOString().slice(0, 10) },
        operationId: request.headers.get("x-operation-id"),
      });
    });

    return NextResponse.json({ ok: true, message: "Enrollment ended" });
  } catch (error) {
    console.error("[DELETE /api/academy/batches/[id]/enroll]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to end enrollment");
  }
}
