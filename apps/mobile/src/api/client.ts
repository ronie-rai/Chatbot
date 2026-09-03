/**
 * API client for the Next.js server.
 * Phase 3: Basic fetch wrapper with error handling.
 * Phase 8: Will add JWT auth headers.
 */
import type { ApiResponse, Conversation, Message } from "@chatbot/shared-types";

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;
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
  return apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
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
}

export async function uploadMediaFile(
  file: File | Blob,
  fileName?: string,
  mimeType?: string
): Promise<{ url: string; fileName: string; fileSize: number; mimeType: string }> {
  try {
    const formData = new FormData();
    const effectiveName = fileName || (file instanceof File ? file.name : `media_${Date.now()}`);
    const effectiveType = mimeType || file.type || "application/octet-stream";

    formData.append("file", file, effectiveName);

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (json.ok && json.data) {
      // If the url is relative (e.g. /uploads/...), make it absolute with BASE_URL
      const fullUrl = json.data.url.startsWith("http")
        ? json.data.url
        : `${BASE_URL}${json.data.url}`;
      return {
        url: fullUrl,
        fileName: json.data.fileName || effectiveName,
        fileSize: json.data.fileSize || file.size,
        mimeType: json.data.mimeType || effectiveType,
      };
    }
    throw new Error(json.error?.message || "Upload failed");
  } catch (err) {
    console.warn("[uploadMediaFile] Falling back to local data URL:", err);
    // Offline/local fallback: convert blob to object URL or base64 data URL
    return new Promise((resolve) => {
      const effectiveName = fileName || (file instanceof File ? file.name : `file_${Date.now()}`);
      const effectiveType = mimeType || file.type || "application/octet-stream";

      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        try {
          const objectUrl = URL.createObjectURL(file);
          resolve({
            url: objectUrl,
            fileName: effectiveName,
            fileSize: file.size,
            mimeType: effectiveType,
          });
          return;
        } catch {
          // continue to reader fallback
        }
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          url: reader.result as string,
          fileName: effectiveName,
          fileSize: file.size,
          mimeType: effectiveType,
        });
      };
      reader.readAsDataURL(file);
    });
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
