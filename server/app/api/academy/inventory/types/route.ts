import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseItemTypeInput, parseLimit, ITEM_CATEGORIES, ItemCategory } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/inventory/types
 * Query: category, active, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "jerseys", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const categoryRaw = sp.get("category");
    const active = sp.get("active");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    let category: ItemCategory | undefined;
    if (categoryRaw) {
      const up = categoryRaw.toUpperCase();
      if ((ITEM_CATEGORIES as readonly string[]).includes(up)) {
        category = up as ItemCategory;
      }
    }

    const where: Prisma.AcademyItemTypeWhereInput = {
      tenantId: ctx.tenantId,
      ...(category ? { category } : {}),
      ...(active !== null ? { active: active === "1" || active === "true" } : {}),
    };

    const rows = await prisma.academyItemType.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        _count: { select: { allocations: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          description: i.description,
          active: i.active,
          allocationsCount: i._count.allocations,
          createdAt: i.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/inventory/types]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load item types");
  }
}

/**
 * POST /api/academy/inventory/types
 * Creates an item type. Requires jerseys:create.
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

    const parsed = parseItemTypeInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const existing = await prisma.academyItemType.findFirst({
      where: { tenantId: ctx.tenantId, name: { equals: v.name, mode: "insensitive" } },
    });
    if (existing) {
      return academyError(409, "DUPLICATE_NAME", `An item type named '${v.name}' already exists`);
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.academyItemType.create({
        data: {
          tenantId: ctx.tenantId,
          name: v.name,
          category: v.category,
          description: v.description,
          active: v.active,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "item_type.created",
        entityType: "academy_item_type",
        entityId: created.id,
        summary: `Created item type '${v.name}' in category ${v.category}`,
        after: { name: v.name, category: v.category },
        operationId: request.headers.get("x-operation-id"),
      });

      return created;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        active: item.active,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/inventory/types]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create item type");
  }
}
