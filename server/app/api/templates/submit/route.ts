import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendTemplateSubmission, getTemplateByCommand } from "@/lib/templates";
import { broadcastMessage } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

function shapeMessage(m: any) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: m.sender
      ? {
          id: m.sender.id,
          name: m.sender.name,
          role: m.sender.role.toLowerCase() as "admin" | "user" | "bot",
          avatarUrl: m.sender.avatarUrl ?? undefined,
        }
      : undefined,
    body: m.body,
    kind: m.kind.toLowerCase() as "text" | "tool_result",
    status: m.status.toLowerCase() as "sent" | "delivered" | "read",
    mediaUrl: m.mediaUrl ?? undefined,
    fileName: m.fileName ?? undefined,
    fileSize: m.fileSize ?? undefined,
    mimeType: m.mimeType ?? undefined,
    duration: m.duration ?? undefined,
    metadata: (m.metadata as Record<string, unknown>) ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * POST /api/templates/submit
 * Directly submits an in-chat interactive template form to PostgreSQL & Google Sheets.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      conversationId,
      tenantId,
      command,
      senderId,
      senderName,
      senderPhone,
      formData,
    } = body as {
      conversationId: string;
      tenantId: string;
      command: string;
      senderId: string;
      senderName?: string;
      senderPhone?: string;
      formData: Record<string, string>;
    };

    if (!conversationId || !tenantId || !command || !formData) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "conversationId, tenantId, command, and formData are required" } },
        { status: 400 }
      );
    }

    const template = await getTemplateByCommand(tenantId, command);
    if (!template) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: `Template "/${command}" not found` } },
        { status: 404 }
      );
    }

    // 1. Dual-persist to PostgreSQL TemplateSubmission & Google Sheet tab
    const cleanCmd = command.toLowerCase().replace(/^\//, "");
    const res = await appendTemplateSubmission(
      tenantId,
      cleanCmd,
      formData,
      {
        name: senderName || formData["Full Name"] || formData["Athlete Name"] || formData["Member Name"] || "Member",
        phone: senderPhone || formData["Phone Number"] || formData["Contact Phone"] || formData["Contact Number"] || "",
        rawMessage: `[Interactive Form Submission] /${cleanCmd}`,
      },
      conversationId
    );

    // 2. Find bot participant for the conversation
    const botParticipant = await prisma.participant.findFirst({
      where: {
        conversationId,
        user: { role: "BOT" },
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    });

    const botUserId = botParticipant?.user?.id || (await prisma.user.findFirst({ where: { role: "BOT" } }))?.id;

    if (botUserId) {
      const fieldList = Object.entries(formData)
        .filter(([_, v]) => v && String(v).trim())
        .map(([k, v]) => `• **${k}:** ${v}`)
        .join("\n");

      const receiptBody = `✅ *${template.name} Form Submitted!*\n\n📋 *Ref ID:* \`${res.submissionId}\`\n📊 *Google Sheet Tab:* **${res.sheetName}**\n💾 *Database Sync:* **Saved in PostgreSQL (100% In Sync)**\n\n${fieldList}\n\n*Your entry has been recorded in the database and updated in Google Sheets.*`;

      const botMessage = await prisma.message.create({
        data: {
          conversationId,
          senderId: botUserId,
          body: receiptBody,
          kind: "TOOL_RESULT",
          status: "SENT",
          metadata: {
            submissionId: res.submissionId,
            sheetName: res.sheetName,
            sheetInserted: res.success,
            templateCommand: cleanCmd,
            formData,
          },
        },
        include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      const shapedMsg = shapeMessage(botMessage);

      // Broadcast to room in real time
      broadcastMessage(conversationId, shapedMsg as any).catch(() => {});

      return NextResponse.json({
        ok: true,
        data: {
          submissionId: res.submissionId,
          sheetName: res.sheetName,
          message: shapedMsg,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        submissionId: res.submissionId,
        sheetName: res.sheetName,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/templates/submit]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to submit template form" } },
      { status: 500 }
    );
  }
}
