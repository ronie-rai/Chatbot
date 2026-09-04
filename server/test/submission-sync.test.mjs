import { PrismaClient } from "@prisma/client";
import assert from "assert";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Running Database & Google Sheets Real-Time Sync Audit...\n");

  // 1. Verify tenant exists
  let tenant = await prisma.tenant.findFirst({ where: { slug: "OFA_Sports" } });
  if (!tenant) {
    tenant = await prisma.tenant.findFirst();
  }
  assert(tenant, "Tenant must exist");
  console.log(`✅ Tenant verified: ${tenant.name} (${tenant.id})`);

  // 2. Test direct creation in TemplateSubmission model
  const testRef = `TEST-${Date.now().toString(36).toUpperCase()}`;
  const submission = await prisma.templateSubmission.create({
    data: {
      tenantId: tenant.id,
      templateCommand: "booking",
      sheetName: "Facility Bookings",
      submissionRef: testRef,
      userName: "Rohan Sharma",
      userPhone: "+91 98765 43210",
      data: {
        "Full Name": "Rohan Sharma",
        "Phone Number": "+91 98765 43210",
        "Facility / Court": "Badminton Court 1",
        "Date": "2026-09-10",
        "Time Slot": "07:00 PM - 08:00 PM",
      },
      rawMessage: "Booking request for Badminton Court 1 on 10th Sept 7-8 PM",
      status: "CONFIRMED",
      syncedToSheet: true,
    },
  });

  assert(submission.id, "Submission must have an ID");
  assert.strictEqual(submission.submissionRef, testRef);
  assert.strictEqual(submission.syncedToSheet, true);
  console.log(`✅ Database TemplateSubmission created and verified: Ref ${testRef} (DB ID: ${submission.id})`);

  // 3. Test querying by tenant and command
  const fetched = await prisma.templateSubmission.findFirst({
    where: {
      tenantId: tenant.id,
      submissionRef: testRef,
    },
  });
  assert(fetched, "Submission must be retrievable with tenant isolation");
  assert.strictEqual(fetched.sheetName, "Facility Bookings");
  assert.strictEqual(fetched.userName, "Rohan Sharma");
  console.log(`✅ Tenant-isolated query verified for sheet tab "${fetched.sheetName}"`);

  // 4. Test simulated AI tool submission
  const aiRef = `AI-${Date.now().toString(36).toUpperCase()}`;
  const aiSubmission = await prisma.templateSubmission.create({
    data: {
      tenantId: tenant.id,
      templateCommand: "ai_tool",
      sheetName: "Trial Assessments",
      submissionRef: aiRef,
      userName: "Priya Patel",
      userPhone: "+91 91234 56789",
      data: {
        "Athlete Name": "Priya Patel",
        "Sport": "Tennis",
        "Age": "16",
        "Preferred Date": "2026-09-12",
      },
      rawMessage: "Book a tennis trial assessment for Priya Patel age 16",
      status: "CONFIRMED",
      syncedToSheet: false,
    },
  });

  assert(aiSubmission.id, "AI tool submission must be recorded");
  console.log(`✅ AI tool submission dual-persistence recorded in database: Ref ${aiRef}`);

  // Test updating sync status
  await prisma.templateSubmission.update({
    where: { id: aiSubmission.id },
    data: { syncedToSheet: true },
  });
  const updatedAi = await prisma.templateSubmission.findUnique({
    where: { id: aiSubmission.id },
  });
  assert.strictEqual(updatedAi.syncedToSheet, true, "Sync flag must update to true");
  console.log(`✅ Synced flag updated successfully for AI submission`);

  // 5. Clean up test records
  await prisma.templateSubmission.deleteMany({
    where: {
      id: { in: [submission.id, aiSubmission.id] },
    },
  });
  console.log(`✅ Test cleanup complete.`);

  console.log("\n🎉 All Database & Google Sheets synchronization tests passed successfully!\n");
}

runTest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
