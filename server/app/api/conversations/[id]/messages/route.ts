import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastMessage } from "@/lib/broadcast";
import { runAITurn } from "@/lib/ai";
import {
  handleSlashCommand,
  handleActiveTemplateReply,
} from "@/lib/templates";

// Helper to shape a DB message into the API response format
function shapeMessage(m: {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  kind: string;
  status: string;
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  duration?: number | null;
  metadata: unknown;
  createdAt: Date;
  sender?: { id: string; name: string; avatarUrl: string | null; role: string } | null;
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: m.sender
      ? {
          id: m.sender.id,
          name: m.sender.name,
          avatarUrl: m.sender.avatarUrl ?? undefined,
          role: m.sender.role.toLowerCase() as "user" | "bot" | "admin",
        }
      : undefined,
    body: m.body,
    kind: m.kind.toLowerCase() as "text" | "image" | "audio" | "document" | "tool_result" | "system",
    status: m.status.toLowerCase() as "sending" | "sent" | "delivered" | "read" | "failed",
    mediaUrl: m.mediaUrl ?? undefined,
    fileName: m.fileName ?? undefined,
    fileSize: m.fileSize ?? undefined,
    mimeType: m.mimeType ?? undefined,
    duration: m.duration ?? undefined,
    metadata: (m.metadata ?? undefined) as Record<string, unknown> | undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * GET /api/conversations/[id]/messages
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const cursor = searchParams.get("cursor");

    const messages = await prisma.message.findMany({
      where: {
        conversationId: params.id,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return NextResponse.json({
      ok: true,
      data: messages.map(shapeMessage),
      meta: {
        count: messages.length,
        nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error(`[GET /api/conversations/${params.id}/messages]`, error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Phases 3–6: persist → broadcast → AI turn → persist bot reply → broadcast
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      senderId,
      text,
      kind = "text",
      mediaUrl,
      fileName,
      fileSize,
      mimeType,
      duration,
      metadata,
    } = body as {
      senderId: string;
      text?: string;
      kind?: "text" | "image" | "audio" | "document" | "tool_result" | "system";
      mediaUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      duration?: number;
      metadata?: Record<string, unknown>;
    };

    const trimmedText = text?.trim() || "";
    if (!senderId || (!trimmedText && !mediaUrl)) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "senderId and either text or mediaUrl are required" } },
        { status: 400 }
      );
    }

    // Verify conversation and participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
    });
    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId: params.id, userId: senderId } },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    if (!participant) {
      return NextResponse.json(
        { ok: false, error: { code: "FORBIDDEN", message: "Not a participant" } },
        { status: 403 }
      );
    }

    const effectiveKind = (kind || "text").toUpperCase() as
      | "TEXT"
      | "IMAGE"
      | "AUDIO"
      | "DOCUMENT"
      | "TOOL_RESULT"
      | "SYSTEM";

    const effectiveBody =
      trimmedText ||
      (effectiveKind === "AUDIO"
        ? `Voice message${duration ? ` (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")})` : ""}`
        : effectiveKind === "IMAGE"
        ? "Photo"
        : fileName || "[Attachment]");

    // 1. Persist user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId: params.id,
        senderId,
        body: effectiveBody,
        kind: effectiveKind,
        status: "SENT",
        mediaUrl: mediaUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        duration: duration || null,
        metadata: metadata ? (metadata as any) : undefined,
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    });

    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    });

    const shapedUserMsg = shapeMessage(userMessage);

    // 2. Broadcast user message to room (non-blocking)
    broadcastMessage(params.id, shapedUserMsg).catch(() => {});

    // 3. Trigger AI turn (non-blocking — don't make client wait)
    triggerAIReply(params.id, conversation.tenantId, effectiveBody, participant.user).catch((err) => {
      console.error("[AI turn failed]", err);
    });

    return NextResponse.json({ ok: true, data: shapedUserMsg }, { status: 201 });
  } catch (error) {
    console.error(`[POST /api/conversations/${params.id}/messages]`, error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

/**
 * Runs AI turn or template command handling in the background: get reply, persist bot message, broadcast.
 */
async function triggerAIReply(
  conversationId: string,
  tenantId: string,
  userText: string,
  senderUser?: { id: string; name: string; role: string }
): Promise<void> {
  // Find the bot participant in this conversation
  const botParticipant = await prisma.participant.findFirst({
    where: {
      conversationId,
      user: { role: "BOT" },
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
  });

  if (!botParticipant?.user) {
    console.log("[AI] No bot participant in conversation, skipping AI turn");
    return;
  }

  const botUser = botParticipant.user;

  // 1. Check if user issued a slash command (/booking, /membership, /create, /modify, /delete, /templates, /help)
  if (userText.trim().startsWith("/")) {
    const slashRes = await handleSlashCommand({
      conversationId,
      tenantId,
      senderId: senderUser?.id || "",
      senderRole: senderUser?.role || "USER",
      senderName: senderUser?.name || "Member",
      text: userText,
    });

    if (slashRes.handled && slashRes.reply) {
      // If template opened, record active template in conversation metadata
      if (slashRes.activeTemplate !== undefined) {
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        const meta = (conv?.metadata as Record<string, any>) || {};
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { metadata: { ...meta, activeTemplate: slashRes.activeTemplate } },
        });
      }

      const botMessage = await prisma.message.create({
        data: {
          conversationId,
          senderId: botUser.id,
          body: slashRes.reply,
          kind: slashRes.kind === "tool_result" || slashRes.sheetInserted ? "TOOL_RESULT" : "TEXT",
          status: "SENT",
          metadata: slashRes.sheetName
            ? { sheetName: slashRes.sheetName, sheetInserted: slashRes.sheetInserted }
            : undefined,
        },
        include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      await broadcastMessage(conversationId, shapeMessage(botMessage));
      return;
    }
  }

  // 2. Check if user is replying to an active template form
  const templateReplyRes = await handleActiveTemplateReply(
    conversationId,
    tenantId,
    userText,
    { name: senderUser?.name || "Member" }
  );

  if (templateReplyRes && templateReplyRes.handled && templateReplyRes.reply) {
    const botMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId: botUser.id,
        body: templateReplyRes.reply,
        kind: "TOOL_RESULT",
        status: "SENT",
        metadata: templateReplyRes.sheetName
          ? { sheetName: templateReplyRes.sheetName, sheetInserted: true }
          : undefined,
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await broadcastMessage(conversationId, shapeMessage(botMessage));
    return;
  }

  // 3. Fallback to standard Groq / AI Turn
  const { reply, sheetInserted, toolCallId } = await runAITurn(
    conversationId,
    tenantId,
    userText
  );

  if (!reply) return;

  // Persist bot reply
  const botMessage = await prisma.message.create({
    data: {
      conversationId,
      senderId: botUser.id,
      body: reply,
      kind: sheetInserted ? "TOOL_RESULT" : "TEXT",
      status: "SENT",
      metadata: sheetInserted && toolCallId ? { toolCallId, sheetInserted: true } : undefined,
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Broadcast bot reply to room
  await broadcastMessage(conversationId, shapeMessage(botMessage));
}

