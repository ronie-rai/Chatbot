import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastMessage } from "@/lib/broadcast";

/**
 * PATCH /api/conversations/[id]/messages/[msgId]/status
 * Updates a message status (delivered → read) and broadcasts the change.
 * Called by the mobile client when messages are viewed.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; msgId: string } }
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { status } = body as { status: "delivered" | "read" };

    if (!["delivered", "read"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_STATUS", message: "Status must be delivered or read" } },
        { status: 400 }
      );
    }

    const message = await prisma.message.update({
      where: { id: params.msgId },
      data: { status: status.toUpperCase() as "DELIVERED" | "READ" },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    });

    // Broadcast status update to the conversation room
    await broadcastStatusUpdate(params.id, params.msgId, status);

    return NextResponse.json({
      ok: true,
      data: {
        messageId: message.id,
        status,
      },
    });
  } catch (error) {
    console.error(`[PATCH status]`, error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

async function broadcastStatusUpdate(
  conversationId: string,
  messageId: string,
  status: string
): Promise<void> {
  const REALTIME_URL = process.env.REALTIME_SERVER_URL ?? "http://localhost:4000";
  const REALTIME_SECRET = process.env.REALTIME_SECRET ?? "dev-secret-change-in-production";

  try {
    await fetch(`${REALTIME_URL}/emit-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-realtime-secret": REALTIME_SECRET,
      },
      body: JSON.stringify({ conversationId, messageId, status }),
    });
  } catch {
    // Non-fatal
  }
}
