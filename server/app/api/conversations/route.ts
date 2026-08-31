import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations
 * Returns all conversations for a given userId.
 * Phase 3: Basic, no auth. Auth added in Phase 8.
 *
 * Query params:
 *   userId (required for now — replaced by JWT in Phase 8)
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_PARAM", message: "userId is required" } },
        { status: 400 }
      );
    }

    const participants = await prisma.participant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true, role: true },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                body: true,
                senderId: true,
                createdAt: true,
                status: true,
                kind: true,
              },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const conversations = participants.map(({ conversation }) => ({
      id: conversation.id,
      tenantId: conversation.tenantId,
      name: conversation.name,
      kind: conversation.kind.toLowerCase(),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      lastMessage: conversation.messages[0]
        ? {
            body: conversation.messages[0].body,
            senderId: conversation.messages[0].senderId,
            createdAt: conversation.messages[0].createdAt.toISOString(),
          }
        : undefined,
      participants: conversation.participants.map((p) => ({
        id: p.id,
        conversationId: p.conversationId,
        userId: p.userId,
        joinedAt: p.joinedAt.toISOString(),
        user: p.user
          ? {
              id: p.user.id,
              name: p.user.name,
              avatarUrl: p.user.avatarUrl ?? undefined,
              role: p.user.role.toLowerCase(),
            }
          : undefined,
      })),
    }));

    return NextResponse.json({ ok: true, data: conversations });
  } catch (error) {
    console.error("[GET /api/conversations]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
