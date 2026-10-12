import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/academy/notifications/[id]/read
 * Marks a notification as read for the authenticated user.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "notifications", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const notif = await prisma.academyNotification.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId, userId: ctx.userId },
      select: { id: true, status: true },
    });

    if (!notif) {
      return academyError(404, "NOT_FOUND", "Notification not found");
    }

    const updated = await prisma.academyNotification.update({
      where: { id: notif.id },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        status: updated.status,
        readAt: updated.readAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/academy/notifications/[id]/read]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to mark notification as read");
  }
}
