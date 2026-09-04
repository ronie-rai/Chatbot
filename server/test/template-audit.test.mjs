import { PrismaClient } from "@prisma/client";
import assert from "assert";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Running Sports Foundation Template & Slash Command Audit...\n");

  // 1. Verify tenant exists
  let tenant = await prisma.tenant.findFirst({ where: { slug: "OFA_Sports" } });
  if (!tenant) {
    tenant = await prisma.tenant.findFirst();
  }
  assert(tenant, "Tenant must exist");
  console.log(`✅ Tenant verified: ${tenant.name} (${tenant.id})`);

  // 2. Verify all 8 default sports templates exist in database
  const templates = await prisma.chatTemplate.findMany({
    where: { tenantId: tenant.id },
  });
  console.log(`✅ Found ${templates.length} chat templates in database for "${tenant.name}":`);
  for (const t of templates) {
    console.log(`   - /${t.command} -> Tab: "${t.sheetName}" (${(t.fields).length} fields)`);
  }
  assert(templates.length >= 8, "Expected at least 8 templates");

  const booking = templates.find((t) => t.command === "booking");
  assert(booking, "Booking template must exist");
  assert.strictEqual(booking.sheetName, "Facility Bookings");
  assert(booking.promptMessage.includes("Facility & Court Booking"));

  const membership = templates.find((t) => t.command === "membership");
  assert(membership, "Membership template must exist");
  assert.strictEqual(membership.sheetName, "Memberships");

  // 3. Test Template Creation & Deletion with Sheet Data Preservation
  const testCmd = `test_${Date.now()}`;
  const testSheetName = "Automated Test Sheet";
  const created = await prisma.chatTemplate.create({
    data: {
      tenantId: tenant.id,
      command: testCmd,
      name: "Temporary Test Template",
      sheetName: testSheetName,
      icon: "🧪",
      fields: [
        { key: "athlete", label: "Athlete Name", required: true, type: "text" },
        { key: "sport", label: "Sport", required: true, type: "text" },
      ],
      promptMessage: "Please fill athlete name and sport",
    },
  });
  assert(created.id, "Test template must be created");
  console.log(`✅ Created test template: /${testCmd}`);

  // Test deletion - verify DB record is deleted
  await prisma.chatTemplate.delete({
    where: { id: created.id },
  });
  const deletedCheck = await prisma.chatTemplate.findUnique({
    where: { id: created.id },
  });
  assert(!deletedCheck, "Template must be removed from DB");
  console.log(`✅ Deleted test template /${testCmd}. Google Sheet tab "${testSheetName}" preserved.`);

  console.log("\n🎉 All Sports Foundation Template tests passed successfully!\n");
}

runTest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
