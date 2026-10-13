/**
 * Academy validation unit tests (pure logic).
 * Run (from /server): npx ts-node --project tsconfig.seed.json test/academy-validation.test.ts
 */
import assert from "node:assert/strict";
import {
  formatPlayerCode,
  normalizePhone,
  parseDateOnly,
  parseLimit,
  parsePlayerInput,
  parseSportInput,
  parseTime,
} from "../lib/academy/validation";

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  PASS: ${name}`);
}

const valid = {
  name: "  Aarav Sharma ",
  dateOfBirth: "2014-05-20",
  guardianName: "Neha Sharma",
  guardianPhone: "+91 98765-43210",
  joiningDate: "2026-04-01",
  startTime: "17:00",
  endTime: "18:30",
  sportIds: ["s1", "s2", "s1"],
};

test("valid player parses, trims, normalizes phone and de-dupes sports", () => {
  const r = parsePlayerInput(valid, new Date("2026-10-10T00:00:00Z"));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.name, "Aarav Sharma");
    assert.equal(r.value.guardianPhone, "+919876543210");
    assert.deepEqual(r.value.sportIds, ["s1", "s2"]);
    assert.equal(r.value.status, "ACTIVE");
  }
});

test("missing essential fields are rejected", () => {
  for (const key of ["name", "dateOfBirth", "guardianName", "guardianPhone", "sportIds"]) {
    const bad: Record<string, unknown> = { ...valid };
    delete bad[key];
    assert.equal(parsePlayerInput(bad).ok, false, `${key} should be required`);
  }
});

test("omitted joiningDate defaults to today", () => {
  const bad: Record<string, unknown> = { ...valid };
  delete bad["joiningDate"];
  const fixedNow = new Date("2026-10-12T08:00:00.000Z");
  const r = parsePlayerInput(bad, fixedNow);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.joiningDate, "2026-10-12");
  }
});

test("invalid joiningDate is rejected", () => {
  assert.equal(parsePlayerInput({ ...valid, joiningDate: "bad-date" }).ok, false);
});

test("empty sports list rejected", () => {
  assert.equal(parsePlayerInput({ ...valid, sportIds: [] }).ok, false);
});

test("future date of birth rejected", () => {
  assert.equal(parsePlayerInput({ ...valid, dateOfBirth: "2030-01-01" }, new Date("2026-10-10")).ok, false);
});

test("end time must be after start time", () => {
  assert.equal(parsePlayerInput({ ...valid, startTime: "18:00", endTime: "17:00" }).ok, false);
});

test("invalid status rejected", () => {
  assert.equal(parsePlayerInput({ ...valid, status: "GONE" }).ok, false);
});

test("date validation rejects impossible dates and accepts ISO strings and Date instances", () => {
  assert.equal(parseDateOnly("2026-02-30", "d").ok, false);
  assert.equal(parseDateOnly("20-02-2026", "d").ok, false);
  assert.equal(parseDateOnly("2026-02-28", "d").ok, true);
  assert.equal(parseDateOnly(" 2026-02-28 ", "d").ok, true);
  const iso = parseDateOnly("2026-02-28T10:30:00.000Z", "d");
  assert.equal(iso.ok, true);
  if (iso.ok) assert.equal(iso.value, "2026-02-28");
  const dateObj = parseDateOnly(new Date("2026-02-28T00:00:00.000Z"), "d");
  assert.equal(dateObj.ok, true);
  if (dateObj.ok) assert.equal(dateObj.value, "2026-02-28");
});

test("time validation", () => {
  assert.equal(parseTime("24:00", "t").ok, false);
  assert.equal(parseTime("09:05", "t").ok, true);
  const empty = parseTime("", "t");
  assert.ok(empty.ok && empty.value === null);
});

test("phone normalization", () => {
  assert.equal(normalizePhone("12345", "p").ok, false);
  const p = normalizePhone("98765 43210", "p");
  assert.ok(p.ok && p.value === "9876543210");
});

test("player code is zero-padded", () => {
  assert.equal(formatPlayerCode(1), "OFA-000001");
  assert.equal(formatPlayerCode(123), "OFA-000123");
});

test("sport create requires name; patch does not", () => {
  assert.equal(parseSportInput({}).ok, false);
  assert.equal(parseSportInput({ active: false }, true).ok, true);
  assert.equal(parseSportInput({ defaultBillingMethod: "NOPE" }, true).ok, false);
});

test("limit clamps", () => {
  assert.equal(parseLimit(null), 25);
  assert.equal(parseLimit("0"), 1);
  assert.equal(parseLimit("9999"), 100);
});

console.log(`\n${passed} tests passed`);
