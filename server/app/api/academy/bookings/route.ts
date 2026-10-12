import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseBookingInput, parseLimit, BOOKING_STATUSES } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/bookings
 * Query: facilityId, status, from, to, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "bookings", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const facilityId = sp.get("facilityId");
    const status = sp.get("status");
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    if (status && !(BOOKING_STATUSES as readonly string[]).includes(status)) {
      return academyError(400, "VALIDATION_ERROR", `Invalid status '${status}'`);
    }

    const where: Prisma.AcademyBookingWhereInput = {
      tenantId: ctx.tenantId,
      ...(facilityId ? { facilityId } : {}),
      ...(status ? { status } : {}),
      ...(fromStr || toStr
        ? {
            startAt: {
              ...(fromStr ? { gte: new Date(fromStr) } : {}),
              ...(toStr ? { lte: new Date(toStr) } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.academyBooking.findMany({
      where,
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        facility: { select: { id: true, name: true, type: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((b) => ({
          id: b.id,
          facility: b.facility,
          requestedBy: b.requestedBy,
          title: b.title,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          status: b.status,
          notes: b.notes,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/bookings]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load bookings");
  }
}

/**
 * POST /api/academy/bookings
 * Reserves a facility slot. Performs real-time conflict checking:
 * Returns 409 Conflict if an overlapping CONFIRMED booking already exists.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "bookings", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseBookingInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const facility = await prisma.academyFacility.findFirst({
      where: { id: v.facilityId, tenantId: ctx.tenantId, active: true },
    });
    if (!facility) {
      return academyError(404, "NOT_FOUND", "Facility not found or is inactive");
    }

    const startAt = new Date(v.startAt);
    const endAt = new Date(v.endAt);

    // Overlap condition: (existing.startAt < new.endAt) AND (existing.endAt > new.startAt)
    const booking = await prisma.$transaction(async (tx) => {
      const conflict = await tx.academyBooking.findFirst({
        where: {
          facilityId: v.facilityId,
          status: "CONFIRMED",
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });

      if (conflict) {
        throw Object.assign(new Error("Time slot overlaps with an existing confirmed booking"), {
          code: "SLOT_CONFLICT",
        });
      }

      const b = await tx.academyBooking.create({
        data: {
          tenantId: ctx.tenantId,
          facilityId: v.facilityId,
          requestedBy: ctx.userId,
          title: v.title,
          startAt,
          endAt,
          status: "CONFIRMED",
          confirmedBy: ctx.userId,
          confirmedAt: new Date(),
          notes: v.notes,
        },
        include: { facility: { select: { id: true, name: true } } },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "booking.created",
        entityType: "academy_booking",
        entityId: b.id,
        summary: `Booked ${facility.name} (${v.startAt} - ${v.endAt})`,
        after: { facilityId: v.facilityId, startAt: v.startAt, endAt: v.endAt },
        operationId: request.headers.get("x-operation-id"),
      });

      return b;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: booking.id,
        facility: booking.facility,
        title: booking.title,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        status: booking.status,
        notes: booking.notes,
      },
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "SLOT_CONFLICT") {
      return academyError(409, "SLOT_UNAVAILABLE", "The facility is already booked for the requested time window");
    }
    console.error("[POST /api/academy/bookings]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to book facility");
  }
}
