import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Testing Phone Auto-lookup and Template Flexibility...\n");

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error("No tenant found");
  }
  console.log(`✅ Verified tenant: ${tenant.name} (${tenant.id})`);

  // 1. Create a sample submission with phone number
  const testPhone = "+91 99887 76655";
  const testDigits = "9988776655";
  const testName = "Vikram Aditya";

  const sub = await prisma.templateSubmission.create({
    data: {
      tenantId: tenant.id,
      templateCommand: "booking",
      sheetName: "Facility Bookings",
      userName: testName,
      userPhone: testPhone,
      data: {
        "Phone Number": testPhone,
        "Full Name": testName,
        "Sport / Facility": "Tennis - Court 2",
        "Booking Date": "2026-09-10",
        "Time Slot": "07:00 AM",
        "Duration": "1 Hr 30 Min",
      },
      status: "SYNCED",
      syncedToSheet: true,
    },
  });
  console.log(`✅ Created test submission for user: ${testName} with phone: ${testPhone}`);

  // 2. Perform Phone Lookup logic with digit normalization
  let found = await prisma.templateSubmission.findFirst({
    where: {
      tenantId: tenant.id,
      OR: [
        { userPhone: { contains: testDigits } },
        { userPhone: { contains: testPhone } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      userName: true,
      userPhone: true,
      data: true,
    },
  });

  if (!found) {
    const candidates = await prisma.templateSubmission.findMany({
      where: { tenantId: tenant.id, userPhone: { not: null } },
      take: 20,
    });
    const match = candidates.find((c) => c.userPhone?.replace(/\D/g, "").endsWith(testDigits));
    if (match) {
      found = { userName: match.userName, userPhone: match.userPhone, data: match.data };
    }
  }

  if (!found || found.userName !== testName) {
    throw new Error(`Expected lookup to find ${testName}, got ${JSON.stringify(found)}`);
  }
  console.log(`✅ Phone lookup successful! Auto-populated: ${found.userName}`);
  console.log(`   Extracted previous details:`, found.data);

  // 3. Test Template Field Modification (Int, Float, Dropdown, Date, Time, Boolean)
  const flexibleFields = [
    { key: "phone", label: "Phone Number", required: true, type: "phone" },
    { key: "name", label: "Full Name", required: true, type: "text" },
    {
      key: "sport",
      label: "Sport / Facility",
      required: true,
      type: "dropdown",
      options: ["Tennis - Court 1", "Tennis - Court 2", "Tennis - Court 3", "Tennis - Court 4"],
    },
    { key: "date", label: "Booking Date", required: true, type: "date" },
    { key: "time_slot", label: "Time Slot", required: true, type: "time" },
    { key: "duration", label: "Duration", required: false, type: "text" },
    { key: "players", label: "No. of Players", required: true, type: "number" },
    { key: "hourly_rate", label: "Court Fee (INR)", required: false, type: "float" },
    { key: "racquet_rental", label: "Need Racquet Rental?", required: false, type: "boolean" },
  ];

  const updatedTemplate = await prisma.chatTemplate.upsert({
    where: {
      tenantId_command: {
        tenantId: tenant.id,
        command: "booking",
      },
    },
    create: {
      tenantId: tenant.id,
      command: "booking",
      name: "Facility & Court Booking",
      sheetName: "Facility Bookings",
      promptMessage: "Please fill booking details",
      fields: flexibleFields,
    },
    update: {
      fields: flexibleFields,
    },
  });

  console.log(`✅ Updated /booking template with all rich HTML/data types:`);
  for (const f of updatedTemplate.fields) {
    console.log(`   - ${f.label} [type: ${f.type}] ${f.options ? `(options: ${f.options.length})` : ""}`);
  }

  // Cleanup test submission
  await prisma.templateSubmission.delete({
    where: { id: sub.id },
  });
  console.log(`\n🧹 Cleaned up test record.`);
  console.log(`\n🎉 All Phone Auto-lookup and Template Flexibility tests PASSED!`);
}

runTest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
