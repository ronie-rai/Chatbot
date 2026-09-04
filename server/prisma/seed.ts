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
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "OFA@SuperAdmin2026";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@ofa-sports.com" } },
    update: { passwordHash: adminPasswordHash },
    create: {
      tenantId: tenant.id,
      name: "Admin",
      email: "admin@ofa-sports.com",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ User:  ${admin.name} <${admin.email}> (${admin.role})`);

  const demoPassword = process.env.DEMO_USER_PASSWORD || "demo@user123";
  const demoPasswordHash = await bcrypt.hash(demoPassword, 10);

  const demoUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "demo@ofa-sports.com" } },
    update: { passwordHash: demoPasswordHash },
    create: {
      tenantId: tenant.id,
      name: "Demo User",
      email: "demo@ofa-sports.com",
      passwordHash: demoPasswordHash,
      role: UserRole.USER,
    },
  });
  console.log(`✅ User:  ${demoUser.name} <${demoUser.email}> (${demoUser.role})`);

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
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      conversationId: conversation.id,
      userId: demoUser.id,
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

  // ─── 7. Default Sports Foundation Templates ────────────────────────────────
  const sportsTemplates = [
    {
      command: "booking",
      name: "Facility & Court Booking",
      description: "Reserve badminton courts, football turf, cricket nets, or gym slots",
      sheetName: "Facility Bookings",
      icon: "🏟️",
      fields: [
        { key: "name", label: "Full Name", required: true, type: "text" },
        { key: "phone", label: "Phone Number", required: true, type: "phone" },
        { key: "sport", label: "Sport / Facility", required: true, type: "text" },
        { key: "date", label: "Booking Date", required: true, type: "date" },
        { key: "time_slot", label: "Time Slot", required: true, type: "text" },
        { key: "duration", label: "Duration", required: false, type: "text" },
        { key: "players", label: "No. of Players", required: false, type: "number" },
        { key: "notes", label: "Special Requests", required: false, type: "text" },
      ],
      promptMessage: "🏟️ *Facility & Court Booking*\n_Reserve badminton courts, football turf, cricket nets, or gym slots_\n\nPlease copy, fill, and reply with the details below:\n• **Full Name** *(Required)*\n• **Phone Number** *(Required)*\n• **Sport / Facility** *(Required)*\n• **Booking Date** *(Required)*\n• **Time Slot** *(Required)*\n• **Duration** *(Optional)*\n• **No. of Players** *(Optional)*\n• **Special Requests** *(Optional)*",
    },
    {
      command: "membership",
      name: "Academy & Club Membership",
      description: "Register for ongoing sports foundation training batches and memberships",
      sheetName: "Memberships",
      icon: "🏅",
      fields: [
        { key: "name", label: "Member Name", required: true, type: "text" },
        { key: "guardian", label: "Guardian / Parent Name", required: false, type: "text" },
        { key: "phone", label: "Contact Phone", required: true, type: "phone" },
        { key: "email", label: "Email Address", required: false, type: "text" },
        { key: "sport", label: "Sport Program", required: true, type: "text" },
        { key: "tier", label: "Membership Plan", required: true, type: "choice" },
        { key: "start_date", label: "Preferred Start Date", required: true, type: "date" },
      ],
      promptMessage: "🏅 *Academy & Club Membership*\n_Register for ongoing sports foundation training batches and memberships_\n\nPlease reply with the details below:\n• **Member Name** *(Required)*\n• **Contact Phone** *(Required)*\n• **Sport Program** *(Required)*\n• **Membership Plan** *(Required)*\n• **Preferred Start Date** *(Required)*",
    },
    {
      command: "trial",
      name: "Free Assessment & Trial Session",
      description: "Book an athlete skills evaluation or trial training session",
      sheetName: "Trial Assessments",
      icon: "⚡",
      fields: [
        { key: "name", label: "Athlete Name", required: true, type: "text" },
        { key: "age", label: "Age / Category", required: true, type: "text" },
        { key: "phone", label: "Contact Phone", required: true, type: "phone" },
        { key: "sport", label: "Sport of Interest", required: true, type: "text" },
        { key: "skill_level", label: "Experience Level", required: true, type: "choice" },
        { key: "preferred_date", label: "Preferred Trial Date", required: true, type: "date" },
      ],
      promptMessage: "⚡ *Free Assessment & Trial Session*\n_Book an athlete skills evaluation or trial training session_\n\nPlease reply with:\n• **Athlete Name** *(Required)*\n• **Age / Category** *(Required)*\n• **Contact Phone** *(Required)*\n• **Sport of Interest** *(Required)*\n• **Experience Level** *(Required)*\n• **Preferred Trial Date** *(Required)*",
    },
    {
      command: "tournament",
      name: "Tournament & Event Entry",
      description: "Register for upcoming foundation leagues, matches, and tournaments",
      sheetName: "Tournament Entries",
      icon: "🏆",
      fields: [
        { key: "team_or_player", label: "Team / Player Name", required: true, type: "text" },
        { key: "captain_phone", label: "Contact Phone", required: true, type: "phone" },
        { key: "event_name", label: "Tournament / Event Name", required: true, type: "text" },
        { key: "category", label: "Age Category / Division", required: true, type: "text" },
      ],
      promptMessage: "🏆 *Tournament & Event Entry*\nPlease reply with:\n• **Team / Player Name** *(Required)*\n• **Contact Phone** *(Required)*\n• **Tournament / Event Name** *(Required)*\n• **Age Category / Division** *(Required)*",
    },
    {
      command: "equipment",
      name: "Sports Kit & Gear Requisition",
      description: "Request foundation sports gear, kits, balls, or protective equipment",
      sheetName: "Equipment Requests",
      icon: "🎽",
      fields: [
        { key: "requested_by", label: "Student / Coach Name", required: true, type: "text" },
        { key: "sport", label: "Sport Department", required: true, type: "text" },
        { key: "gear_item", label: "Gear / Kit Requested", required: true, type: "text" },
        { key: "quantity", label: "Quantity", required: true, type: "number" },
        { key: "issue_date", label: "Required Date", required: true, type: "date" },
      ],
      promptMessage: "🎽 *Sports Kit & Gear Requisition*\nPlease reply with:\n• **Student / Coach Name** *(Required)*\n• **Sport Department** *(Required)*\n• **Gear / Kit Requested** *(Required)*\n• **Quantity** *(Required)*\n• **Required Date** *(Required)*",
    },
    {
      command: "coaching",
      name: "1-on-1 Coaching Consultation",
      description: "Schedule private high-performance coaching or fitness consultation",
      sheetName: "Coaching Enquiries",
      icon: "🏋️",
      fields: [
        { key: "name", label: "Trainee Name", required: true, type: "text" },
        { key: "phone", label: "Contact Phone", required: true, type: "phone" },
        { key: "sport", label: "Target Sport", required: true, type: "text" },
        { key: "skill_level", label: "Current Level", required: true, type: "choice" },
        { key: "goals", label: "Focus / Goals", required: true, type: "text" },
      ],
      promptMessage: "🏋️ *1-on-1 Coaching Consultation*\nPlease reply with:\n• **Trainee Name** *(Required)*\n• **Contact Phone** *(Required)*\n• **Target Sport** *(Required)*\n• **Current Level** *(Required)*\n• **Focus / Goals** *(Required)*",
    },
    {
      command: "feedback",
      name: "Athlete & Parent Feedback",
      description: "Submit feedback, coaching reviews, or facility improvement suggestions",
      sheetName: "Feedback & Grievances",
      icon: "💬",
      fields: [
        { key: "name", label: "Your Name", required: true, type: "text" },
        { key: "category", label: "Feedback Category", required: true, type: "choice" },
        { key: "rating", label: "Overall Rating (1 to 5)", required: true, type: "number" },
        { key: "comments", label: "Comments & Suggestions", required: true, type: "text" },
      ],
      promptMessage: "💬 *Athlete & Parent Feedback*\nPlease reply with:\n• **Your Name** *(Required)*\n• **Feedback Category** *(Required)*\n• **Overall Rating (1 to 5)** *(Required)*\n• **Comments & Suggestions** *(Required)*",
    },
    {
      command: "sponsor",
      name: "Foundation Grant & Sponsorship",
      description: "Partner with our sports foundation to sponsor athletes, equipment, or events",
      sheetName: "Sponsorships & Grants",
      icon: "🤝",
      fields: [
        { key: "sponsor_name", label: "Sponsor / Organization", required: true, type: "text" },
        { key: "contact_person", label: "Contact Person", required: true, type: "text" },
        { key: "contact_phone", label: "Phone / WhatsApp", required: true, type: "phone" },
        { key: "program", label: "Supported Sport / Athlete", required: true, type: "text" },
        { key: "contribution", label: "Contribution / Grant Amount", required: true, type: "text" },
      ],
      promptMessage: "🤝 *Foundation Grant & Sponsorship*\nPlease reply with:\n• **Sponsor / Organization** *(Required)*\n• **Contact Person** *(Required)*\n• **Phone / WhatsApp** *(Required)*\n• **Supported Sport / Athlete** *(Required)*\n• **Contribution / Grant Amount** *(Required)*",
    },
  ];

  for (const tpl of sportsTemplates) {
    await prisma.chatTemplate.upsert({
      where: { tenantId_command: { tenantId: tenant.id, command: tpl.command } },
      update: {
        name: tpl.name,
        description: tpl.description,
        sheetName: tpl.sheetName,
        icon: tpl.icon,
        fields: tpl.fields,
        promptMessage: tpl.promptMessage,
      },
      create: {
        tenantId: tenant.id,
        command: tpl.command,
        name: tpl.name,
        description: tpl.description,
        sheetName: tpl.sheetName,
        icon: tpl.icon,
        fields: tpl.fields,
        promptMessage: tpl.promptMessage,
      },
    });
  }
  console.log(`✅ Seeded 8 sports templates for tenant "${tenant.name}"`);

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
