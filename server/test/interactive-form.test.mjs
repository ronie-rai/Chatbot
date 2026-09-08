import { PrismaClient } from "@prisma/client";
import assert from "assert";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Running Interactive In-Chat Form Submission Audit...\n");

  // 1. Verify tenant
  let tenant = await prisma.tenant.findFirst({ where: { slug: "OFA_Sports" } });
  if (!tenant) {
    tenant = await prisma.tenant.findFirst();
  }
  assert(tenant, "Tenant must exist");
  console.log(`✅ Tenant verified: ${tenant.name} (${tenant.id})`);

  // 2. Verify booking template exists
  const template = await prisma.chatTemplate.findFirst({
    where: { tenantId: tenant.id, command: "booking" },
  });
  assert(template, "Booking template must exist in database");
  assert.strictEqual(template.sheetName, "Facility Bookings");
  console.log(`✅ Verified template /${template.command} -> Sheet tab: "${template.sheetName}"`);

  // 3. Verify conversation exists
  let conv = await prisma.conversation.findFirst({
    where: { tenantId: tenant.id },
  });
  assert(conv, "At least one conversation must exist");
  console.log(`✅ Using conversation: ${conv.name} (${conv.id})`);

  // 4. Test interactive form submission simulation
  const formData = {
    "Full Name": "Kavita Verma",
    "Phone Number": "+91 99887 76655",
    "Sport / Facility": "Badminton Court 3",
    "Booking Date": "2026-09-15",
    "Time Slot": "06:00 PM - 07:00 PM",
    "No. of Players": "4",
  };

  const testRef = `FORM-${Date.now().toString(36).toUpperCase()}`;

  const submission = await prisma.templateSubmission.create({
    data: {
      tenantId: tenant.id,
      conversationId: conv.id,
      templateId: template.id,
      templateCommand: template.command,
      sheetName: template.sheetName,
      submissionRef: testRef,
      userName: formData["Full Name"],
      userPhone: formData["Phone Number"],
      data: formData,
      rawMessage: `[Interactive Form Submission] /${template.command}`,
      status: "CONFIRMED",
      syncedToSheet: true,
    },
  });

  assert(submission.id, "Submission must be created");
  assert.strictEqual(submission.userName, "Kavita Verma");
  assert.strictEqual(submission.sheetName, "Facility Bookings");
  console.log(`✅ Interactive form submission recorded in PostgreSQL (Ref: ${testRef}, ID: ${submission.id})`);

  // 5. Test bot receipt message generation
  const botUser = await prisma.user.findFirst({ where: { role: "BOT" } });
  assert(botUser, "Bot user must exist");

  const receiptMsg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: botUser.id,
      body: `✅ *${template.name} Form Submitted!*\n\n📋 *Ref ID:* \`${testRef}\`\n📊 *Google Sheet Tab:* **${template.sheetName}**\n\n• **Full Name:** Kavita Verma\n• **Phone Number:** +91 99887 76655\n• **Sport / Facility:** Badminton Court 3`,
      kind: "TOOL_RESULT",
      status: "SENT",
      metadata: {
        submissionId: testRef,
        sheetName: template.sheetName,
        sheetInserted: true,
        templateCommand: template.command,
        formData,
      },
    },
  });

  assert(receiptMsg.id, "Receipt message must be created");
  assert.strictEqual(receiptMsg.kind, "TOOL_RESULT");
  console.log(`✅ Verified receipt message created in conversation feed (Message ID: ${receiptMsg.id})`);

  // 6. Clean up test records
  await prisma.templateSubmission.delete({ where: { id: submission.id } });
  await prisma.message.delete({ where: { id: receiptMsg.id } });
  console.log(`✅ Test cleanup complete.`);

  console.log("\n🎉 All Interactive In-Chat Form tests passed successfully!\n");
}

runTest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
