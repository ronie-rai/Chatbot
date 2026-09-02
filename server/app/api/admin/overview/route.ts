import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const [
      totalTenants,
      totalUsers,
      totalConversations,
      totalMessages,
      totalSheets,
      recentTenants,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count({ where: { role: { not: "BOT" } } }),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.sheetConnection.count(),
      prisma.tenant.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              users: true,
              conversations: true,
              sheetConnections: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        totalTenants,
        totalUsers,
        totalConversations,
        totalMessages,
        totalSheets,
        recentTenants: recentTenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          userCount: t._count.users,
          groupCount: t._count.conversations,
          hasSheet: t._count.sheetConnections > 0,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/overview]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch admin overview" } },
      { status: 500 }
    );
  }
}
