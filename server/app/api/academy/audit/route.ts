import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/audit?limit=50&cursor=<id>
 * Newest-first audit trail for the caller's tenant. Requires audit:view.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "audit", "view");
    if (!auth.ok) return auth.response;
    const { tenantId } = auth.ctx;

    const { searchParams } = new URL(request.url);
    const rawLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
    const cursor = searchParams.get("cursor");

    const rows = await prisma.academyAuditLog.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((r) => ({
          id: r.id,
          actorUserId: r.actorUserId,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          summary: r.summary,
          reason: r.reason,
          operationId: r.operationId,
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/audit]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load audit log");
  }
}
