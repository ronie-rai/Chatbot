import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("🧪 Testing Cross-Table Dropdown and Template Options Persistence...");

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("No tenant found");

  // 1. Fetch the booking template to verify source fields and options
  const bookingTpl = await prisma.chatTemplate.findFirst({
    where: { tenantId: tenant.id, command: "booking" },
  });

  if (!bookingTpl) throw new Error("Booking template not found");
  console.log("✅ Verified source template:", bookingTpl.name, `(/${bookingTpl.command})`);

  const sportField = (bookingTpl.fields || []).find((f) => f.key === "sport" || f.label === "Sport / Facility");
  if (!sportField || !Array.isArray(sportField.options)) {
    throw new Error("Source sport field or options not found in booking template");
  }
  console.log(`✅ Verified source options (${sportField.options.length} items):`, sportField.options.slice(0, 3));

  // 2. Create or update a test template linking to booking -> sport
  const testCommand = "test_membership_dropdown";
  await prisma.chatTemplate.deleteMany({
    where: { tenantId: tenant.id, command: testCommand },
  });

  const created = await prisma.chatTemplate.create({
    data: {
      tenantId: tenant.id,
      command: testCommand,
      name: "Test Cross-Table Template",
      sheetName: "Test Cross Table Records",
      icon: "🔗",
      fields: [
        {
          key: "member_name",
          label: "Member Name",
          type: "text",
          required: true,
        },
        {
          key: "selected_facility",
          label: "Assigned Facility",
          type: "dropdown",
          required: true,
          options: sportField.options,
          optionSource: "table",
          linkedTemplateCommand: "booking",
          linkedFieldKey: "sport",
        },
      ],
      promptMessage: "Testing cross-table dropdown linking",
    },
  });

  console.log("✅ Created test template with linked cross-table dropdown:", created.command);

  // 3. Retrieve and assert
  const retrieved = await prisma.chatTemplate.findFirst({
    where: { tenantId: tenant.id, command: testCommand },
  });

  if (!retrieved) throw new Error("Could not retrieve test template");
  const linkedField = (retrieved.fields || []).find((f) => f.key === "selected_facility");
  if (!linkedField) throw new Error("Linked field not found in retrieved template");
  if (linkedField.type !== "dropdown") throw new Error("Field type is not dropdown");
  if (linkedField.optionSource !== "table") throw new Error("optionSource is not table");
  if (linkedField.linkedTemplateCommand !== "booking") throw new Error("linkedTemplateCommand mismatch");
  if (linkedField.linkedFieldKey !== "sport") throw new Error("linkedFieldKey mismatch");
  if (!Array.isArray(linkedField.options) || linkedField.options.length !== sportField.options.length) {
    throw new Error("Extracted options count mismatch");
  }

  console.log("✅ Verified retrieved linked field properties:", {
    key: linkedField.key,
    type: linkedField.type,
    optionSource: linkedField.optionSource,
    linkedTemplateCommand: linkedField.linkedTemplateCommand,
    linkedFieldKey: linkedField.linkedFieldKey,
    optionsCount: linkedField.options.length,
  });

  // 4. Cleanup
  await prisma.chatTemplate.deleteMany({
    where: { tenantId: tenant.id, command: testCommand },
  });

  console.log("🧹 Cleaned up test template.");
  console.log("🎉 Cross-Table Dropdown verification test PASSED successfully!");
}

run()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
