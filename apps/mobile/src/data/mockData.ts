/**
 * Mock data for Phase 2 UI development.
 * Replaced by real API calls in Phase 3.
 */
import type { Conversation, Message, User } from "@chatbot/shared-types";

export const MOCK_ADMIN_USER: User = {
  id: "user-admin-001",
  tenantId: "cmtgyf6k900007eegk9xui75k",
  name: "Super Admin",
  email: process.env.EXPO_PUBLIC_ADMIN_EMAIL || "admin@ofa-sports.com",
  role: "admin",
  createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
};

export const MOCK_DEMO_USER: User = {
  id: "user-demo-002",
  tenantId: "cmtgyf6k900007eegk9xui75k",
  name: "App User",
  email: process.env.EXPO_PUBLIC_DEMO_EMAIL || "demo@ofa-sports.com",
  role: "user",
  createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
};

export const MOCK_CURRENT_USER: User = {
  ...MOCK_DEMO_USER,
};

export function setCurrentUser(user: Partial<User>) {
  Object.assign(MOCK_CURRENT_USER, user);
}

export const MOCK_BOT_USER: User = {
  id: "cmtgyf6n300047eegz19jfoht",
  tenantId: "cmtgyf6k900007eegk9xui75k",
  name: "OFA AI",
  email: "bot@ofa-sports.com",
  role: "bot",
  createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
};

const now = Date.now();

export const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-welcome-1",
    conversationId: "ofa-conv-001",
    senderId: MOCK_BOT_USER.id,
    sender: { id: MOCK_BOT_USER.id, name: "OFA AI", role: "bot" },
    body: "Hello! Welcome to OFA Sports. I'm your OFA Assistant — here to help with court bookings, coaching, tournaments, memberships, and sports enquiries. How can I help you today? 🏅",
    kind: "text",
    status: "read",
    createdAt: new Date(now - 3600000).toISOString(),
  },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "ofa-conv-001",
    tenantId: "cmtgyf6k900007eegk9xui75k",
    name: "OFA Assistant",
    kind: "ai",
    createdAt: new Date(now - 86400000).toISOString(),
    updatedAt: new Date(now - 60000).toISOString(),
    lastMessage: {
      body: "Hello! Welcome to OFA Sports. How can I help you today?",
      senderId: MOCK_BOT_USER.id,
      createdAt: new Date(now - 60000).toISOString(),
    },
    participants: [
      { id: "p1", conversationId: "ofa-conv-001", userId: MOCK_CURRENT_USER.id, joinedAt: new Date(now - 86400000).toISOString(), user: { id: MOCK_CURRENT_USER.id, name: "App User", role: "user" } },
      { id: "p2", conversationId: "ofa-conv-001", userId: MOCK_BOT_USER.id, joinedAt: new Date(now - 86400000).toISOString(), user: { id: MOCK_BOT_USER.id, name: "OFA AI", role: "bot" } },
    ],
  },
];
