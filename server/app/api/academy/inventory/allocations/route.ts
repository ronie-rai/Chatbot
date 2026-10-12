import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseItemAllocationInput, parseLimit, ITEM_EVENT_TYPES, ItemEventType } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/inventory/allocations
 * Query: playerId, itemTypeId, eventType, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "jerseys", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const playerId = sp.get("playerId");
    const itemTypeId = sp.get("itemTypeId");
    const eventTypeRaw = sp.get("eventType");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    let eventType: ItemEventType | undefined;
    if (eventTypeRaw) {
      const up = eventTypeRaw.toUpperCase();
      if ((ITEM_EVENT_TYPES as readonly string[]).includes(up)) {
        eventType = up as ItemEventType;
      }
    }

    const where: Prisma.AcademyItemAllocationWhereInput = {
      tenantId: ctx.tenantId,
      ...(playerId ? { playerId } : {}),
      ...(itemTypeId ? { itemTypeId } : {}),
      ...(eventType ? { eventType } : {}),
    };

    const rows = await prisma.academyItemAllocation.findMany({
      where,
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        itemType: { select: { id: true, name: true, category: true } },
        player: { select: { id: true, name: true, playerCode: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((a) => ({
          id: a.id,
          itemType: a.itemType,
          player: a.player,
          eventType: a.eventType,
          quantity: a.quantity,
          size: a.size,
          number: a.number,
          notes: a.notes,
          recordedAt: a.recordedAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/inventory/allocations]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load item allocations");
  }
}

/**
 * POST /api/academy/inventory/allocations
 * Issues or returns an item for a player. Requires jerseys:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "jerseys", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseItemAllocationInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const itemType = await prisma.academyItemType.findFirst({
      where: { id: v.itemTypeId, tenantId: ctx.tenantId, active: true },
      select: { id: true, name: true, category: true },
    });
    if (!itemType) {
      return academyError(404, "NOT_FOUND", "Item type not found or is inactive");
    }

    const player = await prisma.academyPlayer.findFirst({
      where: { id: v.playerId, tenantId: ctx.tenantId },
      select: { id: true, name: true, playerCode: true },
    });
    if (!player) {
      return academyError(404, "NOT_FOUND", "Player not found");
    }

    const allocation = await prisma.$transaction(async (tx) => {
      const created = await tx.academyItemAllocation.create({
        data: {
          tenantId: ctx.tenantId,
          itemTypeId: v.itemTypeId,
          playerId: v.playerId,
          eventType: v.eventType,
          quantity: v.quantity,
          size: v.size,
          number: v.number,
          notes: v.notes,
          recordedBy: ctx.userId,
        },
        include: {
          itemType: { select: { id: true, name: true, category: true } },
          player: { select: { id: true, name: true, playerCode: true } },
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: `inventory.${v.eventType.toLowerCase()}`,
        entityType: "academy_item_allocation",
        entityId: created.id,
        summary: `${v.eventType} ${v.quantity}x '${itemType.name}' for ${player.name} (${player.playerCode})${v.number ? ` #${v.number}` : ""}${v.size ? ` size ${v.size}` : ""}`,
        after: {
          itemTypeId: v.itemTypeId,
          playerId: v.playerId,
          eventType: v.eventType,
          quantity: v.quantity,
          size: v.size,
          number: v.number,
        },
        operationId: request.headers.get("x-operation-id"),
      });

      return created;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: allocation.id,
        itemType: allocation.itemType,
        player: allocation.player,
        eventType: allocation.eventType,
        quantity: allocation.quantity,
        size: allocation.size,
        number: allocation.number,
        recordedAt: allocation.recordedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/inventory/allocations]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to allocate item");
  }
}
