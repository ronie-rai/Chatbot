import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseNotificationInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/notifications
 * Lists notifications for the current authenticated user.
 * Query: status, unreadOnly, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "notifications", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const status = sp.get("status");
    const unreadOnly = sp.get("unreadOnly") === "1" || sp.get("unreadOnly") === "true";
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyNotificationWhereInput = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      ...(status ? { status } : {}),
      ...(unreadOnly ? { status: { not: "READ" } } : {}),
    };

    const rows = await prisma.academyNotification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        deliveries: { select: { channel: true, status: true, attempts: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          payload: n.payload,
          status: n.status,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          deliveries: n.deliveries,
          createdAt: n.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/notifications]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load notifications");
  }
}

/**
 * POST /api/academy/notifications
 * Dispatches a notification to a user. Requires notifications:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "notifications", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseNotificationInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const targetUser = await prisma.user.findFirst({
      where: { id: v.userId, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    if (!targetUser) {
      return academyError(404, "NOT_FOUND", "Target user not found in this tenant");
    }

    if (v.dedupeKey) {
      const existing = await prisma.academyNotification.findFirst({
        where: {
          tenantId: ctx.tenantId,
          type: v.type,
          dedupeKey: v.dedupeKey,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (existing) {
        return NextResponse.json({
          ok: true,
          data: { id: existing.id, deduplicated: true, status: existing.status },
        });
      }
    }

    const notification = await prisma.$transaction(async (tx) => {
      const n = await tx.academyNotification.create({
        data: {
          tenantId: ctx.tenantId,
          userId: v.userId,
          type: v.type,
          title: v.title,
          body: v.body,
          payload: v.payload ? (v.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
          status: "QUEUED",
          dedupeKey: v.dedupeKey,
        },
      });

      // Transactional outbox delivery record (in-app channel)
      await tx.academyNotificationDelivery.create({
        data: {
          notificationId: n.id,
          channel: "IN_APP",
          status: "SENT",
          attempts: 1,
          lastAttemptAt: new Date(),
        },
      });

      return n;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        status: notification.status,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/notifications]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to enqueue notification");
  }
}
