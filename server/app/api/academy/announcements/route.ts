import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseAnnouncementInput, parseLimit, ANNOUNCEMENT_AUDIENCES, AnnouncementAudience } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/announcements
 * Query: audience, sportId, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "announcements", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const audRaw = sp.get("audience");
    const sportId = sp.get("sportId");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    let audience: AnnouncementAudience | undefined;
    if (audRaw && (ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(audRaw.toUpperCase() as AnnouncementAudience)) {
      audience = audRaw.toUpperCase() as AnnouncementAudience;
    }

    const now = new Date();
    const where: Prisma.AcademyAnnouncementWhereInput = {
      tenantId: ctx.tenantId,
      ...(audience ? { audience } : {}),
      ...(sportId ? { sportId } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    const rows = await prisma.academyAnnouncement.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        reads: {
          where: { userId: ctx.userId },
          select: { id: true, readAt: true },
        },
        _count: { select: { reads: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          audience: a.audience,
          sportId: a.sportId,
          publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
          expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
          read: a.reads.length > 0,
          readAt: a.reads[0]?.readAt ? a.reads[0].readAt.toISOString() : null,
          totalReadsCount: a._count.reads,
          createdAt: a.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/announcements]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load announcements");
  }
}

/**
 * POST /api/academy/announcements
 * Broadcasts an announcement. Requires announcements:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "announcements", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseAnnouncementInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    if (v.sportId) {
      const sport = await prisma.academySport.findFirst({
        where: { id: v.sportId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!sport) {
        return academyError(404, "NOT_FOUND", "Sport not found");
      }
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const a = await tx.academyAnnouncement.create({
        data: {
          tenantId: ctx.tenantId,
          authorId: ctx.userId,
          title: v.title,
          body: v.body,
          audience: v.audience,
          sportId: v.sportId,
          publishedAt: new Date(),
          expiresAt: v.expiresAt ? new Date(v.expiresAt) : null,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "announcement.created",
        entityType: "academy_announcement",
        entityId: a.id,
        summary: `Published announcement '${v.title}' for audience: ${v.audience}`,
        after: { title: v.title, audience: v.audience, sportId: v.sportId },
        operationId: request.headers.get("x-operation-id"),
      });

      return a;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        audience: announcement.audience,
        sportId: announcement.sportId,
        publishedAt: announcement.publishedAt ? announcement.publishedAt.toISOString() : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/announcements]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create announcement");
  }
}
