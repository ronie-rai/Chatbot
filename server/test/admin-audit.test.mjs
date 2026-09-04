/**
 * Automated Production Audit & Security Test Suite
 * Validates token protection, RBAC, HMAC verification, and system health.
 */

const BASE_URL = process.env.TEST_API_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@ofa-sports.com";
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "OFA@SuperAdmin2026";

async function runTests() {
  console.log("============================================================");
  console.log("🛡️  STARTING PRODUCTION READINESS AUDIT & SECURITY TEST SUITE");
  console.log(`Target: ${BASE_URL}`);
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ── TEST 1: Unauthenticated Admin Endpoints (Must return 401) ──────────
  console.log("👉 Test Suite 1: Unauthenticated Admin Endpoint Protection (401)");
  const protectedRoutes = [
    "/api/admin/overview",
    "/api/admin/organizations",
    "/api/admin/users",
    "/api/admin/groups",
    "/api/admin/conversations",
    "/api/admin/ai-settings",
    "/api/admin/system-health",
  ];

  for (const route of protectedRoutes) {
    try {
      const res = await fetch(`${BASE_URL}${route}`);
      assert(res.status === 401, `GET ${route} without token returned 401 (got ${res.status})`);
    } catch (e) {
      assert(false, `GET ${route} request failed: ${e.message}`);
    }
  }

  // ── TEST 2: Forged / Fake Admin Token (Must return 401) ─────────────────
  console.log("\n👉 Test Suite 2: Forged & Expired Token Rejection");
  try {
    const fakeToken = Buffer.from("attacker@evil.com:123456789:badhmacsignature").toString("base64");
    const res = await fetch(`${BASE_URL}/api/admin/overview`, {
      headers: { "x-sa-token": fakeToken },
    });
    assert(res.status === 401, `Forged token correctly rejected with 401 (got ${res.status})`);
  } catch (e) {
    assert(false, `Forged token check failed: ${e.message}`);
  }

  // ── TEST 3: Valid Admin Authentication & Token Generation ──────────────
  console.log("\n👉 Test Suite 3: Super Admin Login & Token Generation");
  let adminToken = "";
  try {
    const authRes = await fetch(`${BASE_URL}/api/admin/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const authData = await authRes.json();
    assert(authRes.status === 200 && authData.ok && Boolean(authData.token), "Valid admin credentials generate HMAC session token");
    adminToken = authData.token;
  } catch (e) {
    assert(false, `Admin auth failed: ${e.message}`);
  }

  // ── TEST 4: Authenticated Access with Valid Token ───────────────────────
  console.log("\n👉 Test Suite 4: Authenticated Admin Access with Valid Token");
  if (adminToken) {
    for (const route of protectedRoutes) {
      try {
        const res = await fetch(`${BASE_URL}${route}`, {
          headers: { "x-sa-token": adminToken },
        });
        const data = await res.json();
        assert(res.status === 200 && data.ok, `GET ${route} with valid token returned 200 OK`);
      } catch (e) {
        assert(false, `GET ${route} with token failed: ${e.message}`);
      }
    }
  } else {
    console.error("  ❌ SKIPPED: Valid token could not be obtained.");
  }

  // ── TEST 5: Live System Health Check ───────────────────────────────────
  console.log("\n👉 Test Suite 5: System Health & Diagnostics Check");
  try {
    const healthRes = await fetch(`${BASE_URL}/api/admin/system-health`, {
      headers: { "x-sa-token": adminToken },
    });
    const healthData = await healthRes.json();
    const dbStatus = healthData.data?.services?.database?.status;
    const rtStatus = healthData.data?.services?.realtime?.status;
    const aiStatus = healthData.data?.services?.ai?.status;

    assert(dbStatus === "ONLINE", `PostgreSQL Database status is ONLINE (latency: ${healthData.data?.services?.database?.latencyMs}ms)`);
    assert(rtStatus === "ONLINE", `Socket.io Realtime server status is ONLINE`);
    assert(aiStatus === "CONFIGURED", `Groq AI provider status is CONFIGURED`);
  } catch (e) {
    assert(false, `System health check failed: ${e.message}`);
  }

  // ── TEST 6: Conversation & Inquiries Inspection ────────────────────────
  console.log("\n👉 Test Suite 6: Conversation & Leads Inspection");
  try {
    const convRes = await fetch(`${BASE_URL}/api/admin/conversations`, {
      headers: { "x-sa-token": adminToken },
    });
    const convData = await convRes.json();
    assert(Array.isArray(convData.data) && convData.data.length > 0, `Retrieved ${convData.data?.length} conversations with customer leads`);

    if (convData.data?.length > 0) {
      const firstConv = convData.data[0];
      const detailRes = await fetch(`${BASE_URL}/api/admin/conversations?id=${firstConv.id}`, {
        headers: { "x-sa-token": adminToken },
      });
      const detailData = await detailRes.json();
      assert(detailData.ok && Array.isArray(detailData.data?.messages), `Loaded full transcript for "${firstConv.name}" (${detailData.data?.messages?.length} messages)`);
    }
  } catch (e) {
    assert(false, `Conversation inspection failed: ${e.message}`);
  }

  // ── TEST 7: Invalid Login Credentials Rejection ────────────────────────
  console.log("\n👉 Test Suite 7: Invalid Login Password Rejection");
  try {
    const wrongAuthRes = await fetch(`${BASE_URL}/api/admin/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: "WrongPassword123" }),
    });
    assert(wrongAuthRes.status === 401, `Wrong password rejected with 401 (got ${wrongAuthRes.status})`);
  } catch (e) {
    assert(false, `Wrong password rejection check failed: ${e.message}`);
  }

  console.log("\n============================================================");
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
