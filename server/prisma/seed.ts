/**
 * Prisma seed script — OFA Sports & OFA Chatbot
 *
 * Creates:
 *  - 1 Tenant:  "OFA Sports" (slug: "OFA_Sports" / "ofa-sports")
 *  - 2 Users:   admin (human) + OFA AI (bot)
 *  - 1 Conversation: "OFA Sports AI Assistant" (kind=AI)
 *  - 2 Participants: admin + bot in the conversation
 *  - 1 SheetConnection: Google Sheet config for OFA Sports
 */

import { PrismaClient, UserRole, ConversationKind, SheetAuthMode } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding OFA Sports database...\n");

  // ─── 1. Tenant: OFA Sports ──────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "OFA_Sports" },
    update: { name: "OFA Sports" },
    create: {
      name: "OFA Sports",
      slug: "OFA_Sports",
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── 2. Users ──────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@ofa-sports.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Admin",
      email: "admin@ofa-sports.com",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ User:  ${admin.name} <${admin.email}> (${admin.role})`);

  const bot = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "bot@ofa-sports.com" } },
    update: { name: "OFA AI" },
    create: {
      tenantId: tenant.id,
      name: "OFA AI",
      email: "bot@ofa-sports.com",
      passwordHash: null,
      role: UserRole.BOT,
    },
  });
  console.log(`✅ User:  ${bot.name} <${bot.email}> (${bot.role})`);

  // ─── 3. Conversation ───────────────────────────────────────────────────────
  const conversation = await prisma.conversation.upsert({
    where: { id: "ofa-conv-001" },
    update: { name: "OFA Sports AI Assistant" },
    create: {
      id: "ofa-conv-001",
      tenantId: tenant.id,
      name: "OFA Sports AI Assistant",
      kind: ConversationKind.AI,
    },
  });
  console.log(`✅ Conversation: "${conversation.name}" (${conversation.kind})`);

  // ─── 4. Participants ───────────────────────────────────────────────────────
  await prisma.participant.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      conversationId: conversation.id,
      userId: admin.id,
    },
  });

  await prisma.participant.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: bot.id,
      },
    },
    update: {},
    create: {
      conversationId: conversation.id,
      userId: bot.id,
    },
  });

  // ─── 5. Welcome message ────────────────────────────────────────────────────
  const existingMsg = await prisma.message.findFirst({
    where: { conversationId: conversation.id },
  });

  if (!existingMsg) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: bot.id,
        body: "Hello! Welcome to OFA Sports. I'm your AI assistant. How can I assist you with court bookings, coaching, tournaments, or sports enquiries today?",
        kind: "TEXT",
        status: "SENT",
      },
    });
  }

  // ─── 6. SheetConnection (1 Google Sheet per organization) ───────────────────
  const sheetConnection = await prisma.sheetConnection.upsert({
    where: { id: "ofa-sheet-001" },
    update: {},
    create: {
      id: "ofa-sheet-001",
      tenantId: tenant.id,
      spreadsheetId: "REPLACE_WITH_YOUR_SPREADSHEET_ID",
      sheetName: "Bookings",
      authMode: SheetAuthMode.SERVICE_ACCOUNT,
      columns: [
        { name: "customer_name", label: "Customer Name", description: "Name of customer", required: true },
        { name: "phone_number", label: "Phone Number", description: "Contact number", required: false },
        { name: "enquiry", label: "Enquiry", description: "Enquiry or booking details", required: true },
      ],
    },
  });
  console.log(`✅ SheetConnection: spreadsheet "${sheetConnection.spreadsheetId}" (${sheetConnection.sheetName})`);

  console.log("\n✅ OFA Sports seeding complete!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
