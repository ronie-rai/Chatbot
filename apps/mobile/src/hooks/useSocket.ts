/**
 * useSocket — manages Socket.io connection lifecycle for a conversation.
 * Phase 4: Room join/leave, new_message, typing events
 * Phase 9: Read receipt status updates, offline catch-up on reconnect
 */
import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents, Message, MessageStatus } from "@chatbot/shared-types";
import { getMessages } from "../api/client";

const REALTIME_URL = process.env.EXPO_PUBLIC_REALTIME_URL ?? "http://localhost:4000";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

function getSocket(userId?: string): TypedSocket {
  if (!globalSocket || !globalSocket.connected) {
    globalSocket = io(REALTIME_URL, {
      transports: ["websocket", "polling"],
      query: { userId: userId ?? "anonymous" },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    }) as TypedSocket;

    globalSocket.on("connect", () => {
      console.log("[socket] ✅ Connected:", globalSocket?.id);
    });

    globalSocket.on("disconnect", (reason) => {
      console.log("[socket] ❌ Disconnected:", reason);
    });

    globalSocket.on("error", (err) => {
      console.warn("[socket] Error:", err);
    });
  }
  return globalSocket;
}

interface UseSocketOptions {
  conversationId: string;
  userId?: string;
  onNewMessage: (message: Message) => void;
  onStatusUpdate?: (messageId: string, status: MessageStatus) => void;
  onTypingStart?: (userId: string) => void;
  onTypingStop?: (userId: string) => void;
  /** ISO timestamp of the last message we have — used for catch-up on reconnect */
  lastMessageAt?: string;
  onCatchUpMessages?: (messages: Message[]) => void;
}

export function useSocket({
  conversationId,
  userId,
  onNewMessage,
  onStatusUpdate,
  onTypingStart,
  onTypingStop,
  lastMessageAt,
  onCatchUpMessages,
}: UseSocketOptions) {
  const socketRef = useRef<TypedSocket | null>(null);
  const lastMessageAtRef = useRef(lastMessageAt);

  // Keep ref current without re-running effect
  useEffect(() => {
    lastMessageAtRef.current = lastMessageAt;
  }, [lastMessageAt]);

  useEffect(() => {
    const socket = getSocket(userId);
    socketRef.current = socket;

    const joinRoom = () => {
      console.log(`[socket] 🚪 Joining room "${conversationId}" on socket ${socket.id}`);
      socket.emit("join_conversation", conversationId);
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleNewMessage = (message: Message) => {
      onNewMessage(message);
      lastMessageAtRef.current = message.createdAt;
    };

    const handleStatusUpdate = ({ messageId, status }: { messageId: string; status: MessageStatus }) => {
      onStatusUpdate?.(messageId, status);
    };

    const handleTypingStart = ({ userId: uid }: { userId: string; conversationId: string }) => {
      onTypingStart?.(uid);
    };

    const handleTypingStop = ({ userId: uid }: { userId: string; conversationId: string }) => {
      onTypingStop?.(uid);
    };

    // ── Reconnect / Connect handler ───────────────────────────────────────────
    const handleConnect = async () => {
      console.log(`[socket] ✅ Connect/Reconnect event triggered for room "${conversationId}"`);
      joinRoom();

      if (lastMessageAtRef.current && onCatchUpMessages) {
        try {
          const missed = await getMessages(conversationId, lastMessageAtRef.current);
          if (missed.length > 0) {
            console.log(`[socket] Catch-up: ${missed.length} missed messages`);
            onCatchUpMessages(missed);
          }
        } catch (err) {
          console.warn("[socket] Catch-up failed:", err);
        }
      }
    };

    socket.on("connect", handleConnect);
    socket.on("new_message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("user_typing", handleTypingStart);
    socket.on("user_stopped_typing", handleTypingStop);

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      socket.emit("leave_conversation", conversationId);
      socket.off("connect", handleConnect);
      socket.off("new_message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("user_typing", handleTypingStart);
      socket.off("user_stopped_typing", handleTypingStop);
    };
  }, [conversationId, userId]);

  // ── Typing helpers ─────────────────────────────────────────────────────────
  const emitTypingStart = useCallback(() => {
    socketRef.current?.emit("typing_start", conversationId);
  }, [conversationId]);

  const emitTypingStop = useCallback(() => {
    socketRef.current?.emit("typing_stop", conversationId);
  }, [conversationId]);

  return { emitTypingStart, emitTypingStop };
}
