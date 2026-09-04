/**
 * API client for the Next.js server.
 * Phase 3: Basic fetch wrapper with error handling.
 * Phase 8: Will add JWT auth headers.
 */
import type { ApiResponse, Conversation, Message } from "@chatbot/shared-types";
import { Platform } from "react-native";

let customBaseUrl: string | null = null;

export function setCustomBaseUrl(url: string | null) {
  customBaseUrl = url?.trim() || null;
}

export function getEffectiveBaseUrl(): string {
  if (customBaseUrl) return customBaseUrl.replace(/\/+$/, "");
  return (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export const BASE_URL = getEffectiveBaseUrl();

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getEffectiveBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.ok) {
    throw new Error(json.error.message);
  }

  return json.data;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(userId: string): Promise<Conversation[]> {
  return apiFetch<Conversation[]>(`/api/conversations?userId=${userId}`);
}

export async function createConversation(data: {
  name: string;
  creatorId: string;
  kind?: "ai" | "direct" | "group";
  tenantId?: string;
}): Promise<Conversation> {
  try {
    return await apiFetch<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn("[createConversation] API failed, creating local fallback conversation:", err);
    // Offline fallback: generate mock conversation object
    const now = new Date().toISOString();
    return {
      id: `conv-local-${Date.now()}`,
      tenantId: data.tenantId || "cmtgyf6k900007eegk9xui75k",
      name: data.name,
      kind: data.kind || "ai",
      createdAt: now,
      updatedAt: now,
      participants: [
        {
          id: `part-${Date.now()}`,
          conversationId: `conv-local-${Date.now()}`,
          userId: data.creatorId,
          joinedAt: now,
        },
      ],
    };
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(
  conversationId: string,
  since?: string
): Promise<Message[]> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<Message[]>(`/api/conversations/${conversationId}/messages${qs}`);
}

export interface SendMessageOptions {
  kind?: Message["kind"];
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  options?: SendMessageOptions
): Promise<Message> {
  try {
    return await apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        senderId,
        text,
        kind: options?.kind,
        mediaUrl: options?.mediaUrl,
        fileName: options?.fileName,
        fileSize: options?.fileSize,
        mimeType: options?.mimeType,
        duration: options?.duration,
        metadata: options?.metadata,
      }),
    });
  } catch (err) {
    console.warn("[sendMessage] API unreachable, falling back to local message:", err);
    // Graceful offline fallback per workspace rules
    const now = new Date().toISOString();
    return {
      id: `msg-local-${Date.now()}`,
      conversationId,
      senderId,
      body: text,
      kind: options?.kind || "text",
      status: "sent",
      mediaUrl: options?.mediaUrl,
      fileName: options?.fileName,
      fileSize: options?.fileSize,
      mimeType: options?.mimeType,
      duration: options?.duration,
      createdAt: now,
    };
  }
}

export async function uploadMediaFile(
  fileOrPicked: File | Blob | { uri: string; name: string; type: string; size?: number; file?: File },
  fileName?: string,
  mimeType?: string
): Promise<{ url: string; fileName: string; fileSize: number; mimeType: string }> {
  const isPickedObj = typeof fileOrPicked === "object" && fileOrPicked !== null && "uri" in fileOrPicked;
  const effectiveName = fileName || (isPickedObj ? fileOrPicked.name : (fileOrPicked instanceof File ? fileOrPicked.name : `media_${Date.now()}`));
  const effectiveType = mimeType || (isPickedObj ? fileOrPicked.type : ((fileOrPicked as any).type || "application/octet-stream"));
  const effectiveSize = isPickedObj ? (fileOrPicked.size || 0) : ((fileOrPicked as any).size || 0);

  try {
    const formData = new FormData();

    if (Platform.OS !== "web" && isPickedObj) {
      formData.append("file", {
        uri: fileOrPicked.uri,
        name: effectiveName,
        type: effectiveType,
      } as any);
    } else {
      const filePayload = (isPickedObj && fileOrPicked.file) ? fileOrPicked.file : fileOrPicked;
      formData.append("file", filePayload as any, effectiveName);
    }

    const res = await fetch(`${getEffectiveBaseUrl()}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (json.ok && json.data) {
      const fullUrl = json.data.url.startsWith("http")
        ? json.data.url
        : `${getEffectiveBaseUrl()}${json.data.url}`;
      return {
        url: fullUrl,
        fileName: json.data.fileName || effectiveName,
        fileSize: json.data.fileSize || effectiveSize,
        mimeType: json.data.mimeType || effectiveType,
      };
    }
    throw new Error(json.error?.message || "Upload failed");
  } catch (err) {
    console.warn("[uploadMediaFile] Falling back to local file URI:", err);

    // Offline / Standalone APK local fallback:
    if (isPickedObj && fileOrPicked.uri) {
      return {
        url: fileOrPicked.uri,
        fileName: effectiveName,
        fileSize: effectiveSize,
        mimeType: effectiveType,
      };
    }

    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && (fileOrPicked instanceof Blob || fileOrPicked instanceof File)) {
      return {
        url: URL.createObjectURL(fileOrPicked),
        fileName: effectiveName,
        fileSize: effectiveSize,
        mimeType: effectiveType,
      };
    }

    return {
      url: "",
      fileName: effectiveName,
      fileSize: effectiveSize,
      mimeType: effectiveType,
    };
  }
}

export async function markMessageRead(
  conversationId: string,
  messageId: string
): Promise<void> {
  try {
    await apiFetch<{ messageId: string; status: string }>(
      `/api/conversations/${conversationId}/messages/${messageId}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "read" }) }
    );
  } catch {
    // Non-fatal — read receipts are best effort
  }
}
