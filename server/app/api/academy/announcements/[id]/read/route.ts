import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/academy/announcements/[id]/read
 * Marks an announcement as read by the authenticated user.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "announcements", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const announcement = await prisma.academyAnnouncement.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
      select: { id: true },
    });

    if (!announcement) {
      return academyError(404, "NOT_FOUND", "Announcement not found");
    }

    const readRecord = await prisma.academyAnnouncementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: announcement.id,
          userId: ctx.userId,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        announcementId: announcement.id,
        userId: ctx.userId,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        announcementId: readRecord.announcementId,
        readAt: readRecord.readAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[POST /api/academy/announcements/[id]/read]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to mark announcement as read");
  }
}
