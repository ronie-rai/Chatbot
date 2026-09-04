import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("id");
    const tenantId = searchParams.get("tenantId");

    // If specific conversation ID requested, return full message transcript
    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: { select: { id: true, name: true, role: true } },
            },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message: "Conversation not found" } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        data: {
          id: conversation.id,
          name: conversation.name,
          kind: conversation.kind,
          tenantName: conversation.tenant.name,
          createdAt: conversation.createdAt.toISOString(),
          participants: conversation.participants.map((p) => ({
            id: p.user.id,
            name: p.user.name,
            email: p.user.email,
            role: p.user.role,
          })),
          messages: conversation.messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.sender.name,
            senderRole: m.sender.role,
            body: m.body,
            kind: m.kind,
            createdAt: m.createdAt.toISOString(),
          })),
        },
      });
    }

    // Otherwise, return recent conversation list with last message snippet
    const conversations = await prisma.conversation.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, role: true } },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    const data = conversations.map((c) => {
      const lastMsg = c.messages[0];
      return {
        id: c.id,
        name: c.name,
        kind: c.kind,
        tenantId: c.tenantId,
        tenantName: c.tenant.name,
        totalMessages: c._count.messages,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        participants: c.participants.map((p) => ({
          name: p.user.name,
          email: p.user.email,
          role: p.user.role,
        })),
        lastMessage: lastMsg
          ? {
              senderName: lastMsg.sender.name,
              body: lastMsg.body.slice(0, 120),
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/admin/conversations]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch conversations" } },
      { status: 500 }
    );
  }
}
