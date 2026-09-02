/**
 * Shared TypeScript types for the WhatsApp-style AI Chatbot SaaS.
 * These are the canonical shapes shared between the Next.js server,
 * the Expo mobile app, and the Socket.io realtime server.
 */

// ─── Tenant ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string; // ISO 8601
}

// ─── User ────────────────────────────────────────────────────────────────────

export type UserRole = "user" | "bot" | "admin";

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export type ConversationKind = "direct" | "group" | "ai";

export interface Conversation {
  id: string;
  tenantId: string;
  name?: string; // optional for DMs
  kind: ConversationKind;
  createdAt: string;
  updatedAt: string;
  /** Denormalised: last message preview for list screen */
  lastMessage?: Pick<Message, "body" | "createdAt" | "senderId">;
  /** Participants summary (populated on list endpoint) */
  participants?: Participant[];
}

// ─── Participant ──────────────────────────────────────────────────────────────

export interface Participant {
  id: string;
  conversationId: string;
  userId: string;
  user?: Pick<User, "id" | "name" | "avatarUrl" | "role">;
  joinedAt: string;
}

// ─── Message ──────────────────────────────────────────────────────────────────

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type MessageKind = "text" | "image" | "audio" | "document" | "tool_result" | "system";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: Pick<User, "id" | "name" | "avatarUrl" | "role">;
  body: string;
  kind: MessageKind;
  status: MessageStatus;
  createdAt: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  /** If kind === 'tool_result', this holds the extracted data */
  metadata?: Record<string, unknown>;
}

// ─── Sheet Connection ─────────────────────────────────────────────────────────

export type SheetAuthMode = "service_account" | "oauth2";

export interface SheetConnection {
  id: string;
  tenantId: string;
  spreadsheetId: string;
  sheetName: string;
  authMode: SheetAuthMode;
  /** Column headers defining what the AI should extract */
  columns: SheetColumn[];
  createdAt: string;
}

export interface SheetColumn {
  name: string;       // e.g. "customer_name"
  label: string;      // e.g. "Customer Name"
  description: string; // e.g. "Full name of the person enquiring"
  required: boolean;
}

// ─── Socket.io Events ─────────────────────────────────────────────────────────

/** Events emitted from server → client */
export interface ServerToClientEvents {
  new_message: (message: Message) => void;
  user_typing: (payload: { userId: string; conversationId: string }) => void;
  user_stopped_typing: (payload: { userId: string; conversationId: string }) => void;
  message_status_update: (payload: { messageId: string; status: MessageStatus }) => void;
  error: (payload: { code: string; message: string }) => void;
}

/** Events emitted from client → server */
export interface ClientToServerEvents {
  join_conversation: (conversationId: string) => void;
  leave_conversation: (conversationId: string) => void;
  typing_start: (conversationId: string) => void;
  typing_stop: (conversationId: string) => void;
}

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── AI / Tool schemas ────────────────────────────────────────────────────────

/** Payload returned by the Claude tool_use block */
export interface InsertSheetRowInput {
  columns: Record<string, string>;
  conversationId: string;
  rawMessage: string;
}
