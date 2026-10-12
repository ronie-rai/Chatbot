/**
 * Pure billing engine - no side effects, fully unit-testable.
 */
import Decimal from "decimal.js";

export type BillingMethod = "FIXED" | "PER_SESSION" | "PRO_RATA";

export interface FeePlanSnapshot {
  billingMethod: BillingMethod;
  baseAmount: string;
  taxRate: string;
  discountAmount?: string;
  proRateMidPeriod: boolean;
  policies?: {
    excludeTrialSessions?: boolean;
    excludeMakeupSessions?: boolean;
    excludeApprovedLeave?: boolean;
  };
}

export interface SessionRecord {
  id: string;
  date: string;
  status: "SCHEDULED" | "HELD" | "CANCELLED" | "HOLIDAY";
  isTrialSession?: boolean;
  isMakeupSession?: boolean;
}

export interface AttendanceRecord {
  sessionId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "LEAVE";
}

export interface BillingContext {
  period: string;
  plan: FeePlanSnapshot;
  sessions: SessionRecord[];
  attendance: AttendanceRecord[];
  joiningDate?: string;
  withdrawalDate?: string;
  extraDiscountAmount?: string;
  extraDiscountReason?: string;
}

export interface InvoiceLine {
  description: string;
  formulaSnapshot: Record<string, unknown>;
  amount: string;
}

export interface InvoiceResult {
  lines: InvoiceLine[];
  subtotal: string;
  discount: string;
  taxAmount: string;
  totalAmount: string;
  summary: string;
}

function d(v: string | number): Decimal { return new Decimal(v); }

function daysInPeriod(period: string): string[] {
  const [y, m] = period.split("-").map(Number);
  const days: string[] = [];
  const date = new Date(y, m - 1, 1);
  while (date.getMonth() === m - 1) {
    days.push(date.toISOString().slice(0, 10));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function calculateInvoice(ctx: BillingContext): InvoiceResult {
  const { plan, sessions, attendance, period } = ctx;
  const lines: InvoiceLine[] = [];
  const allDays = daysInPeriod(period);
  const totalDays = allDays.length;

  const heldSessions = sessions.filter((s) => {
    if (s.status !== "HELD") return false;
    if (plan.policies?.excludeTrialSessions && s.isTrialSession) return false;
    if (plan.policies?.excludeMakeupSessions && s.isMakeupSession) return false;
    return true;
  });

  const attendanceMap = new Map(attendance.map((a) => [a.sessionId, a.status]));
  const attendedCount = heldSessions.filter((s) => {
    const att = attendanceMap.get(s.id);
    return att === "PRESENT" || att === "LATE";
  }).length;

  let baseLine: InvoiceLine;

  if (plan.billingMethod === "FIXED") {
    let amount = d(plan.baseAmount);
    let note = "";
    if (plan.proRateMidPeriod && ctx.joiningDate && ctx.joiningDate > `${period}-01`) {
      const activeDays = allDays.filter((day) => day >= ctx.joiningDate!).length;
      amount = amount.mul(activeDays).div(totalDays).toDecimalPlaces(2);
      note = ` (pro-rated ${activeDays}/${totalDays} days)`;
    }
    if (plan.proRateMidPeriod && ctx.withdrawalDate) {
      const periodEnd = allDays[allDays.length - 1];
      if (ctx.withdrawalDate < periodEnd) {
        const activeDays = allDays.filter((day) => day <= ctx.withdrawalDate!).length;
        amount = d(plan.baseAmount).mul(activeDays).div(totalDays).toDecimalPlaces(2);
        note = ` (pro-rated ${activeDays}/${totalDays} days - withdrawal)`;
      }
    }
    baseLine = {
      description: `Monthly fee${note}`,
      formulaSnapshot: { method: "FIXED", baseAmount: plan.baseAmount, totalDays, joiningDate: ctx.joiningDate, amount: amount.toFixed(2) },
      amount: amount.toFixed(2),
    };

  } else if (plan.billingMethod === "PER_SESSION") {
    const amount = d(plan.baseAmount).mul(attendedCount).toDecimalPlaces(2);
    baseLine = {
      description: `Session fee (${attendedCount} attended x Rs.${plan.baseAmount})`,
      formulaSnapshot: { method: "PER_SESSION", ratePerSession: plan.baseAmount, heldSessions: heldSessions.length, attendedSessions: attendedCount, amount: amount.toFixed(2) },
      amount: amount.toFixed(2),
    };

  } else {
    // PRO_RATA - division-by-zero safe
    const scheduledBillable = heldSessions.length;
    if (scheduledBillable === 0) {
      baseLine = {
        description: "Monthly fee (pro-rata) - no billable sessions scheduled",
        formulaSnapshot: { method: "PRO_RATA", baseAmount: plan.baseAmount, heldSessions: 0, note: "denominator=0; amount=0" },
        amount: "0.00",
      };
    } else {
      const amount = d(plan.baseAmount).mul(attendedCount).div(scheduledBillable).toDecimalPlaces(2);
      baseLine = {
        description: `Monthly fee (pro-rata: ${attendedCount}/${scheduledBillable} sessions)`,
        formulaSnapshot: { method: "PRO_RATA", baseAmount: plan.baseAmount, heldSessions: scheduledBillable, attendedSessions: attendedCount, amount: amount.toFixed(2) },
        amount: amount.toFixed(2),
      };
    }
  }

  lines.push(baseLine);

  if (plan.policies?.excludeApprovedLeave) {
    const leaveCount = heldSessions.filter((s) => attendanceMap.get(s.id) === "LEAVE").length;
    if (leaveCount > 0) {
      lines.push({ description: `Approved leave (${leaveCount} session${leaveCount > 1 ? "s" : ""})`, formulaSnapshot: { leaveCount }, amount: "0.00" });
    }
  }

  const subtotal = lines.reduce((acc, l) => acc.plus(d(l.amount)), d(0)).toDecimalPlaces(2);

  let totalDiscount = d(plan.discountAmount ?? "0");
  if (ctx.extraDiscountAmount) {
    const extra = d(ctx.extraDiscountAmount);
    totalDiscount = totalDiscount.plus(extra);
    lines.push({ description: ctx.extraDiscountReason ?? "Concession / discount", formulaSnapshot: { discountAmount: ctx.extraDiscountAmount }, amount: extra.neg().toFixed(2) });
  }

  const discounted = subtotal.minus(totalDiscount).toDecimalPlaces(2);
  const taxAmount = discounted.mul(d(plan.taxRate)).toDecimalPlaces(2);
  const totalAmount = discounted.plus(taxAmount).toDecimalPlaces(2);

  return {
    lines,
    subtotal: subtotal.toFixed(2),
    discount: totalDiscount.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    summary: `${period} | ${plan.billingMethod} | held=${heldSessions.length} attended=${attendedCount} | total=Rs.${totalAmount.toFixed(2)}`,
  };
}