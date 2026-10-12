import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parsePlayerFeeAssignmentInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/finance/assignments
 * Query: playerId, sportId, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "fees", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const playerId = sp.get("playerId");
    const sportId = sp.get("sportId");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyPlayerFeeAssignmentWhereInput = {
      tenantId: ctx.tenantId,
      ...(playerId ? { playerId } : {}),
      ...(sportId ? { sportId } : {}),
    };

    const rows = await prisma.academyPlayerFeeAssignment.findMany({
      where,
      orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        player: { select: { id: true, name: true, playerCode: true } },
        feePlan: { select: { id: true, name: true, billingMethod: true, baseAmount: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((a) => ({
          id: a.id,
          player: a.player,
          feePlan: {
            id: a.feePlan.id,
            name: a.feePlan.name,
            billingMethod: a.feePlan.billingMethod,
            baseAmount: Number(a.feePlan.baseAmount),
          },
          effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: a.effectiveTo ? a.effectiveTo.toISOString().slice(0, 10) : null,
          discountAmount: Number(a.discountAmount),
          discountReason: a.discountReason,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/finance/assignments]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load fee assignments");
  }
}

/**
 * POST /api/academy/finance/assignments
 * Assigns fee plan to a player. Requires fees:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "fees", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parsePlayerFeeAssignmentInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const player = await prisma.academyPlayer.findFirst({
      where: { id: v.playerId, tenantId: ctx.tenantId, archivedAt: null },
      select: { id: true, name: true, playerCode: true },
    });
    if (!player) return academyError(404, "NOT_FOUND", "Player not found");

    const feePlan = await prisma.academyFeePlan.findFirst({
      where: { id: v.feePlanId, tenantId: ctx.tenantId, active: true },
      select: { id: true, name: true, sportId: true, baseAmount: true },
    });
    if (!feePlan) return academyError(404, "NOT_FOUND", "Fee plan not found or is inactive");

    const effectiveFromDate = new Date(`${v.effectiveFrom}T00:00:00.000Z`);
    const effectiveToDate = v.effectiveTo ? new Date(`${v.effectiveTo}T00:00:00.000Z`) : null;

    const assignment = await prisma.$transaction(async (tx) => {
      const a = await tx.academyPlayerFeeAssignment.create({
        data: {
          tenantId: ctx.tenantId,
          playerId: v.playerId,
          feePlanId: v.feePlanId,
          sportId: feePlan.sportId,
          effectiveFrom: effectiveFromDate,
          effectiveTo: effectiveToDate,
          discountAmount: new Prisma.Decimal(v.discountAmount),
          discountReason: v.discountReason,
          createdBy: ctx.userId,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "fee_assignment.created",
        entityType: "academy_player_fee_assignment",
        entityId: a.id,
        summary: `Assigned '${feePlan.name}' to ${player.name} (${player.playerCode}) from ${v.effectiveFrom}`,
        after: { playerId: v.playerId, feePlanId: v.feePlanId, discountAmount: v.discountAmount },
        operationId: request.headers.get("x-operation-id"),
      });

      return a;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: assignment.id,
        playerId: assignment.playerId,
        feePlanId: assignment.feePlanId,
        effectiveFrom: assignment.effectiveFrom.toISOString().slice(0, 10),
        discountAmount: Number(assignment.discountAmount),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/finance/assignments]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to assign fee plan");
  }
}
