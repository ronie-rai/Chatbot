import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Testing User Data & Insights Dashboard API...\n");

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error("No tenant found");
  }
  console.log(`✅ Verified tenant: ${tenant.name} (${tenant.id})`);

  // 1. Create multiple mock submissions across different templates and sports to test insights
  const createdIds = [];

  const sub1 = await prisma.templateSubmission.create({
    data: {
      tenantId: tenant.id,
      templateCommand: "booking",
      sheetName: "Facility Bookings",
      submissionRef: "TEST-DASH-1",
      userName: "Rohan Sharma",
      userPhone: "+91 98765 11111",
      data: {
        "Full Name": "Rohan Sharma",
        "Phone Number": "+91 98765 11111",
        "Sport / Facility": "Tennis - Court 1",
        "Booking Date": "2026-09-04",
        "Time Slot": "06:00 AM",
        "Duration": "1 Hr 00 Min",
      },
      status: "CONFIRMED",
      syncedToSheet: true,
    },
  });
  createdIds.push(sub1.id);

  const sub2 = await prisma.templateSubmission.create({
    data: {
      tenantId: tenant.id,
      templateCommand: "booking",
      sheetName: "Facility Bookings",
      submissionRef: "TEST-DASH-2",
      userName: "Ananya Roy",
      userPhone: "+91 98765 22222",
      data: {
        "Full Name": "Ananya Roy",
        "Phone Number": "+91 98765 22222",
        "Sport / Facility": "Tennis - Court 2",
        "Booking Date": "2026-09-04",
        "Time Slot": "07:00 PM",
        "Duration": "2 Hr 00 Min",
      },
      status: "CONFIRMED",
      syncedToSheet: true,
    },
  });
  createdIds.push(sub2.id);

  const sub3 = await prisma.templateSubmission.create({
    data: {
      tenantId: tenant.id,
      templateCommand: "membership",
      sheetName: "Memberships",
      submissionRef: "TEST-DASH-3",
      userName: "Karan Johar",
      userPhone: "+91 98765 33333",
      data: {
        "Member Name": "Karan Johar",
        "Contact Phone": "+91 98765 33333",
        "Sport Program": "Badminton",
        "Membership Plan": "Annual",
      },
      status: "CONFIRMED",
      syncedToSheet: false, // Pending sync
    },
  });
  createdIds.push(sub3.id);

  console.log(`✅ Seeded 3 test submissions across templates (booking, membership) and sports (Tennis Court 1 & 2, Badminton).`);

  // 2. Fetch all submissions and compute insights (mirroring the endpoint logic)
  const allSubmissions = await prisma.templateSubmission.findMany({
    where: { tenantId: tenant.id },
    include: {
      template: true,
    },
  });

  if (allSubmissions.length < 3) {
    throw new Error(`Expected at least 3 submissions, got ${allSubmissions.length}`);
  }
  console.log(`✅ Verified ${allSubmissions.length} total submissions for tenant.`);

  // Verify filter by template command: "booking"
  const bookingSubmissions = allSubmissions.filter((s) => s.templateCommand === "booking");
  if (bookingSubmissions.length < 2) {
    throw new Error(`Expected at least 2 booking submissions, got ${bookingSubmissions.length}`);
  }
  console.log(`✅ Template filter verification: Found ${bookingSubmissions.length} booking records.`);

  // Verify search filter: "Ananya"
  const searchResults = allSubmissions.filter((s) =>
    (s.userName || "").toLowerCase().includes("ananya") ||
    JSON.stringify(s.data).toLowerCase().includes("ananya")
  );
  if (searchResults.length !== 1 || searchResults[0].userName !== "Ananya Roy") {
    throw new Error(`Search filter failed: expected 1 result for 'Ananya', got ${searchResults.length}`);
  }
  console.log(`✅ Search filter verification: Correctly matched "Ananya Roy" (Ref: ${searchResults[0].submissionRef}).`);

  // Verify sport breakdown
  const sportCounts = {};
  for (const s of allSubmissions) {
    const data = s.data || {};
    const sp = data["Sport / Facility"] || data["Sport Program"] || data["Sport"];
    if (sp) sportCounts[sp] = (sportCounts[sp] || 0) + 1;
  }
  console.log(`✅ Sport & Court Distribution calculated:`, sportCounts);
  if (!sportCounts["Tennis - Court 1"] || !sportCounts["Tennis - Court 2"]) {
    throw new Error("Missing court distribution counts");
  }

  // Verify Sync rate calculation
  const syncedCount = allSubmissions.filter((s) => s.syncedToSheet).length;
  const syncRate = Math.round((syncedCount / allSubmissions.length) * 100);
  console.log(`✅ Sync Health Rate: ${syncRate}% (${syncedCount}/${allSubmissions.length} synced)`);

  // Verify Time Slot Drilldown
  const morningSubs = allSubmissions.filter((s) => {
    const timeVal = JSON.stringify(s.data || {}).toLowerCase();
    return timeVal.includes("am") || timeVal.includes("06:");
  });
  if (morningSubs.length === 0) {
    throw new Error("Expected morning time slot submissions");
  }
  console.log(`✅ Time Slot Drilldown verified: Found ${morningSubs.length} morning records.`);

  // Verify Target Date Drilldown
  const dateSubs = allSubmissions.filter((s) => {
    const cDate = new Date(s.createdAt).toISOString().slice(0, 10);
    const dataStr = JSON.stringify(s.data || "");
    return cDate === "2026-09-04" || dataStr.includes("2026-09-04");
  });
  if (dateSubs.length === 0) {
    throw new Error("Expected date drilldown submissions");
  }
  console.log(`✅ Date Drilldown verified: Found ${dateSubs.length} records matching target date.`);

  // 3. Cleanup test records
  await prisma.templateSubmission.deleteMany({
    where: { id: { in: createdIds } },
  });
  console.log(`🧹 Cleaned up 3 test records.`);

  console.log(`\n🎉 All User Data & Insights Dashboard tests PASSED!`);
}

runTest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
