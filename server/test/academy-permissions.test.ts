/**
 * Academy RBAC unit tests (pure logic, no server/DB needed).
 * Run (from /server): npx ts-node --project tsconfig.seed.json test/academy-permissions.test.ts
 */
import assert from "node:assert/strict";
import {
  ACADEMY_ROLES,
  buildNavigation,
  can,
  canAssignRole,
  resolvePermissions,
} from "../lib/academy/permissions";
import { redact } from "../lib/academy/audit";

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  PASS: ${name}`);
}

test("owner has every permission", () => {
  const p = resolvePermissions("OWNER");
  assert.ok(can(p, "payments", "approve"));
  assert.ok(can(p, "audit", "view"));
  assert.ok(can(p, "permissions", "edit"));
});

test("owner cannot be reduced by overrides (no lock-out)", () => {
  const p = resolvePermissions("OWNER", [{ resource: "users", action: "create", granted: false }]);
  assert.ok(can(p, "users", "create"));
});

test("coach can mark attendance but cannot see finance or users", () => {
  const p = resolvePermissions("COACH");
  assert.ok(can(p, "attendance", "create"));
  assert.ok(!can(p, "payments", "view"));
  assert.ok(!can(p, "invoices", "view"));
  assert.ok(!can(p, "users", "view"));
  assert.ok(!can(p, "audit", "view"));
});

test("accounts can record payments but not mark attendance", () => {
  const p = resolvePermissions("ACCOUNTS");
  assert.ok(can(p, "payments", "create"));
  assert.ok(!can(p, "attendance", "create"));
});

test("manager cannot grant roles or edit permissions by default", () => {
  const p = resolvePermissions("MANAGER");
  assert.ok(!can(p, "users", "create"));
  assert.ok(!can(p, "permissions", "edit"));
});

test("guardian has portal access only", () => {
  const p = resolvePermissions("GUARDIAN");
  assert.deepEqual(Array.from(p), ["portal:view"]);
});

test("overrides can revoke and grant for non-owner roles", () => {
  const p = resolvePermissions("COACH", [
    { resource: "attendance", action: "edit", granted: false },
    { resource: "reports", action: "view", granted: true },
  ]);
  assert.ok(!can(p, "attendance", "edit"));
  assert.ok(can(p, "reports", "view"));
});

test("unknown override keys are ignored", () => {
  const p = resolvePermissions("COACH", [{ resource: "nope", action: "view", granted: true }]);
  assert.ok(![...p].some((k) => k.startsWith("nope")));
});

test("only owner can assign owner role", () => {
  assert.ok(canAssignRole("OWNER", "OWNER"));
  for (const r of ACADEMY_ROLES.filter((x) => x !== "OWNER")) {
    assert.ok(!canAssignRole(r, "OWNER"));
  }
  assert.ok(canAssignRole("MANAGER", "COACH"));
});

test("navigation only shows permitted modules", () => {
  const coachNav = buildNavigation(resolvePermissions("COACH")).map((m) => m.id);
  assert.ok(coachNav.includes("attendance"));
  assert.ok(!coachNav.includes("payments"));
  assert.ok(!coachNav.includes("users"));
  const guardianNav = buildNavigation(resolvePermissions("GUARDIAN")).map((m) => m.id);
  assert.deepEqual(guardianNav, ["portal"]);
});

test("audit redaction strips secrets recursively", () => {
  const out = redact({
    name: "A",
    passwordHash: "x",
    nested: { apiKey: "k", token: "t", ok: 1 },
    list: [{ secret: "s", v: 2 }],
  });
  assert.deepEqual(out, { name: "A", nested: { ok: 1 }, list: [{ v: 2 }] });
});

console.log(`\n${passed} tests passed`);
