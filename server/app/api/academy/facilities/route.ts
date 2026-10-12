import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseFacilityInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/facilities
 * Query: active, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "facilities", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const active = sp.get("active");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyFacilityWhereInput = {
      tenantId: ctx.tenantId,
      ...(active !== null ? { active: active === "1" || active === "true" } : {}),
    };

    const rows = await prisma.academyFacility.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        _count: {
          select: {
            bookings: {
              where: {
                startAt: { gte: new Date() },
                status: "CONFIRMED",
              },
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          capacity: f.capacity,
          description: f.description,
          active: f.active,
          upcomingBookingsCount: f._count.bookings,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/facilities]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load facilities");
  }
}

/**
 * POST /api/academy/facilities
 * Requires facilities:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "facilities", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseFacilityInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const existing = await prisma.academyFacility.findUnique({
      where: {
        tenantId_name: {
          tenantId: ctx.tenantId,
          name: v.name,
        },
      },
    });
    if (existing) {
      return academyError(409, "DUPLICATE_FACILITY", `A facility named '${v.name}' already exists`);
    }

    const facility = await prisma.$transaction(async (tx) => {
      const f = await tx.academyFacility.create({
        data: {
          tenantId: ctx.tenantId,
          name: v.name,
          type: v.type,
          capacity: v.capacity,
          description: v.description,
          active: v.active,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "facility.created",
        entityType: "academy_facility",
        entityId: f.id,
        summary: `Created facility '${f.name}' (${v.type || "General"})`,
        after: { name: v.name, type: v.type, capacity: v.capacity },
        operationId: request.headers.get("x-operation-id"),
      });

      return f;
    });

    return NextResponse.json({
      ok: true,
      data: facility,
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/facilities]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create facility");
  }
}
