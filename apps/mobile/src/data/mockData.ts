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
  name: "Demo User",
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
    id: "msg-1",
    conversationId: "seed-conv-001",
    senderId: MOCK_BOT_USER.id,
    sender: { id: MOCK_BOT_USER.id, name: "OFA AI", role: "bot" },
    body: "Hello! Welcome to OFA Sports. I'm your AI assistant. How can I help you today with court bookings, coaching, tournaments, or sports enquiries?",
    kind: "text",
    status: "read",
    createdAt: new Date(now - 3600000 * 2).toISOString(),
  },
  {
    id: "msg-2",
    conversationId: "seed-conv-001",
    senderId: MOCK_CURRENT_USER.id,
    sender: { id: MOCK_CURRENT_USER.id, name: "Alice", role: "user" },
    body: "Hi! My name is Alice Johnson, my number is 9876543210. I need a transformer rewound for my workshop equipment.",
    kind: "text",
    status: "read",
    createdAt: new Date(now - 3600000).toISOString(),
  },
  {
    id: "msg-3",
    conversationId: "seed-conv-001",
    senderId: MOCK_BOT_USER.id,
    sender: { id: MOCK_BOT_USER.id, name: "Acme AI", role: "bot" },
    body: "Thank you, Alice! I've captured your details:\n\n📋 *Name:* Alice Johnson\n📞 *Phone:* 9876543210\n🔧 *Enquiry:* Transformer rewinding for workshop equipment\n\nOur team will get back to you shortly!",
    kind: "text",
    status: "delivered",
    createdAt: new Date(now - 3590000).toISOString(),
  },
  {
    id: "msg-4",
    conversationId: "seed-conv-001",
    senderId: MOCK_CURRENT_USER.id,
    sender: { id: MOCK_CURRENT_USER.id, name: "Alice", role: "user" },
    body: "Here is a photo of the damaged motor transformer unit for reference.",
    kind: "image",
    mediaUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80",
    status: "read",
    createdAt: new Date(now - 45000).toISOString(),
  },
  {
    id: "msg-5",
    conversationId: "seed-conv-001",
    senderId: MOCK_CURRENT_USER.id,
    sender: { id: MOCK_CURRENT_USER.id, name: "Alice", role: "user" },
    body: "Specification_Sheet_v2.pdf",
    kind: "document",
    fileName: "Transformer_Specs_2026.pdf",
    fileSize: 1420500,
    mimeType: "application/pdf",
    mediaUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    status: "read",
    createdAt: new Date(now - 30000).toISOString(),
  },
  {
    id: "msg-6",
    conversationId: "seed-conv-001",
    senderId: MOCK_CURRENT_USER.id,
    sender: { id: MOCK_CURRENT_USER.id, name: "Alice", role: "user" },
    body: "Voice message (0:08)",
    kind: "audio",
    duration: 8,
    mediaUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
    status: "sent",
    createdAt: new Date(now - 15000).toISOString(),
  },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "seed-conv-001",
    tenantId: "cmtgyf6k900007eegk9xui75k",
    name: "AI Support",
    kind: "ai",
    createdAt: new Date(now - 86400000).toISOString(),
    updatedAt: new Date(now - 60000).toISOString(),
    lastMessage: {
      body: "Perfect, thank you!",
      senderId: MOCK_CURRENT_USER.id,
      createdAt: new Date(now - 60000).toISOString(),
    },
    participants: [
      { id: "p1", conversationId: "seed-conv-001", userId: MOCK_CURRENT_USER.id, joinedAt: new Date(now - 86400000).toISOString(), user: { id: MOCK_CURRENT_USER.id, name: "Alice", role: "user" } },
      { id: "p2", conversationId: "seed-conv-001", userId: MOCK_BOT_USER.id, joinedAt: new Date(now - 86400000).toISOString(), user: { id: MOCK_BOT_USER.id, name: "Acme AI", role: "bot" } },
    ],
  },
  {
    id: "conv-002",
    tenantId: "cmtgyf6k900007eegk9xui75k",
    name: "Sales Enquiry",
    kind: "ai",
    createdAt: new Date(now - 86400000 * 2).toISOString(),
    updatedAt: new Date(now - 86400000).toISOString(),
    lastMessage: {
      body: "I'll pass your details to the sales team.",
      senderId: MOCK_BOT_USER.id,
      createdAt: new Date(now - 86400000).toISOString(),
    },
    participants: [],
  },
];
