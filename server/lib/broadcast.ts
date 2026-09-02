/**
 * Broadcast a message to a Socket.io room via the internal HTTP API.
 * Called by the Next.js API after persisting a message.
 */
import type { Message } from "@chatbot/shared-types";

const REALTIME_URL = process.env.REALTIME_SERVER_URL ?? "http://localhost:4000";
const REALTIME_SECRET = process.env.REALTIME_SECRET ?? "dev-secret-change-in-production";

export async function broadcastMessage(conversationId: string, message: Message): Promise<void> {
  try {
    let res = await fetch(`${REALTIME_URL}/emit-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-realtime-secret": REALTIME_SECRET,
      },
      body: JSON.stringify({ conversationId, message }),
    });

    if (res.status === 401 && REALTIME_SECRET !== "change-me-in-production") {
      res = await fetch(`${REALTIME_URL}/emit-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-realtime-secret": "change-me-in-production",
        },
        body: JSON.stringify({ conversationId, message }),
      });
    }

    if (!res.ok) {
      console.warn(`[broadcast] Failed to emit message: ${res.status}`);
    }
  } catch (err) {
    // Realtime server may not be running in dev — non-fatal
    console.warn("[broadcast] Realtime server unreachable:", (err as Error).message);
  }
}
