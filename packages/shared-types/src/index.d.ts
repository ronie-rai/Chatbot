/**
 * Shared TypeScript types for the WhatsApp-style AI Chatbot SaaS.
 * These are the canonical shapes shared between the Next.js server,
 * the Expo mobile app, and the Socket.io realtime server.
 */
export interface Tenant {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
}
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
export type ConversationKind = "direct" | "group" | "ai";
export interface Conversation {
    id: string;
    tenantId: string;
    name?: string;
    kind: ConversationKind;
    createdAt: string;
    updatedAt: string;
    /** Denormalised: last message preview for list screen */
    lastMessage?: Pick<Message, "body" | "createdAt" | "senderId">;
    /** Participants summary (populated on list endpoint) */
    participants?: Participant[];
}
export interface Participant {
    id: string;
    conversationId: string;
    userId: string;
    user?: Pick<User, "id" | "name" | "avatarUrl" | "role">;
    joinedAt: string;
}
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
    name: string;
    label: string;
    description: string;
    required: boolean;
}
/** Events emitted from server → client */
export interface ServerToClientEvents {
    new_message: (message: Message) => void;
    user_typing: (payload: {
        userId: string;
        conversationId: string;
    }) => void;
    user_stopped_typing: (payload: {
        userId: string;
        conversationId: string;
    }) => void;
    message_status_update: (payload: {
        messageId: string;
        status: MessageStatus;
    }) => void;
    error: (payload: {
        code: string;
        message: string;
    }) => void;
}
/** Events emitted from client → server */
export interface ClientToServerEvents {
    join_conversation: (conversationId: string) => void;
    leave_conversation: (conversationId: string) => void;
    typing_start: (conversationId: string) => void;
    typing_stop: (conversationId: string) => void;
}
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
/** Payload returned by the Claude tool_use block */
export interface InsertSheetRowInput {
    columns: Record<string, string>;
    conversationId: string;
    rawMessage: string;
}
export type FieldDataType = "text" | "textarea" | "number" | "float" | "phone" | "email" | "date" | "time" | "dropdown" | "choice" | "boolean";
export interface TemplateField {
    key: string;
    label: string;
    required: boolean;
    type: FieldDataType;
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
}
export interface ChatTemplateItem {
    id: string;
    tenantId: string;
    command: string;
    name: string;
    description: string | null;
    sheetName: string;
    icon: string | null;
    fields: TemplateField[];
    promptMessage: string;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=index.d.ts.map