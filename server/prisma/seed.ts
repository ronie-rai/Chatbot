/**
 * Prisma seed script — Phase 1
 *
 * Creates:
 *  - 1 Tenant:  "Acme Corp"
 *  - 2 Users:   alice (human) + chatbot (bot)
 *  - 1 Conversation: "AI Support" (kind=AI)
 *  - 2 Participants: alice + bot in the conversation
 *  - 1 SheetConnection: Acme's Google Sheet config with 3 extraction columns
 *
 * Run with:  npx prisma db seed
 */

import { PrismaClient, UserRole, ConversationKind, SheetAuthMode } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── 1. Tenant ─────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme-corp",
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── 2. Users ──────────────────────────────────────────────────────────────
  const alicePasswordHash = await bcrypt.hash("password123", 10);

  const alice = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "alice@acme.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Alice",
      email: "alice@acme.com",
      passwordHash: alicePasswordHash,
      role: UserRole.USER,
    },
  });
  console.log(`✅ User:  ${alice.name} <${alice.email}> (${alice.role})`);

  const bot = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "bot@acme.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Acme AI",
      email: "bot@acme.com",
      passwordHash: null, // bots don't log in
      role: UserRole.BOT,
      avatarUrl: null,
    },
  });
  console.log(`✅ User:  ${bot.name} <${bot.email}> (${bot.role})`);

  // ─── 3. Conversation ───────────────────────────────────────────────────────
  const conversation = await prisma.conversation.upsert({
    where: { id: "seed-conv-001" },
    update: {},
    create: {
      id: "seed-conv-001",
      tenantId: tenant.id,
      name: "AI Support",
      kind: ConversationKind.AI,
    },
  });
  console.log(`✅ Conversation: "${conversation.name}" (${conversation.kind})`);

  // ─── 4. Participants ───────────────────────────────────────────────────────
  const aliceParticipant = await prisma.participant.upsert({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: alice.id,
      },
    },
    update: {},
    create: {
      conversationId: conversation.id,
      userId: alice.id,
    },
  });
  console.log(`✅ Participant: ${alice.name} → ${conversation.name}`);

  const botParticipant = await prisma.participant.upsert({
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
  console.log(`✅ Participant: ${bot.name} → ${conversation.name}`);

  // ─── 5. Seed a welcome message ────────────────────────────────────────────
  const welcomeMsg = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: bot.id,
      body: "Hello! I'm Acme AI. How can I help you today? Feel free to share your name, contact number, and your enquiry — I'll make sure to capture all the details.",
      kind: "TEXT",
      status: "SENT",
    },
  });
  console.log(`✅ Message: welcome message from ${bot.name}`);

  // ─── 6. SheetConnection ────────────────────────────────────────────────────
  const sheetConnection = await prisma.sheetConnection.upsert({
    where: { id: "seed-sheet-001" },
    update: {},
    create: {
      id: "seed-sheet-001",
      tenantId: tenant.id,
      // Replace with your actual Google Spreadsheet ID in production
      spreadsheetId: "REPLACE_WITH_YOUR_SPREADSHEET_ID",
      sheetName: "Leads",
      authMode: SheetAuthMode.SERVICE_ACCOUNT,
      columns: [
        {
          name: "customer_name",
          label: "Customer Name",
          description: "Full name of the person enquiring",
          required: true,
        },
        {
          name: "phone_number",
          label: "Phone Number",
          description: "Contact phone number or mobile number",
          required: false,
        },
        {
          name: "enquiry",
          label: "Enquiry",
          description: "Nature of the customer's request or service needed",
          required: true,
        },
      ],
    },
  });
  console.log(`✅ SheetConnection: spreadsheet "${sheetConnection.spreadsheetId}" (${sheetConnection.sheetName})`);

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n📊 Seed summary:");
  console.log(`   Tenant ID:       ${tenant.id}`);
  console.log(`   Alice User ID:   ${alice.id}`);
  console.log(`   Bot User ID:     ${bot.id}`);
  console.log(`   Conversation ID: ${conversation.id}`);
  console.log(`   Sheet Conn ID:   ${sheetConnection.id}`);
  console.log("\n✅ Seeding complete!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
