import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculateInvoice } from "@/lib/academy/billing/engine";
import type { BillingContext, SessionRecord, AttendanceRecord } from "@/lib/academy/billing/engine";
import { recordAudit } from "@/lib/academy/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/finance/invoices
 * Lists invoices for the tenant. Query: playerId, sportId, period (YYYY-MM), status, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "invoices", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const playerId = sp.get("playerId");
    const sportId = sp.get("sportId");
    const period = sp.get("period");
    const status = sp.get("status");
    const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "25", 10) || 25, 1), 100);
    const cursor = sp.get("cursor");

    const rows = await prisma.academyInvoice.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(playerId ? { playerId } : {}),
        ...(sportId ? { sportId } : {}),
        ...(period ? { period } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { lines: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: { items: page, nextCursor: hasMore ? page[page.length - 1].id : null },
    });
  } catch (error) {
    console.error("[GET /api/academy/finance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load invoices");
  }
}

/**
 * POST /api/academy/finance/invoices
 * Generates (or previews) an invoice for a player+sport+period.
 * Body: { playerId, sportId, period, preview? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "invoices", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: { playerId?: string; sportId?: string; period?: string; preview?: boolean };
    try { body = await request.json(); } catch { return academyError(400, "INVALID_JSON", "Invalid JSON body"); }

    const { playerId, sportId, period, preview = false } = body;
    if (!playerId || !sportId || !period) {
      return academyError(400, "VALIDATION_ERROR", "playerId, sportId, and period are required");
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return academyError(400, "VALIDATION_ERROR", "period must be YYYY-MM");
    }

    const player = await prisma.academyPlayer.findFirst({
      where: { id: playerId, tenantId: ctx.tenantId },
      select: { id: true, name: true, playerCode: true, joiningDate: true, archivedAt: true },
    });
    if (!player) return academyError(404, "NOT_FOUND", "Player not found");

    const assignment = await prisma.academyPlayerFeeAssignment.findFirst({
      where: {
        tenantId: ctx.tenantId,
        playerId,
        sportId,
        effectiveFrom: { lte: new Date(`${period}-28`) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(`${period}-01`) } }],
      },
      include: { feePlan: true },
      orderBy: { effectiveFrom: "desc" },
    });

    if (!assignment) {
      return academyError(404, "NO_FEE_PLAN", "No active fee plan assigned for this player/sport/period");
    }

    let sessions: SessionRecord[] = [];
    let attendance: AttendanceRecord[] = [];

    const monthStart = new Date(`${period}-01T00:00:00.000Z`);
    const [pYear, pMonth] = period.split("-").map(Number);
    const nextMonthStart = new Date(Date.UTC(pMonth === 12 ? pYear + 1 : pYear, pMonth === 12 ? 0 : pMonth, 1));

    try {
      const batchSessions = await prisma.academySession.findMany({
        where: {
          tenantId: ctx.tenantId,
          sportId,
          date: { gte: monthStart, lt: nextMonthStart },
          batch: {
            enrollments: {
              some: {
                playerId,
                OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
              },
            },
          },
        },
        select: { id: true, date: true, status: true },
      });

      sessions = batchSessions.map((s) => ({
        id: s.id,
        date: s.date.toISOString().slice(0, 10),
        status: s.status as SessionRecord["status"],
        isTrialSession: false,
        isMakeupSession: false,
      }));

      if (sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);
        const attRows = await prisma.academyAttendance.findMany({
          where: { sessionId: { in: sessionIds }, playerId },
          select: { sessionId: true, status: true },
        });
        attendance = attRows.map((a) => ({
          sessionId: a.sessionId,
          status: a.status as AttendanceRecord["status"],
        }));
      }
    } catch {
      // Sessions may be empty
    }

    const plan = assignment.feePlan;
    const billingCtx: BillingContext = {
      period,
      plan: {
        billingMethod: plan.billingMethod as BillingContext["plan"]["billingMethod"],
        baseAmount: plan.baseAmount.toString(),
        taxRate: plan.taxRate.toString(),
        discountAmount: assignment.discountAmount.gt(0) ? assignment.discountAmount.toString() : undefined,
        proRateMidPeriod: plan.proRateMidPeriod,
        policies: (plan.policies as BillingContext["plan"]["policies"]) ?? undefined,
      },
      sessions,
      attendance,
      joiningDate: player.joiningDate.toISOString().slice(0, 10),
      withdrawalDate: player.archivedAt ? player.archivedAt.toISOString().slice(0, 10) : undefined,
    };

    const result = calculateInvoice(billingCtx);

    if (preview) {
      return NextResponse.json({ ok: true, data: { preview: true, ...result } });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.academyInvoice.findFirst({
        where: { tenantId: ctx.tenantId, playerId, sportId, period },
      });
      if (existing && existing.status !== "DRAFT") {
        throw Object.assign(new Error("Invoice already finalized"), { code: "ALREADY_FINALIZED" });
      }

      const lineData = result.lines.map((l, i) => ({
        description: l.description,
        formulaSnapshot: l.formulaSnapshot as Prisma.InputJsonValue,
        amount: new Prisma.Decimal(l.amount),
        sortOrder: i,
      }));

      const sharedFields = {
        tenantId: ctx.tenantId,
        playerId,
        sportId,
        feePlanId: plan.id,
        period,
        status: "DRAFT",
        subtotal: new Prisma.Decimal(result.subtotal),
        discount: new Prisma.Decimal(result.discount),
        taxAmount: new Prisma.Decimal(result.taxAmount),
        totalAmount: new Prisma.Decimal(result.totalAmount),
        createdBy: ctx.userId,
      };

      const inv = existing
        ? await tx.academyInvoice.update({
            where: { id: existing.id },
            data: { ...sharedFields, lines: { deleteMany: {}, create: lineData } },
            include: { lines: true },
          })
        : await tx.academyInvoice.create({
            data: { ...sharedFields, lines: { create: lineData } },
            include: { lines: true },
          });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "invoice.generated",
        entityType: "academy_invoice",
        entityId: inv.id,
        summary: `Invoice for ${player.name} (${player.playerCode}) period ${period}: Rs.${result.totalAmount}`,
        after: { period, playerId, sportId, totalAmount: result.totalAmount },
      });
      return inv;
    });

    return NextResponse.json({ ok: true, data: invoice }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" && error !== null &&
      "code" in error && (error as { code: string }).code === "ALREADY_FINALIZED"
    ) {
      return academyError(409, "ALREADY_FINALIZED", "Invoice is finalized and cannot be regenerated");
    }
    console.error("[POST /api/academy/finance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to generate invoice");
  }
}

/**
 * PATCH /api/academy/finance
 * Update invoice status (e.g. finalize or void).
 * Body: { invoiceId, status: "FINALIZED" | "VOID", notes? }
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "invoices", "edit");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: { invoiceId?: string; status?: string; notes?: string };
    try { body = await request.json(); } catch { return academyError(400, "INVALID_JSON", "Invalid JSON body"); }

    const invoiceId = body?.invoiceId;
    const status = body?.status ?? "FINALIZED";
    const notes = body?.notes;

    if (!invoiceId) {
      return academyError(400, "VALIDATION_ERROR", "invoiceId is required");
    }

    if (!["FINALIZED", "VOID"].includes(status)) {
      return academyError(400, "VALIDATION_ERROR", "status must be FINALIZED or VOID");
    }

    const existing = await prisma.academyInvoice.findFirst({
      where: { id: invoiceId, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return academyError(404, "NOT_FOUND", "Invoice not found");
    }

    if (existing.status === status) {
      return academyError(400, "INVALID_STATE", `Invoice is already ${status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.academyInvoice.update({
        where: { id: existing.id },
        data: {
          status,
          ...(status === "FINALIZED" ? { finalizedAt: new Date() } : {}),
          ...(status === "VOID" ? { voidedAt: new Date() } : {}),
          ...(notes ? { notes } : {}),
        },
        include: { lines: true },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: `invoice.${status.toLowerCase()}`,
        entityType: "academy_invoice",
        entityId: inv.id,
        summary: `Invoice status changed: ${existing.status} -> ${status}`,
        before: { status: existing.status },
        after: { status },
      });

      return inv;
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/academy/finance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to update invoice");
  }
}