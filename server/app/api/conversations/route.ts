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

/**
 * POST /api/conversations
 * Creates a new conversation with participants (and bot if AI kind).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      name,
      creatorId,
      kind = "ai",
      tenantId: requestedTenantId,
    } = body as {
      name?: string;
      creatorId?: string;
      kind?: "ai" | "direct" | "group";
      tenantId?: string;
    };

    if (!creatorId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_CREATOR", message: "creatorId is required" } },
        { status: 400 }
      );
    }

    // Resolve tenantId from creator if not provided
    let tenantId = requestedTenantId;
    if (!tenantId) {
      const creator = await prisma.user.findUnique({ where: { id: creatorId } });
      if (!creator) {
        return NextResponse.json(
          { ok: false, error: { code: "USER_NOT_FOUND", message: "Creator user not found" } },
          { status: 404 }
        );
      }
      tenantId = creator.tenantId;
    }

    const conversationKind = (kind || "ai").toUpperCase() as "AI" | "DIRECT" | "GROUP";

    // Find bot user in this tenant for AI chats
    let botUser: { id: string; name: string; avatarUrl: string | null; role: string } | null = null;
    if (conversationKind === "AI") {
      botUser = await prisma.user.findFirst({
        where: { tenantId, role: "BOT" },
        select: { id: true, name: true, avatarUrl: true, role: true },
      });
    }

    // Create conversation and participants
    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        name: name?.trim() || "New Chat",
        kind: conversationKind,
        participants: {
          create: [
            { userId: creatorId },
            ...(botUser ? [{ userId: botUser.id }] : []),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } },
          },
        },
      },
    });

    const shaped = {
      id: conversation.id,
      tenantId: conversation.tenantId,
      name: conversation.name,
      kind: conversation.kind.toLowerCase(),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
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
    };

    return NextResponse.json({ ok: true, data: shaped }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/conversations]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
