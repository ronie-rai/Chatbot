/**
 * Pure input validation for the academy module (no DB, no framework).
 * Every parser returns a discriminated result so routes never trust raw JSON.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const fail = <T>(message: string): Parsed<T> => ({ ok: false, message });
const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });

export const PLAYER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "WITHDRAWN"] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const BILLING_METHODS = ["FIXED", "PER_SESSION", "PRO_RATA"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function str(v: unknown, field: string, max = 200, required = true): Parsed<string | null> {
  if (v === undefined || v === null || v === "") {
    return required ? fail(`${field} is required`) : ok(null);
  }
  if (typeof v !== "string") return fail(`${field} must be text`);
  const t = v.trim();
  if (!t) return required ? fail(`${field} is required`) : ok(null);
  if (t.length > max) return fail(`${field} must be at most ${max} characters`);
  return ok(t);
}

/** Strict YYYY-MM-DD that is a real calendar date. Accepts string, ISO string, or Date instance. Returns YYYY-MM-DD string. */
export function parseDateOnly(v: unknown, field: string): Parsed<string> {
  if (v === undefined || v === null || v === "") {
    return fail(`${field} must be a date in YYYY-MM-DD format`);
  }

  let strVal: string;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) {
      return fail(`${field} is not a valid date`);
    }
    return ok(v.toISOString().slice(0, 10));
  } else if (typeof v === "string") {
    strVal = v.trim();
  } else {
    return fail(`${field} must be a date in YYYY-MM-DD format`);
  }

  // If passed an ISO-8601 string like "2026-10-12T14:30:00.000Z", extract date portion
  if (/^\d{4}-\d{2}-\d{2}T/.test(strVal)) {
    strVal = strVal.slice(0, 10);
  }

  // Normalize DD-Mon-YYYY or DD Mon YYYY (e.g. 12-Oct-2026, 12-October-2026, 13 Oct 2026)
  const dMonY = strVal.match(/^(\d{1,2})[-/\s]([a-zA-Z]+)[-/\s](\d{4})$/);
  if (dMonY) {
    const day = dMonY[1].padStart(2, "0");
    const mStr = dMonY[2].toLowerCase();
    const monthNames: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      january: "01", february: "02", march: "03", april: "04", june: "06",
      july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
    };
    const month = monthNames[mStr.slice(0, 3)] || monthNames[mStr];
    if (month) {
      strVal = `${dMonY[3]}-${month}-${day}`;
    }
  }

  // Normalize DD-MM-YYYY or DD/MM/YYYY (e.g. 12/10/2026, 12-10-2026)
  const ddmmyyyy = strVal.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    strVal = `${year}-${month}-${day}`;
  }

  // Normalize YYYY/MM/DD
  const yyyymmdd = strVal.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, "0");
    const day = yyyymmdd[3].padStart(2, "0");
    strVal = `${year}-${month}-${day}`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    return fail(`${field} must be a date in YYYY-MM-DD format`);
  }

  const d = new Date(`${strVal}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== strVal) {
    return fail(`${field} is not a valid date`);
  }
  return ok(strVal);
}

export function parseTime(v: unknown, field: string, required = false): Parsed<string | null> {
  if (v === undefined || v === null || v === "") {
    return required ? fail(`${field} is required`) : ok(null);
  }
  if (typeof v !== "string") return fail(`${field} must be HH:MM (24h)`);
  let t = v.trim();
  // Support 12-hour AM/PM times (e.g. "06:00 AM", "07:30 PM")
  const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let hours = parseInt(m12[1], 10);
    const minutes = m12[2];
    const isPM = m12[3].toUpperCase() === "PM";
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    t = `${String(hours).padStart(2, "0")}:${minutes}`;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
    return fail(`${field} must be HH:MM (24h)`);
  }
  return ok(t);
}

/** Keep digits and a leading +; accept 7–15 digits (E.164 length range). */
export function normalizePhone(v: unknown, field: string): Parsed<string> {
  if (typeof v !== "string") return fail(`${field} is required`);
  const trimmed = v.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return fail(`${field} must be a valid phone number`);
  return ok(`${plus}${digits}`);
}

export function formatPlayerCode(n: number, prefix = "OFA"): string {
  return `${prefix}-${String(n).padStart(6, "0")}`;
}

// ─── Sports ───────────────────────────────────────────────────────────────────

export interface SportInput {
  name: string;
  description: string | null;
  active?: boolean;
  defaultBillingMethod?: BillingMethod;
}

export function parseSportInput(body: unknown, partial = false): Parsed<Partial<SportInput> & { name?: string }> {
  if (!isObj(body)) return fail("Invalid body");
  const out: Partial<SportInput> = {};

  if (!partial || body.name !== undefined) {
    const name = str(body.name, "name", 80);
    if (!name.ok) return name;
    out.name = name.value as string;
  }
  if (body.description !== undefined) {
    const d = str(body.description, "description", 500, false);
    if (!d.ok) return d;
    out.description = d.value;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return fail("active must be true or false");
    out.active = body.active;
  }
  if (body.defaultBillingMethod !== undefined) {
    if (!(BILLING_METHODS as readonly unknown[]).includes(body.defaultBillingMethod)) {
      return fail(`defaultBillingMethod must be one of ${BILLING_METHODS.join(", ")}`);
    }
    out.defaultBillingMethod = body.defaultBillingMethod as BillingMethod;
  }
  return ok(out);
}

// ─── Players ──────────────────────────────────────────────────────────────────

export interface PlayerInput {
  name: string;
  email?: string | null;
  mobileNumber?: string | null;
  dateOfBirth: string;
  age?: number | null;
  gender?: string | null;
  guardianName: string;
  guardianPhone: string;
  address: string | null;
  joiningDate: string;
  startTime: string | null;
  endTime: string | null;
  status: PlayerStatus;
  sportIds: string[];
  venue?: string | null;
  sessionsPerWeek?: string | null;
  monthlyFee?: number | null;
  admissionFee?: number | null;
  coachingType?: string | null;
  ageSegment?: string | null;
  trainingGroup?: string | null;
  idCardNumber?: string | null;
  copyStatus?: string | null;
  temporaryPassword?: string | null;
  photoUrl?: string | null;
}

export function parsePlayerInput(body: unknown, now: Date = new Date()): Parsed<PlayerInput> {
  if (!isObj(body)) return fail("Invalid body");

  const rawName = (body as any).name ?? (body as any).fullName;
  const name = str(rawName, "Player name", 120);
  if (!name.ok) return name;
  const dob = parseDateOnly(body.dateOfBirth, "Date of birth");
  if (!dob.ok) return dob;
  if (new Date(`${dob.value}T00:00:00.000Z`).getTime() > now.getTime()) {
    return fail("Date of birth cannot be in the future");
  }

  const guardianName = str((body as any).guardianName, "Guardian name", 120);
  if (!guardianName.ok) return guardianName;

  const phone = normalizePhone((body as any).guardianPhone, "Guardian number");
  if (!phone.ok) return phone;

  const address = str(body.address, "Residential address", 500, false);
  if (!address.ok) return address;

  // Gracefully default joiningDate / admissionDate to today if omitted or empty
  const rawJoining = (body as any).joiningDate ?? (body as any).admissionDate;
  const todayStr = now.toISOString().slice(0, 10);
  const joining =
    rawJoining !== undefined && rawJoining !== null && rawJoining !== ""
      ? parseDateOnly(rawJoining, "Joining date")
      : ok(todayStr);
  if (!joining.ok) return joining;

  const start = parseTime(body.startTime, "Start time");
  if (!start.ok) return start;
  const end = parseTime(body.endTime, "End time");
  if (!end.ok) return end;
  if (start.value && end.value && end.value <= start.value) {
    return fail("End time must be after start time");
  }

  let status: PlayerStatus = "ACTIVE";
  if (body.status !== undefined) {
    if (!(PLAYER_STATUSES as readonly unknown[]).includes(body.status as PlayerStatus)) {
      return fail(`Status must be one of ${PLAYER_STATUSES.join(", ")}`);
    }
    status = body.status as PlayerStatus;
  }

  if (!Array.isArray(body.sportIds) || body.sportIds.length === 0) {
    return fail("Select at least one preferred sport");
  }
  if (body.sportIds.length > 20 || !body.sportIds.every((s) => typeof s === "string" && s)) {
    return fail("sportIds must be a list of sport ids");
  }
  const sportIds = Array.from(new Set(body.sportIds as string[]));

  return ok({
    name: name.value as string,
    email: typeof (body as any).email === "string" ? (body as any).email.trim() : null,
    mobileNumber: typeof (body as any).mobileNumber === "string" ? (body as any).mobileNumber.trim() : null,
    dateOfBirth: dob.value,
    age: typeof (body as any).age === "number" ? (body as any).age : (Number((body as any).age) || null),
    gender: typeof (body as any).gender === "string" ? (body as any).gender.trim() : null,
    guardianName: guardianName.value as string,
    guardianPhone: phone.value,
    address: address.value,
    joiningDate: joining.value,
    startTime: start.value,
    endTime: end.value,
    status,
    sportIds,
    venue: typeof (body as any).venue === "string" ? (body as any).venue.trim() : null,
    sessionsPerWeek: typeof (body as any).sessionsPerWeek === "string" ? (body as any).sessionsPerWeek.trim() : null,
    monthlyFee: typeof (body as any).monthlyFee === "number" ? (body as any).monthlyFee : (Number((body as any).monthlyFee) || null),
    admissionFee: typeof (body as any).admissionFee === "number" ? (body as any).admissionFee : (Number((body as any).admissionFee) || null),
    coachingType: typeof (body as any).coachingType === "string" ? (body as any).coachingType.trim() : null,
    ageSegment: typeof (body as any).ageSegment === "string" ? (body as any).ageSegment.trim() : null,
    trainingGroup: typeof (body as any).trainingGroup === "string" ? (body as any).trainingGroup.trim() : null,
    idCardNumber: typeof (body as any).idCardNumber === "string" ? (body as any).idCardNumber.trim() : null,
    copyStatus: typeof (body as any).copyStatus === "string" ? (body as any).copyStatus.trim() : null,
    temporaryPassword: typeof (body as any).temporaryPassword === "string" ? (body as any).temporaryPassword.trim() : null,
    photoUrl: typeof (body as any).photoUrl === "string" ? (body as any).photoUrl.trim() : null,
  });
}

/** Parse ?limit= safely into 1..max. */
export function parseLimit(raw: string | null, def = 25, max = 100): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, 1), max);
}

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "LEAVE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const SESSION_STATUSES = ["SCHEDULED", "HELD", "CANCELLED", "HOLIDAY"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface ParsedBatchInput {
  name: string;
  sportId: string;
  coachUserId: string | null;
  days: number[];
  startTime: string;
  endTime: string;
  capacity: number | null;
  facilityId: string | null;
  active: boolean;
}

export function parseBatchInput(body: unknown): Parsed<ParsedBatchInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const name = str(body.name, "Batch name", 100, true);
  if (!name.ok) return name;
  const sportId = str(body.sportId, "Sport ID", 100, true);
  if (!sportId.ok) return sportId;
  const coachUserId = str(body.coachUserId, "Coach user ID", 100, false);
  if (!coachUserId.ok) return coachUserId;

  if (!Array.isArray(body.days) || body.days.length === 0) {
    return fail("Batch must have at least one training day");
  }
  const daysSet = new Set<number>();
  for (const d of body.days) {
    if (typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 6) {
      return fail("Training days must be integers between 0 (Sunday) and 6 (Saturday)");
    }
    daysSet.add(d);
  }
  const days = Array.from(daysSet).sort((a, b) => a - b);

  const start = parseTime(body.startTime, "Start time", true);
  if (!start.ok) return start;
  const end = parseTime(body.endTime, "End time", true);
  if (!end.ok) return end;
  if (end.value! <= start.value!) {
    return fail("End time must be after start time");
  }

  let capacity: number | null = null;
  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== "") {
    const c = Number(body.capacity);
    if (!Number.isInteger(c) || c < 1 || c > 500) {
      return fail("Capacity must be an integer between 1 and 500");
    }
    capacity = c;
  }

  const facilityId = str(body.facilityId, "Facility ID", 100, false);
  if (!facilityId.ok) return facilityId;

  const active = body.active !== undefined ? Boolean(body.active) : true;

  return ok({
    name: name.value as string,
    sportId: sportId.value as string,
    coachUserId: coachUserId.value,
    days,
    startTime: start.value as string,
    endTime: end.value as string,
    capacity,
    facilityId: facilityId.value,
    active,
  });
}

export interface ParsedAttendanceRecord {
  playerId: string;
  status: AttendanceStatus;
}

export interface ParsedAttendanceBulkInput {
  sessionId: string;
  records: ParsedAttendanceRecord[];
  opId: string | null;
}

export function parseAttendanceBulkInput(body: unknown): Parsed<ParsedAttendanceBulkInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const sessionId = str(body.sessionId, "Session ID", 100, true);
  if (!sessionId.ok) return sessionId;

  if (!Array.isArray(body.records) || body.records.length === 0) {
    return fail("records must be a non-empty array");
  }
  if (body.records.length > 300) {
    return fail("Cannot submit attendance for more than 300 players at once");
  }

  const seenPlayers = new Set<string>();
  const parsedRecords: ParsedAttendanceRecord[] = [];

  for (let i = 0; i < body.records.length; i++) {
    const r = body.records[i];
    if (!isObj(r)) return fail(`Record at index ${i} must be an object`);
    const playerId = str(r.playerId, `Player ID at index ${i}`, 100, true);
    if (!playerId.ok) return playerId;

    if (seenPlayers.has(playerId.value!)) {
      return fail(`Duplicate player ID ${playerId.value} in attendance list`);
    }
    seenPlayers.add(playerId.value!);

    if (
      typeof r.status !== "string" ||
      !(ATTENDANCE_STATUSES as readonly string[]).includes(r.status)
    ) {
      return fail(
        `Invalid status '${r.status}' at index ${i}. Must be one of: ${ATTENDANCE_STATUSES.join(", ")}`
      );
    }

    parsedRecords.push({
      playerId: playerId.value!,
      status: r.status as AttendanceStatus,
    });
  }

  const opId = str(body.opId, "Operation ID", 128, false);
  if (!opId.ok) return opId;

  return ok({
    sessionId: sessionId.value!,
    records: parsedRecords,
    opId: opId.value,
  });
}

export interface ParsedAttendanceCorrectionInput {
  attendanceId: string;
  newStatus: AttendanceStatus;
  reason: string;
}

export function parseAttendanceCorrectionInput(
  body: unknown
): Parsed<ParsedAttendanceCorrectionInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const attendanceId = str(body.attendanceId, "Attendance ID", 100, true);
  if (!attendanceId.ok) return attendanceId;

  if (
    typeof body.newStatus !== "string" ||
    !(ATTENDANCE_STATUSES as readonly string[]).includes(body.newStatus)
  ) {
    return fail(`Invalid newStatus. Must be one of: ${ATTENDANCE_STATUSES.join(", ")}`);
  }

  const reason = str(body.reason, "Correction reason", 300, true);
  if (!reason.ok) return reason;
  if ((reason.value as string).length < 3) {
    return fail("Correction reason must be at least 3 characters");
  }

  return ok({
    attendanceId: attendanceId.value!,
    newStatus: body.newStatus as AttendanceStatus,
    reason: reason.value as string,
  });
}

export const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INVOICE_STATUSES = ["DRAFT", "FINALIZED", "PARTIALLY_PAID", "PAID", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "REJECTED"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface ParsedFeePlanInput {
  sportId: string;
  name: string;
  billingMethod: BillingMethod;
  baseAmount: number;
  currency: string;
  billingPeriod: string;
  proRateMidPeriod: boolean;
  taxRate: number;
  policies: Record<string, unknown> | null;
  active: boolean;
}

export function parseFeePlanInput(body: unknown): Parsed<ParsedFeePlanInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const sportId = str(body.sportId, "Sport ID", 100, true);
  if (!sportId.ok) return sportId;

  const name = str(body.name, "Plan name", 100, true);
  if (!name.ok) return name;

  if (
    typeof body.billingMethod !== "string" ||
    !(BILLING_METHODS as readonly string[]).includes(body.billingMethod)
  ) {
    return fail(`billingMethod must be one of: ${BILLING_METHODS.join(", ")}`);
  }

  const baseAmount = Number(body.baseAmount);
  if (!Number.isFinite(baseAmount) || baseAmount < 0) {
    return fail("baseAmount must be a non-negative number");
  }

  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "INR";
  const billingPeriod = typeof body.billingPeriod === "string" && body.billingPeriod.trim() ? body.billingPeriod.trim().toUpperCase() : "MONTHLY";
  const proRateMidPeriod = body.proRateMidPeriod !== undefined ? Boolean(body.proRateMidPeriod) : true;

  let taxRate = 0;
  if (body.taxRate !== undefined && body.taxRate !== null) {
    const t = Number(body.taxRate);
    if (!Number.isFinite(t) || t < 0 || t > 100) {
      return fail("taxRate must be a number between 0 and 100 (e.g. 18 or 0.18)");
    }
    taxRate = t > 1 ? t / 100 : t;
  }

  const policies = isObj(body.policies) ? (body.policies as Record<string, unknown>) : null;
  const active = body.active !== undefined ? Boolean(body.active) : true;

  return ok({
    sportId: sportId.value!,
    name: name.value!,
    billingMethod: body.billingMethod as BillingMethod,
    baseAmount,
    currency,
    billingPeriod,
    proRateMidPeriod,
    taxRate,
    policies,
    active,
  });
}

export interface ParsedPlayerFeeAssignmentInput {
  playerId: string;
  feePlanId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  discountAmount: number;
  discountReason: string | null;
}

export function parsePlayerFeeAssignmentInput(
  body: unknown,
  now: Date = new Date()
): Parsed<ParsedPlayerFeeAssignmentInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const playerId = str(body.playerId, "Player ID", 100, true);
  if (!playerId.ok) return playerId;

  const feePlanId = str(body.feePlanId, "Fee plan ID", 100, true);
  if (!feePlanId.ok) return feePlanId;

  // Default effectiveFrom to today if omitted or empty
  const todayStr = now.toISOString().slice(0, 10);
  const from =
    body.effectiveFrom !== undefined && body.effectiveFrom !== null && body.effectiveFrom !== ""
      ? parseDateOnly(body.effectiveFrom, "Effective from date")
      : ok(todayStr);
  if (!from.ok) return from;

  let to: string | null = null;
  if (body.effectiveTo) {
    const toParsed = parseDateOnly(body.effectiveTo, "Effective to date");
    if (!toParsed.ok) return toParsed;
    to = toParsed.value;
    if (to < from.value) {
      return fail("effectiveTo date must be on or after effectiveFrom date");
    }
  }

  let discountAmount = 0;
  if (body.discountAmount !== undefined && body.discountAmount !== null) {
    const d = Number(body.discountAmount);
    if (!Number.isFinite(d) || d < 0) {
      return fail("discountAmount must be a non-negative number");
    }
    discountAmount = d;
  }

  const discountReason = str(body.discountReason, "Discount reason", 200, false);
  if (!discountReason.ok) return discountReason;

  return ok({
    playerId: playerId.value!,
    feePlanId: feePlanId.value!,
    effectiveFrom: from.value,
    effectiveTo: to,
    discountAmount,
    discountReason: discountReason.value,
  });
}

export interface ParsedPaymentInput {
  playerId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  invoiceId: string | null;
  notes: string | null;
  paidAt: string | null;
}

export function parsePaymentInput(
  body: unknown,
  now: Date = new Date()
): Parsed<ParsedPaymentInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const playerId = str(body.playerId, "Player ID", 100, true);
  if (!playerId.ok) return playerId;

  // Support both amount (in currency units/rupees) and amountCents (mobile pattern)
  let amount = 0;
  if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
    amount = Number(body.amount);
  } else if (body.amountCents !== undefined && body.amountCents !== null && body.amountCents !== "") {
    amount = Number(body.amountCents) / 100;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("amount must be a positive number");
  }

  // Support both method and paymentMethod
  const rawMethod = (body.method ?? body.paymentMethod);
  if (
    typeof rawMethod !== "string" ||
    !(PAYMENT_METHODS as readonly string[]).includes(rawMethod as PaymentMethod)
  ) {
    return fail(`method must be one of: ${PAYMENT_METHODS.join(", ")}`);
  }

  const reference = str(body.reference, "Payment reference", 100, false);
  if (!reference.ok) return reference;

  const invoiceId = str(body.invoiceId, "Invoice ID", 100, false);
  if (!invoiceId.ok) return invoiceId;

  const notes = str(body.notes, "Notes", 300, false);
  if (!notes.ok) return notes;

  let paidAt: string | null = null;
  if (body.paidAt !== undefined && body.paidAt !== null && body.paidAt !== "") {
    const p = parseDateOnly(body.paidAt, "Paid date");
    if (!p.ok) return p;
    paidAt = p.value;
  } else {
    paidAt = now.toISOString().slice(0, 10);
  }

  return ok({
    playerId: playerId.value!,
    amount,
    method: rawMethod as PaymentMethod,
    reference: reference.value,
    invoiceId: invoiceId.value,
    notes: notes.value,
    paidAt,
  });
}

export interface ParsedFacilityInput {
  name: string;
  type: string | null;
  capacity: number | null;
  description: string | null;
  active: boolean;
}

export function parseFacilityInput(body: unknown): Parsed<ParsedFacilityInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const name = str(body.name, "Facility name", 100, true);
  if (!name.ok) return name;

  const type = str(body.type, "Facility type", 50, false);
  if (!type.ok) return type;

  let capacity: number | null = null;
  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== "") {
    const c = Number(body.capacity);
    if (!Number.isInteger(c) || c < 1) {
      return fail("capacity must be a positive integer");
    }
    capacity = c;
  }

  const description = str(body.description, "Description", 300, false);
  if (!description.ok) return description;

  const active = body.active !== undefined ? Boolean(body.active) : true;

  return ok({
    name: name.value!,
    type: type.value,
    capacity,
    description: description.value,
    active,
  });
}

export interface ParsedBookingInput {
  facilityId: string;
  title: string | null;
  startAt: string;
  endAt: string;
  notes: string | null;
}

export function parseBookingInput(body: unknown): Parsed<ParsedBookingInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const facilityId = str(body.facilityId, "Facility ID", 100, true);
  if (!facilityId.ok) return facilityId;

  const title = str(body.title, "Booking title", 100, false);
  if (!title.ok) return title;

  // Support both startAt and startTime
  const rawStart = (body as any).startAt ?? (body as any).startTime;
  if (typeof rawStart !== "string" || !rawStart) {
    return fail("startAt timestamp is required");
  }
  const sDate = new Date(rawStart);
  if (Number.isNaN(sDate.getTime())) {
    return fail("startAt must be a valid ISO date/time");
  }

  // Support both endAt and endTime
  const rawEnd = (body as any).endAt ?? (body as any).endTime;
  if (typeof rawEnd !== "string" || !rawEnd) {
    return fail("endAt timestamp is required");
  }
  const eDate = new Date(rawEnd);
  if (Number.isNaN(eDate.getTime())) {
    return fail("endAt must be a valid ISO date/time");
  }

  if (eDate <= sDate) {
    return fail("endAt must be strictly after startAt");
  }

  const notes = str(body.notes, "Notes", 300, false);
  if (!notes.ok) return notes;

  return ok({
    facilityId: facilityId.value!,
    title: title.value,
    startAt: sDate.toISOString(),
    endAt: eDate.toISOString(),
    notes: notes.value,
  });
}

export const ITEM_CATEGORIES = ["JERSEY", "EQUIPMENT", "UNIFORM", "OTHER"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_EVENT_TYPES = ["ISSUED", "RETURNED", "LOST", "REPLACED"] as const;
export type ItemEventType = (typeof ITEM_EVENT_TYPES)[number];

export const ASSESSMENT_FIELD_TYPES = ["number", "text", "scale", "boolean"] as const;
export type AssessmentFieldType = (typeof ASSESSMENT_FIELD_TYPES)[number];

export interface AssessmentFieldDefinition {
  key: string;
  label: string;
  type: AssessmentFieldType;
  unit?: string;
  min?: number;
  max?: number;
}

export interface ParsedAssessmentTemplateInput {
  sportId: string | null;
  name: string;
  description: string | null;
  fields: AssessmentFieldDefinition[];
  active: boolean;
}

export function parseAssessmentTemplateInput(body: unknown): Parsed<ParsedAssessmentTemplateInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const name = str(body.name, "Template name", 100, true);
  if (!name.ok) return name;

  const sportId = str(body.sportId, "Sport ID", 100, false);
  if (!sportId.ok) return sportId;

  const description = str(body.description, "Description", 500, false);
  if (!description.ok) return description;

  if (!Array.isArray(body.fields) || body.fields.length === 0) {
    return fail("Template must define at least one assessment field");
  }

  const seenKeys = new Set<string>();
  const parsedFields: AssessmentFieldDefinition[] = [];

  for (let i = 0; i < body.fields.length; i++) {
    const f = body.fields[i];
    if (!isObj(f)) return fail(`Field at index ${i} must be an object`);

    const key = str(f.key, `Field key at index ${i}`, 50, true);
    if (!key.ok) return key;

    const normalizedKey = (key.value as string).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (seenKeys.has(normalizedKey)) {
      return fail(`Duplicate field key '${normalizedKey}' in template`);
    }
    seenKeys.add(normalizedKey);

    const label = str(f.label, `Field label at index ${i}`, 100, true);
    if (!label.ok) return label;

    if (
      typeof f.type !== "string" ||
      !(ASSESSMENT_FIELD_TYPES as readonly string[]).includes(f.type)
    ) {
      return fail(`Field type '${f.type}' at index ${i} must be one of: ${ASSESSMENT_FIELD_TYPES.join(", ")}`);
    }

    const unit = str(f.unit, `Unit at index ${i}`, 30, false);
    if (!unit.ok) return unit;

    parsedFields.push({
      key: normalizedKey,
      label: label.value as string,
      type: f.type as AssessmentFieldType,
      ...(unit.value ? { unit: unit.value } : {}),
      ...(typeof f.min === "number" ? { min: f.min } : {}),
      ...(typeof f.max === "number" ? { max: f.max } : {}),
    });
  }

  const active = body.active !== undefined ? Boolean(body.active) : true;

  return ok({
    sportId: sportId.value,
    name: name.value as string,
    description: description.value,
    fields: parsedFields,
    active,
  });
}

export interface ParsedAssessmentResultInput {
  playerId: string;
  scores: Record<string, unknown>;
  notes?: string | null;
}

export interface ParsedAssessmentInput {
  templateId: string;
  batchId: string | null;
  assessedDate: string;
  notes: string | null;
  results: ParsedAssessmentResultInput[];
}

export function parseAssessmentInput(body: unknown, now: Date = new Date()): Parsed<ParsedAssessmentInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const templateId = str(body.templateId, "Template ID", 100, true);
  if (!templateId.ok) return templateId;

  const batchId = str(body.batchId, "Batch ID", 100, false);
  if (!batchId.ok) return batchId;

  // Default assessedDate to today if omitted or empty
  const todayStr = now.toISOString().slice(0, 10);
  const dateParsed =
    (body as any).assessedDate !== undefined && (body as any).assessedDate !== null && (body as any).assessedDate !== ""
      ? parseDateOnly((body as any).assessedDate, "Assessed date")
      : ok(todayStr);
  if (!dateParsed.ok) return dateParsed;

  const notes = str(body.notes, "Notes", 500, false);
  if (!notes.ok) return notes;

  if (!Array.isArray(body.results) || body.results.length === 0) {
    return fail("results must be a non-empty array of player scores");
  }

  const seenPlayers = new Set<string>();
  const parsedResults: ParsedAssessmentResultInput[] = [];

  for (let i = 0; i < body.results.length; i++) {
    const r = body.results[i];
    if (!isObj(r)) return fail(`Result at index ${i} must be an object`);

    const playerId = str(r.playerId, `Player ID at index ${i}`, 100, true);
    if (!playerId.ok) return playerId;

    if (seenPlayers.has(playerId.value as string)) {
      return fail(`Duplicate player ID '${playerId.value}' in assessment`);
    }
    seenPlayers.add(playerId.value as string);

    if (!isObj(r.scores)) {
      return fail(`Scores for player at index ${i} must be an object`);
    }

    const rNotes = str(r.notes, `Notes for player at index ${i}`, 300, false);
    if (!rNotes.ok) return rNotes;

    parsedResults.push({
      playerId: playerId.value as string,
      scores: r.scores as Record<string, unknown>,
      notes: rNotes.value,
    });
  }

  return ok({
    templateId: templateId.value as string,
    batchId: batchId.value,
    assessedDate: dateParsed.value,
    notes: notes.value,
    results: parsedResults,
  });
}

export interface ParsedItemTypeInput {
  name: string;
  description: string | null;
  category: ItemCategory;
  active: boolean;
}

export function parseItemTypeInput(body: unknown): Parsed<ParsedItemTypeInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const name = str(body.name, "Item type name", 100, true);
  if (!name.ok) return name;

  const description = str(body.description, "Description", 300, false);
  if (!description.ok) return description;

  const categoryRaw = typeof body.category === "string" ? body.category.toUpperCase() : "OTHER";
  if (!(ITEM_CATEGORIES as readonly string[]).includes(categoryRaw)) {
    return fail(`category must be one of: ${ITEM_CATEGORIES.join(", ")}`);
  }

  const active = body.active !== undefined ? Boolean(body.active) : true;

  return ok({
    name: name.value as string,
    description: description.value,
    category: categoryRaw as ItemCategory,
    active,
  });
}

export interface ParsedItemAllocationInput {
  itemTypeId: string;
  playerId: string;
  eventType: ItemEventType;
  quantity: number;
  size: string | null;
  number: string | null;
  notes: string | null;
}

export function parseItemAllocationInput(body: unknown): Parsed<ParsedItemAllocationInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const itemTypeId = str(body.itemTypeId, "Item type ID", 100, true);
  if (!itemTypeId.ok) return itemTypeId;

  const playerId = str(body.playerId, "Player ID", 100, true);
  if (!playerId.ok) return playerId;

  const eventTypeRaw = typeof body.eventType === "string" ? body.eventType.toUpperCase() : "ISSUED";
  if (!(ITEM_EVENT_TYPES as readonly string[]).includes(eventTypeRaw)) {
    return fail(`eventType must be one of: ${ITEM_EVENT_TYPES.join(", ")}`);
  }

  let quantity = 1;
  if (body.quantity !== undefined && body.quantity !== null && body.quantity !== "") {
    const q = Number(body.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 100) {
      return fail("quantity must be an integer between 1 and 100");
    }
    quantity = q;
  }

  const size = str(body.size, "Size", 20, false);
  if (!size.ok) return size;

  const number = str(body.number, "Jersey / item number", 20, false);
  if (!number.ok) return number;

  const notes = str(body.notes, "Notes", 300, false);
  if (!notes.ok) return notes;

  return ok({
    itemTypeId: itemTypeId.value as string,
    playerId: playerId.value as string,
    eventType: eventTypeRaw as ItemEventType,
    quantity,
    size: size.value,
    number: number.value,
    notes: notes.value,
  });
}

export const ANNOUNCEMENT_AUDIENCES = ["ALL", "STAFF", "GUARDIANS", "SPECIFIC_SPORT"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export interface ParsedAnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  sportId: string | null;
  expiresAt: string | null;
}

export function parseAnnouncementInput(body: unknown): Parsed<ParsedAnnouncementInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const title = str(body.title, "Announcement title", 200, true);
  if (!title.ok) return title;

  const content = str(body.body, "Announcement body", 5000, true);
  if (!content.ok) return content;

  const audRaw = typeof body.audience === "string" ? body.audience.toUpperCase() : "ALL";
  if (!(ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(audRaw)) {
    return fail(`audience must be one of: ${ANNOUNCEMENT_AUDIENCES.join(", ")}`);
  }

  const sportId = str(body.sportId, "Sport ID", 100, false);
  if (!sportId.ok) return sportId;

  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const exp = new Date(String(body.expiresAt));
    if (Number.isNaN(exp.getTime())) {
      return fail("expiresAt must be a valid ISO date");
    }
    expiresAt = exp.toISOString();
  }

  return ok({
    title: title.value as string,
    body: content.value as string,
    audience: audRaw as AnnouncementAudience,
    sportId: sportId.value,
    expiresAt,
  });
}

export interface ParsedNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  dedupeKey: string | null;
}

export function parseNotificationInput(body: unknown): Parsed<ParsedNotificationInput> {
  if (!isObj(body)) return fail("Request body must be a JSON object");

  const userId = str(body.userId, "User ID", 100, true);
  if (!userId.ok) return userId;

  const type = str(body.type, "Notification type", 100, true);
  if (!type.ok) return type;

  const title = str(body.title, "Notification title", 200, true);
  if (!title.ok) return title;

  const notifBody = str(body.body, "Notification body", 2000, true);
  if (!notifBody.ok) return notifBody;

  const dedupeKey = str(body.dedupeKey, "Dedupe key", 100, false);
  if (!dedupeKey.ok) return dedupeKey;

  const payload = isObj(body.payload) ? (body.payload as Record<string, unknown>) : null;

  return ok({
    userId: userId.value as string,
    type: type.value as string,
    title: title.value as string,
    body: notifBody.value as string,
    payload,
    dedupeKey: dedupeKey.value,
  });
}

