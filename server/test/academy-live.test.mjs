/**
 * Academy LIVE integration tests.
 * Runs against a locally running server (default http://localhost:3000) and the configured database.
 * Safety: creates a TEMPORARY tenant ("zz-acad-test-*"), never touches existing tenants, and deletes
 * everything it created afterwards. (Audit rows are append-only by design and remain, tagged with the
 * temporary tenant id.)
 *
 * Run (from /server):  node test/academy-live.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const file = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnv();

const BASE = process.env.TEST_API_URL || "http://localhost:3000";
const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production");
const prisma = new PrismaClient();
const stamp = Date.now();

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.error(`  FAIL: ${msg}`); failed++; }
}

async function token(user, tenantId) {
  return new SignJWT({ sub: user.id, tenantId, role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);
}

async function api(method, url, tok, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

const created = { tenantIds: [] };

async function mkTenant(label, enabled) {
  const t = await prisma.tenant.create({ data: { name: `ZZ Test ${label}`, slug: `zz-acad-test-${label}-${stamp}` } });
  created.tenantIds.push(t.id);
  if (enabled) {
    await prisma.systemSetting.create({ data: { key: `academy.enabled.${t.id}`, value: "true" } });
  }
  return t;
}
async function mkUser(tenantId, name, role) {
  return prisma.user.create({
    data: { tenantId, name, email: `${name.toLowerCase().replace(/\s+/g, "")}-${stamp}@zz-test.local`, role: "USER" },
  }).then((u) => ({ ...u, role }));
}
async function member(tenantId, userId, role) {
  return prisma.academyMembership.create({ data: { tenantId, userId, role } });
}

async function cleanup() {
  for (const tenantId of created.tenantIds) {
    try {
      await prisma.academyAnnouncementRead.deleteMany({ where: { announcement: { tenantId } } }).catch(() => {});
      await prisma.academyAnnouncement.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyNotificationDelivery.deleteMany({ where: { notification: { tenantId } } }).catch(() => {});
      await prisma.academyNotification.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyNotificationRule.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyAssessmentResult.deleteMany({ where: { assessment: { tenantId } } }).catch(() => {});
      await prisma.academyAssessment.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyAssessmentTemplate.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyItemAllocation.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyItemType.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyReceipt.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyPaymentAllocation.deleteMany({ where: { payment: { tenantId } } }).catch(() => {});
      await prisma.academyPayment.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyFeeAdjustment.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyInvoiceLine.deleteMany({ where: { invoice: { tenantId } } }).catch(() => {});
      await prisma.academyInvoice.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyPlayerFeeAssignment.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyFeePlan.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyBooking.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyFacilityHour.deleteMany({ where: { facility: { tenantId } } }).catch(() => {});
      await prisma.academyFacilityClosure.deleteMany({ where: { facility: { tenantId } } }).catch(() => {});
      await prisma.academyFacility.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.academyAttendanceCorrection.deleteMany({ where: { attendance: { tenantId } } }).catch(() => {});
      await prisma.academyAttendance.deleteMany({ where: { tenantId } });
      await prisma.academySession.deleteMany({ where: { tenantId } });
      await prisma.academyBatchEnrollment.deleteMany({ where: { batch: { tenantId } } }).catch(() => {});
      await prisma.academyBatch.deleteMany({ where: { tenantId } });
      await prisma.academyPlayerSport.deleteMany({ where: { player: { tenantId } } }).catch(() => {});
      await prisma.academyPlayer.deleteMany({ where: { tenantId } });
      await prisma.academySport.deleteMany({ where: { tenantId } });
      await prisma.academyPlayerCounter.deleteMany({ where: { tenantId } });
      await prisma.academyRolePermission.deleteMany({ where: { tenantId } });
      await prisma.systemSetting.deleteMany({ where: { key: `academy.enabled.${tenantId}` } });
      await prisma.tenant.delete({ where: { id: tenantId } }); // cascades users + memberships
    } catch (e) {
      console.error(`  cleanup warning for ${tenantId}:`, e.message);
    }
  }
}

async function run() {
  console.log(`Target: ${BASE}\n`);

  // Server reachable?
  const health = await api("GET", "/api/health");
  if (health.status !== 200) throw new Error(`Server not reachable at ${BASE} (health=${health.status})`);

  // ── Fixtures ──────────────────────────────────────────────────────────────
  const A = await mkTenant("a", true);
  const B = await mkTenant("b", true);
  const OFF = await mkTenant("off", false);
  const owner = await mkUser(A.id, "Owner One", "USER");
  const manager = await mkUser(A.id, "Manager One", "USER");
  const coach = await mkUser(A.id, "Coach One", "USER");
  const accounts = await mkUser(A.id, "Accounts One", "USER");
  const guardian = await mkUser(A.id, "Guardian One", "USER");
  const outsider = await mkUser(A.id, "No Membership", "USER");
  const ownerB = await mkUser(B.id, "Owner Bee", "USER");
  const userOff = await mkUser(OFF.id, "User Off", "USER");
  await member(A.id, owner.id, "OWNER");
  await member(A.id, manager.id, "MANAGER");
  await member(A.id, coach.id, "COACH");
  await member(A.id, accounts.id, "ACCOUNTS");
  await member(A.id, guardian.id, "GUARDIAN");
  await member(B.id, ownerB.id, "OWNER");

  const t = {
    owner: await token(owner, A.id),
    manager: await token(manager, A.id),
    coach: await token(coach, A.id),
    accounts: await token(accounts, A.id),
    guardian: await token(guardian, A.id),
    outsider: await token(outsider, A.id),
    ownerB: await token(ownerB, B.id),
    off: await token(userOff, OFF.id),
  };

  // ── 1. Authentication & feature flag ─────────────────────────────────────
  console.log("1. Authentication & feature flag");
  assert((await api("GET", "/api/academy/me")).status === 401, "no token → 401");
  assert((await api("GET", "/api/academy/me", "garbage.token.value")).status === 401, "invalid token → 401");
  const offMe = await api("GET", "/api/academy/me", t.off);
  assert(offMe.status === 200 && offMe.json.data.enabled === false, "tenant with module off → enabled:false");
  const outMe = await api("GET", "/api/academy/me", t.outsider);
  assert(outMe.status === 200 && outMe.json.data.enabled === false, "user without membership → enabled:false");
  assert((await api("GET", "/api/academy/players", t.off)).status === 403, "module off → players API denied");

  // ── 2. Role-aware profile ────────────────────────────────────────────────
  console.log("\n2. Role-aware navigation");
  const ownerMe = (await api("GET", "/api/academy/me", t.owner)).json.data;
  assert(ownerMe.enabled && ownerMe.role === "OWNER" && ownerMe.navigation.some((m) => m.id === "audit"), "owner sees audit module");
  const coachMe = (await api("GET", "/api/academy/me", t.coach)).json.data;
  const coachNav = coachMe.navigation.map((m) => m.id);
  assert(coachNav.includes("attendance") && !coachNav.includes("payments") && !coachNav.includes("users"), "coach nav excludes finance/users");
  const gMe = (await api("GET", "/api/academy/me", t.guardian)).json.data;
  assert(gMe.navigation.length === 1 && gMe.navigation[0].id === "portal", "guardian sees portal only");

  // ── 3. Sports master ─────────────────────────────────────────────────────
  console.log("\n3. Sports master");
  assert((await api("POST", "/api/academy/sports", t.coach, { name: "Chess" })).status === 403, "coach cannot create sport (403)");
  const s1 = await api("POST", "/api/academy/sports", t.owner, { name: "Cricket", defaultBillingMethod: "PER_SESSION" });
  assert(s1.status === 201, "owner creates sport");
  const s2 = await api("POST", "/api/academy/sports", t.owner, { name: "Football" });
  assert(s2.status === 201, "owner creates second sport");
  assert((await api("POST", "/api/academy/sports", t.owner, { name: "Cricket" })).status === 409, "duplicate sport → 409");
  assert((await api("POST", "/api/academy/sports", t.owner, { name: "" })).status === 400, "empty sport name → 400");
  assert((await api("POST", "/api/academy/sports", t.owner, { name: "X", defaultBillingMethod: "BAD" })).status === 400, "bad billing method → 400");
  const sportList = await api("GET", "/api/academy/sports", t.coach);
  assert(sportList.status === 200 && sportList.json.data.length === 2, "coach can read sports list (dropdown source)");
  const sB = await api("POST", "/api/academy/sports", t.ownerB, { name: "Cricket" });
  assert(sB.status === 201, "other tenant may reuse the same sport name");
  assert((await api("GET", "/api/academy/sports", t.owner)).json.data.length === 2, "tenant isolation: A still sees only its 2 sports");
  const patch = await api("PATCH", `/api/academy/sports/${s2.json.data.id}`, t.owner, { active: false });
  assert(patch.status === 200 && patch.json.data.active === false, "owner deactivates sport");
  assert((await api("GET", "/api/academy/sports", t.owner)).json.data.length === 1, "inactive sport hidden from dropdown");
  assert((await api("GET", "/api/academy/sports?includeInactive=1", t.owner)).json.data.length === 2, "includeInactive shows it");
  assert((await api("PATCH", `/api/academy/sports/${sB.json.data.id}`, t.owner, { active: false })).status === 404, "cannot patch another tenant's sport (404)");
  await api("PATCH", `/api/academy/sports/${s2.json.data.id}`, t.owner, { active: true });

  // ── 4. Player admission ──────────────────────────────────────────────────
  console.log("\n4. Player admission");
  const goodPlayer = {
    name: "Aarav Sharma", dateOfBirth: "2014-05-20", guardianName: "Neha Sharma",
    guardianPhone: "+91 98765 43210", joiningDate: "2026-04-01", startTime: "17:00", endTime: "18:30",
    sportIds: [s1.json.data.id, s2.json.data.id],
  };
  assert((await api("POST", "/api/academy/players", t.accounts, goodPlayer)).status === 403, "accounts cannot admit players (403)");
  const missing = { ...goodPlayer }; delete missing.guardianName;
  assert((await api("POST", "/api/academy/players", t.owner, missing)).status === 400, "missing essential field → 400");
  assert((await api("POST", "/api/academy/players", t.owner, { ...goodPlayer, sportIds: [] })).status === 400, "no sport selected → 400");
  assert((await api("POST", "/api/academy/players", t.owner, { ...goodPlayer, sportIds: [sB.json.data.id] })).status === 400, "other tenant's sport id rejected");
  const p1 = await api("POST", "/api/academy/players", t.owner, goodPlayer);
  assert(p1.status === 201 && p1.json.data.playerCode === "OFA-000001", `first player gets OFA-000001 (got ${p1.json.data?.playerCode})`);
  const dup = await api("POST", "/api/academy/players", t.owner, { ...goodPlayer, name: "aarav SHARMA", guardianPhone: "9198765 43210".replace(/ /g, "").replace(/^91/, "+91") });
  assert(dup.status === 409, "same child + guardian number → 409 duplicate");
  const sibling = await api("POST", "/api/academy/players", t.owner, { ...goodPlayer, name: "Diya Sharma", dateOfBirth: "2016-02-11" });
  assert(sibling.status === 201 && sibling.json.data.playerCode === "OFA-000002", "sibling with same guardian allowed, next ID");

  console.log("\n5. Concurrent admissions → unique IDs");
  const burst = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      api("POST", "/api/academy/players", t.owner, {
        ...goodPlayer, name: `Burst Player ${i}`, dateOfBirth: `2015-01-${String(i + 1).padStart(2, "0")}`,
      })
    )
  );
  const codes = burst.map((r) => r.json?.data?.playerCode);
  assert(burst.every((r) => r.status === 201), "all 10 parallel admissions succeed");
  assert(new Set(codes).size === 10, `10 distinct Player IDs (${codes.join(",")})`);

  // ── 6. Listing, filters, isolation, coach scoping ───────────────────────
  console.log("\n6. Listing, filters, isolation, coach scoping");
  const list = await api("GET", "/api/academy/players?limit=100", t.owner);
  assert(list.json.data.items.length === 12, "owner lists all 12 players");
  const q = await api("GET", "/api/academy/players?q=diya", t.owner);
  assert(q.json.data.items.length === 1 && q.json.data.items[0].name === "Diya Sharma", "search by name");
  const byCode = await api("GET", "/api/academy/players?q=OFA-000001", t.owner);
  assert(byCode.json.data.items.length === 1, "search by Player ID");
  const byPhone = await api("GET", "/api/academy/players?q=9876543210", t.owner);
  assert(byPhone.json.data.items.length >= 2, "search by guardian number");
  const bySport = await api("GET", `/api/academy/players?sportId=${s1.json.data.id}&limit=100`, t.owner);
  assert(bySport.json.data.items.length === 12, "filter by sport");
  assert((await api("GET", "/api/academy/players?status=BOGUS", t.owner)).status === 400, "bad status filter → 400");
  const page1 = await api("GET", "/api/academy/players?limit=5", t.owner);
  const page2 = await api("GET", `/api/academy/players?limit=5&cursor=${page1.json.data.nextCursor}`, t.owner);
  const ids = new Set([...page1.json.data.items, ...page2.json.data.items].map((p) => p.id));
  assert(page1.json.data.items.length === 5 && page2.json.data.items.length === 5 && ids.size === 10, "pagination: two pages, no overlap");
  assert((await api("GET", "/api/academy/players", t.ownerB)).json.data.items.length === 0, "tenant isolation: tenant B sees none of A's players");
  assert((await api("GET", "/api/academy/players", t.guardian)).status === 403, "guardian role cannot use staff players API");
  assert((await api("GET", "/api/academy/players", t.coach)).json.data.items.length === 0, "coach with no batches sees 0 players");

  const sportRow = await prisma.academySport.findFirst({ where: { tenantId: A.id, name: "Cricket" } });
  const batch = await prisma.academyBatch.create({
    data: { tenantId: A.id, sportId: sportRow.id, name: "Under-12", coachUserId: coach.id, days: [1, 3, 5], startTime: "17:00", endTime: "18:30" },
  });
  const otherBatch = await prisma.academyBatch.create({
    data: { tenantId: A.id, sportId: sportRow.id, name: "Under-16", coachUserId: manager.id, days: [2], startTime: "17:00", endTime: "18:30" },
  });
  await prisma.academyBatchEnrollment.create({ data: { batchId: batch.id, playerId: (await prisma.academyPlayer.findFirst({ where: { tenantId: A.id, playerCode: "OFA-000001" } })).id, startDate: new Date("2026-04-01") } });
  await prisma.academyBatchEnrollment.create({ data: { batchId: otherBatch.id, playerId: (await prisma.academyPlayer.findFirst({ where: { tenantId: A.id, playerCode: "OFA-000002" } })).id, startDate: new Date("2026-04-01") } });
  const coachList = await api("GET", "/api/academy/players", t.coach);
  assert(coachList.json.data.items.length === 1 && coachList.json.data.items[0].playerCode === "OFA-000001", "coach sees ONLY players in own batch");

  // ── 7. Team management & anti-escalation ────────────────────────────────
  console.log("\n7. Team management & anti-escalation");
  assert((await api("GET", "/api/academy/members", t.coach)).status === 403, "coach cannot list team");
  assert((await api("GET", "/api/academy/members", t.manager)).status === 200, "manager can view team");
  assert((await api("POST", "/api/academy/members", t.manager, { userId: outsider.id, role: "COACH" })).status === 403, "manager cannot assign roles");
  assert((await api("POST", "/api/academy/members", t.owner, { userId: owner.id, role: "COACH" })).status === 403, "owner cannot change own role");
  assert((await api("POST", "/api/academy/members", t.owner, { userId: ownerB.id, role: "COACH" })).status === 404, "cannot assign a user from another tenant");
  assert((await api("POST", "/api/academy/members", t.owner, { userId: outsider.id, role: "NOPE" })).status === 400, "invalid role → 400");
  const assign = await api("POST", "/api/academy/members", t.owner, { userId: outsider.id, role: "RECEPTION" });
  assert(assign.status === 200 && assign.json.data.role === "RECEPTION", "owner assigns reception role");
  const recToken = await token(outsider, A.id);
  assert((await api("POST", "/api/academy/players", recToken, { ...goodPlayer, name: "Reception Admit", dateOfBirth: "2013-03-03" })).status === 201, "new reception member can admit players immediately");
  assert((await api("GET", "/api/academy/audit", recToken)).status === 403, "reception cannot read audit log");

  // ── 8. Audit trail ───────────────────────────────────────────────────────
  console.log("\n8. Audit trail");
  const audit = await api("GET", "/api/academy/audit?limit=100", t.owner);
  const actions = new Set(audit.json.data.items.map((i) => i.action));
  assert(audit.status === 200 && actions.has("sport.created") && actions.has("player.created") && actions.has("member.added"), "audit has sport/player/member events");
  assert((await api("GET", "/api/academy/audit", t.coach)).status === 403, "coach cannot read audit log");
  assert((await api("GET", "/api/academy/audit", t.ownerB)).json.data.items.every((i) => i.action !== "player.created"), "tenant B audit does not leak A's events");
  let tamperBlocked = false;
  try { await prisma.academyAuditLog.updateMany({ where: { tenantId: A.id }, data: { action: "tampered" } }); } catch { tamperBlocked = true; }
  assert(tamperBlocked, "database blocks audit-log UPDATE");
  let deleteBlocked = false;
  try { await prisma.academyAuditLog.deleteMany({ where: { tenantId: A.id } }); } catch { deleteBlocked = true; }
  assert(deleteBlocked, "database blocks audit-log DELETE");

  // ── 9. Batches, Sessions & Attendance ──────────────────────────────────
  console.log("\n9. Batches, Sessions & Attendance");
  assert((await api("POST", "/api/academy/batches", t.coach, { name: "Coach Batch", sportId: s1.json.data.id, days: [1, 2], startTime: "07:00", endTime: "08:00" })).status === 403, "coach cannot create batch (403)");
  
  const newBatch = await api("POST", "/api/academy/batches", t.owner, {
    name: "Morning Juniors",
    sportId: s1.json.data.id,
    coachUserId: coach.id,
    days: [1, 3, 5],
    startTime: "06:30",
    endTime: "08:00",
    capacity: 20,
  });
  assert(newBatch.status === 201 && newBatch.json.data.name === "Morning Juniors", "owner creates batch");

  const dupBatch = await api("POST", "/api/academy/batches", t.owner, {
    name: "Morning Juniors",
    sportId: s1.json.data.id,
    days: [2, 4],
    startTime: "06:30",
    endTime: "08:00",
  });
  assert(dupBatch.status === 409, "duplicate batch name for sport → 409");

  const batchesForCoach = await api("GET", "/api/academy/batches", t.coach);
  assert(batchesForCoach.status === 200 && batchesForCoach.json.data.items.length >= 1, "coach lists assigned batches");

  // Enroll player into batch
  const player1 = (await prisma.academyPlayer.findFirst({ where: { tenantId: A.id, playerCode: "OFA-000001" } }));
  const enrollRes = await api("POST", `/api/academy/batches/${newBatch.json.data.id}/enroll`, t.owner, {
    playerId: player1.id,
    startDate: "2026-05-01",
  });
  assert(enrollRes.status === 201, "owner enrolls player into batch");

  const dupEnroll = await api("POST", `/api/academy/batches/${newBatch.json.data.id}/enroll`, t.owner, {
    playerId: player1.id,
    startDate: "2026-05-01",
  });
  assert(dupEnroll.status === 409, "duplicate active enrollment → 409");

  // Generate sessions
  const genSessions = await api("POST", "/api/academy/sessions", t.owner, {
    batchId: newBatch.json.data.id,
    fromDate: "2026-05-01",
    toDate: "2026-05-15",
  });
  assert(genSessions.status === 201 && genSessions.json.createdCount > 0, "generate training sessions for batch");

  // Coach lists sessions
  const coachSessions = await api("GET", `/api/academy/sessions?batchId=${newBatch.json.data.id}`, t.coach);
  assert(coachSessions.status === 200 && coachSessions.json.data.items.length > 0, "coach lists batch sessions");
  const targetSession = coachSessions.json.data.items[0];

  // Bulk mark attendance
  const opId = `test-op-${Date.now()}`;
  const markRes = await api("POST", "/api/academy/attendance", t.coach, {
    sessionId: targetSession.id,
    records: [{ playerId: player1.id, status: "PRESENT" }],
    opId,
  });
  assert(markRes.status === 201 && markRes.json.savedCount === 1, "coach bulk marks attendance (status 201)");

  // Idempotency check with same opId
  const idempRes = await api("POST", "/api/academy/attendance", t.coach, {
    sessionId: targetSession.id,
    records: [{ playerId: player1.id, status: "PRESENT" }],
    opId,
  });
  assert(idempRes.status === 200 && idempRes.json.idempotent === true, "submitting same opId is idempotent (cached response)");

  // Attendance history query
  const attHist = await api("GET", `/api/academy/attendance?sessionId=${targetSession.id}`, t.coach);
  assert(attHist.status === 200 && attHist.json.data.items.length === 1 && attHist.json.data.items[0].status === "PRESENT", "fetch session attendance");
  const targetAttendanceId = attHist.json.data.items[0].id;

  // Attendance correction
  const corrRes = await api("PATCH", "/api/academy/attendance", t.coach, {
    attendanceId: targetAttendanceId,
    newStatus: "LATE",
    reason: "Delayed by traffic on highway",
  });
  assert(corrRes.status === 200 && corrRes.json.data.newStatus === "LATE", "attendance correction succeeds with reason");

  // ── 10. Finance: Plans, Assignments, Invoices & Payments ─────────────
  console.log("\n10. Finance: Plans, Assignments, Invoices & Payments");
  assert((await api("POST", "/api/academy/finance/plans", t.coach, { name: "Coach Plan", sportId: s1.json.data.id, billingMethod: "FIXED", baseAmount: 2000 })).status === 403, "coach cannot create fee plan (403)");

  const newPlan = await api("POST", "/api/academy/finance/plans", t.accounts, {
    sportId: s1.json.data.id,
    name: "Cricket Junior Monthly",
    billingMethod: "FIXED",
    baseAmount: 2500,
    taxRate: 18,
    proRateMidPeriod: true,
  });
  assert(newPlan.status === 201 && newPlan.json.data.name === "Cricket Junior Monthly", "accounts creates fee plan");

  const planList = await api("GET", "/api/academy/finance/plans", t.accounts);
  assert(planList.status === 200 && planList.json.data.items.length >= 1, "accounts lists fee plans");

  // Assign fee plan to player1
  const assignPlan = await api("POST", "/api/academy/finance/assignments", t.accounts, {
    playerId: player1.id,
    sportId: s1.json.data.id,
    feePlanId: newPlan.json.data.id,
    effectiveFrom: "2026-05-01",
    discountAmount: 200,
  });
  assert(assignPlan.status === 201 && assignPlan.json.data.playerId === player1.id, "accounts assigns fee plan with discount");

  // Preview invoice calculation
  const previewInv = await api("POST", "/api/academy/finance", t.accounts, {
    playerId: player1.id,
    sportId: s1.json.data.id,
    period: "2026-05",
    preview: true,
  });
  assert(previewInv.status === 200 && previewInv.json.data.preview === true && previewInv.json.data.totalAmount !== undefined, "preview invoice calculation returns computed lines");

  // Generate draft invoice
  const draftInv = await api("POST", "/api/academy/finance", t.accounts, {
    playerId: player1.id,
    sportId: s1.json.data.id,
    period: "2026-05",
  });
  assert(draftInv.status === 201 && draftInv.json.data.status === "DRAFT", "generate draft invoice succeeds");
  const invoiceId = draftInv.json.data.id;

  // Finalize invoice
  const finalizeInv = await api("PATCH", "/api/academy/finance", t.accounts, {
    invoiceId,
  });
  assert(finalizeInv.status === 200 && finalizeInv.json.data.status === "FINALIZED", "accounts finalizes draft invoice");

  const dupFinalize = await api("PATCH", "/api/academy/finance", t.accounts, {
    invoiceId,
  });
  assert(dupFinalize.status === 400, "finalizing already finalized invoice → 400");

  // Record partial payment
  const pay1 = await api("POST", "/api/academy/finance/payments", t.accounts, {
    playerId: player1.id,
    amount: 1000,
    method: "UPI",
    reference: "UPI-TEST-001",
  });
  assert(pay1.status === 201 && pay1.json.data.allocations.length === 1, "record partial payment with auto-allocation");
  assert(pay1.json.data.receipt !== null && pay1.json.data.receipt.storageKey.includes(invoiceId), "receipt generated for allocated payment");

  // Verify invoice status is PARTIALLY_PAID
  const invAfterPay1 = await api("GET", `/api/academy/finance?playerId=${player1.id}`, t.accounts);
  const targetInv = invAfterPay1.json.data.items.find((i) => i.id === invoiceId);
  assert(targetInv && targetInv.status === "PARTIALLY_PAID", "invoice status transitions to PARTIALLY_PAID");

  // Record remaining payment to settle invoice
  const remainingDue = Number(targetInv.totalAmount) - 1000;
  const pay2 = await api("POST", "/api/academy/finance/payments", t.accounts, {
    playerId: player1.id,
    amount: remainingDue,
    method: "CASH",
  });
  assert(pay2.status === 201 && pay2.json.data.allocations.length === 1, "record remaining payment settling balance");

  const invAfterPay2 = await api("GET", `/api/academy/finance?playerId=${player1.id}`, t.accounts);
  const fullyPaidInv = invAfterPay2.json.data.items.find((i) => i.id === invoiceId);
  assert(fullyPaidInv && fullyPaidInv.status === "PAID", "invoice status transitions to PAID");

  // ── 11. Facilities & Court Bookings ─────────────────────────────────────
  console.log("\n11. Facilities & Court Bookings");
  assert((await api("POST", "/api/academy/facilities", t.coach, { name: "Badminton Court 1" })).status === 403, "coach cannot create facility (403)");

  const court1 = await api("POST", "/api/academy/facilities", t.owner, {
    name: "Indoor Court A",
    type: "Badminton",
    capacity: 4,
    description: "Wooden floor badminton court",
    hours: [
      { dayOfWeek: 1, openTime: "06:00", closeTime: "22:00" },
      { dayOfWeek: 2, openTime: "06:00", closeTime: "22:00" },
    ],
  });
  assert(court1.status === 201 && court1.json.data.name === "Indoor Court A", "owner creates sports facility with hours");

  const dupFacility = await api("POST", "/api/academy/facilities", t.owner, {
    name: "Indoor Court A",
  });
  assert(dupFacility.status === 409, "duplicate facility name → 409");

  // Create booking
  const b1 = await api("POST", "/api/academy/bookings", t.owner, {
    facilityId: court1.json.data.id,
    title: "Morning Match",
    startAt: "2026-05-15T09:00:00.000Z",
    endAt: "2026-05-15T10:00:00.000Z",
  });
  assert(b1.status === 201 && b1.json.data.title === "Morning Match", "create confirmed booking slot");

  // Overlapping booking → 409
  const bOverlap = await api("POST", "/api/academy/bookings", t.owner, {
    facilityId: court1.json.data.id,
    title: "Overlapping Slot",
    startAt: "2026-05-15T09:30:00.000Z",
    endAt: "2026-05-15T10:30:00.000Z",
  });
  assert(bOverlap.status === 409, "overlapping booking slot rejected with 409 conflict");

  // Adjacent / non-overlapping booking succeeds
  const bAdjacent = await api("POST", "/api/academy/bookings", t.owner, {
    facilityId: court1.json.data.id,
    title: "Afternoon Match",
    startAt: "2026-05-15T10:00:00.000Z",
    endAt: "2026-05-15T11:00:00.000Z",
  });
  assert(bAdjacent.status === 201 && bAdjacent.json.data.title === "Afternoon Match", "adjacent booking succeeds without conflict");

  // List bookings
  const bookingsList = await api("GET", `/api/academy/bookings?facilityId=${court1.json.data.id}`, t.owner);
  assert(bookingsList.status === 200 && bookingsList.json.data.items.length === 2, "list facility bookings returns 2 confirmed bookings");

  // ── 12. Development & Inventory ─────────────────────────────────────────
  console.log("\n12. Development & Inventory");
  // Coach creates assessment template
  assert((await api("POST", "/api/academy/development/templates", t.accounts, { name: "Test" })).status === 403, "accounts cannot create assessment template (403)");

  const assessTpl = await api("POST", "/api/academy/development/templates", t.coach, {
    sportId: s1.json.data.id,
    name: "Cricket Skills & Fitness Test",
    description: "Quarterly fitness benchmark for academy juniors",
    fields: [
      { key: "beep_test", label: "Beep Test Level", type: "number", min: 1, max: 25 },
      { key: "bowling_speed", label: "Bowling Speed", type: "number", unit: "km/h" },
      { key: "accuracy", label: "Target Accuracy", type: "scale", min: 1, max: 10 },
    ],
  });
  assert(assessTpl.status === 201 && assessTpl.json.data.fields.length === 3, "coach creates assessment template");

  const tplList = await api("GET", `/api/academy/development/templates?sportId=${s1.json.data.id}`, t.coach);
  assert(tplList.status === 200 && tplList.json.data.items.length >= 1, "coach lists assessment templates");

  // Record assessment event
  const assessEvent = await api("POST", "/api/academy/development/assessments", t.coach, {
    templateId: assessTpl.json.data.id,
    batchId: newBatch.json.data.id,
    assessedDate: "2026-05-18",
    notes: "Pre-season fitness assessment session",
    results: [
      {
        playerId: player1.id,
        scores: { beep_test: 12.5, bowling_speed: 112, accuracy: 8 },
        notes: "Solid run-up and good release consistency",
      },
    ],
  });
  assert(assessEvent.status === 201 && assessEvent.json.data.playersCount === 1, "coach conducts assessment & records player scores");

  // Fetch assessment details
  const assessDetails = await api("GET", `/api/academy/development/assessments/${assessEvent.json.data.id}`, t.coach);
  assert(assessDetails.status === 200 && assessDetails.json.data.results[0].scores.accuracy === 8, "fetch assessment details returns player scorecard");

  // Item Types catalog
  assert((await api("POST", "/api/academy/inventory/types", t.coach, { name: "Jersey" })).status === 403, "coach cannot create item types (403)");

  const itemType = await api("POST", "/api/academy/inventory/types", t.owner, {
    name: "Academy Match Jersey - Navy Blue",
    category: "JERSEY",
    description: "Official team match jersey with breathable fabric",
  });
  assert(itemType.status === 201 && itemType.json.data.category === "JERSEY", "owner creates inventory item type");

  const dupItem = await api("POST", "/api/academy/inventory/types", t.owner, {
    name: "Academy Match Jersey - Navy Blue",
  });
  assert(dupItem.status === 409, "duplicate item type name → 409");

  // Issue jersey to player
  const recMemberToken = await token(outsider, A.id); // Reception member
  const issueRes = await api("POST", "/api/academy/inventory/allocations", recMemberToken, {
    itemTypeId: itemType.json.data.id,
    playerId: player1.id,
    eventType: "ISSUED",
    quantity: 1,
    size: "M",
    number: "18",
    notes: "Official junior squad jersey",
  });
  assert(issueRes.status === 201 && issueRes.json.data.number === "18", "reception issues jersey to player with number and size");

  // List allocations
  const allocList = await api("GET", `/api/academy/inventory/allocations?playerId=${player1.id}`, recMemberToken);
  assert(allocList.status === 200 && allocList.json.data.items.length >= 1, "list allocations returns player's jersey issuance record");

  // ── 13. Comms & Notifications ───────────────────────────────────────────
  console.log("\n13. Comms & Notifications");
  assert((await api("POST", "/api/academy/announcements", t.accounts, { title: "Test", body: "Hello" })).status === 403, "accounts cannot create announcements (403)");

  const annRes = await api("POST", "/api/academy/announcements", t.coach, {
    title: "Summer Coaching Camp 2026",
    body: "Intensive training camp starting next Monday for all junior squads.",
    audience: "ALL",
  });
  assert(annRes.status === 201 && annRes.json.data.title === "Summer Coaching Camp 2026", "coach publishes broadcast announcement");

  const annList = await api("GET", "/api/academy/announcements", t.owner);
  const targetAnn = annList.json.data.items.find((a) => a.id === annRes.json.data.id);
  assert(targetAnn && targetAnn.read === false, "owner sees announcement marked unread");

  const markRead = await api("POST", `/api/academy/announcements/${annRes.json.data.id}/read`, t.owner);
  assert(markRead.status === 200, "owner marks announcement as read");

  const annListAfter = await api("GET", "/api/academy/announcements", t.owner);
  const targetAnnAfter = annListAfter.json.data.items.find((a) => a.id === annRes.json.data.id);
  assert(targetAnnAfter && targetAnnAfter.read === true, "owner now sees announcement marked read");

  // Notifications
  assert((await api("POST", "/api/academy/notifications", t.coach, { userId: owner.id, type: "test", title: "T", body: "B" })).status === 403, "coach cannot dispatch notifications (403)");

  const notifRes = await api("POST", "/api/academy/notifications", t.manager, {
    userId: coach.id,
    type: "schedule.updated",
    title: "Batch Schedule Updated",
    body: "Your Morning Juniors batch starts at 06:30 AM tomorrow.",
  });
  assert(notifRes.status === 201 && notifRes.json.data.status === "QUEUED", "manager dispatches in-app notification to coach");

  const coachNotifs = await api("GET", "/api/academy/notifications?unreadOnly=true", t.coach);
  const targetNotif = coachNotifs.json.data.items.find((n) => n.id === notifRes.json.data.id);
  assert(targetNotif && targetNotif.status === "QUEUED", "coach sees queued unread notification in inbox");

  const markNotifRead = await api("PATCH", `/api/academy/notifications/${notifRes.json.data.id}/read`, t.coach);
  assert(markNotifRead.status === 200 && markNotifRead.json.data.status === "READ", "coach marks notification as read");

  // ── 14. Reports & CSV Data Export ───────────────────────────────────────
  console.log("\n14. Reports & CSV Data Export");
  assert((await api("GET", "/api/academy/reports/attendance", t.coach)).status === 403, "coach cannot access reports (403)");

  const attRep = await api("GET", "/api/academy/reports/attendance", t.accounts);
  assert(attRep.status === 200 && attRep.json.data.summary.totalSessions > 0, "accounts fetches attendance register report");

  // CSV export
  const attCsvRes = await fetch(`${BASE}/api/academy/reports/attendance?format=csv`, {
    headers: { Authorization: `Bearer ${t.accounts}` },
  });
  const attCsvText = await attCsvRes.text();
  assert(attCsvRes.status === 200 && attCsvText.includes("Batch,Sport,Sessions"), "attendance report exports to CSV format");

  const finRep = await api("GET", "/api/academy/reports/finance", t.accounts);
  assert(finRep.status === 200 && finRep.json.data.summary.totalInvoiced > 0, "accounts fetches financial ledger report");

  const finCsvRes = await fetch(`${BASE}/api/academy/reports/finance?format=csv`, {
    headers: { Authorization: `Bearer ${t.accounts}` },
  });
  const finCsvText = await finCsvRes.text();
  assert(finCsvRes.status === 200 && finCsvText.includes("Player ID,Player Name"), "defaulters ledger exports to CSV format");

  // ── 15. Existing app regression ──────────────────────────────────────────
  console.log("\n15. Existing endpoints unaffected");
  assert((await api("GET", "/api/health")).status === 200, "/api/health still OK");
  const login = await api("POST", "/api/auth/login", null, { email: "x@y.z", password: "bad", tenantSlug: "nonexistent-org" });
  assert(login.status === 401, "/api/auth/login still rejects bad credentials");
}

run()
  .catch((e) => { console.error("\nFATAL:", e.message); failed++; })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
