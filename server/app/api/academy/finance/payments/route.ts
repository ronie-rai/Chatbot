import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parsePaymentInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/finance/payments
 * Query: playerId, from, to, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "payments", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const playerId = sp.get("playerId");
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyPaymentWhereInput = {
      tenantId: ctx.tenantId,
      ...(playerId ? { playerId } : {}),
      ...(fromStr || toStr
        ? {
            paidAt: {
              ...(fromStr ? { gte: new Date(`${fromStr}T00:00:00.000Z`) } : {}),
              ...(toStr ? { lte: new Date(`${toStr}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.academyPayment.findMany({
      where,
      orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        player: { select: { id: true, name: true, playerCode: true } },
        allocations: {
          include: {
            invoice: { select: { id: true, period: true, totalAmount: true, status: true } },
          },
        },
        receipts: { select: { id: true, storageKey: true, generatedAt: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((p) => ({
          id: p.id,
          player: p.player,
          amount: Number(p.amount),
          currency: p.currency,
          method: p.method,
          reference: p.reference,
          paidAt: p.paidAt.toISOString(),
          notes: p.notes,
          allocations: p.allocations.map((a) => ({
            id: a.id,
            invoiceId: a.invoiceId,
            period: a.invoice.period,
            allocatedAmount: Number(a.amount),
            invoiceStatus: a.invoice.status,
          })),
          receipt: p.receipts[0] ?? null,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/finance/payments]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load payments");
  }
}

/**
 * POST /api/academy/finance/payments
 * Records a payment and allocates it to invoices (FIFO or explicit). Requires payments:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "payments", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parsePaymentInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const player = await prisma.academyPlayer.findFirst({
      where: { id: v.playerId, tenantId: ctx.tenantId, archivedAt: null },
      select: { id: true, name: true, playerCode: true },
    });
    if (!player) return academyError(404, "NOT_FOUND", "Player not found");

    const paidAtDate = v.paidAt ? new Date(`${v.paidAt}T12:00:00.000Z`) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create payment record
      const payment = await tx.academyPayment.create({
        data: {
          tenantId: ctx.tenantId,
          playerId: v.playerId,
          amount: new Prisma.Decimal(v.amount),
          currency: "INR",
          method: v.method,
          reference: v.reference,
          notes: v.notes,
          paidAt: paidAtDate,
          recordedBy: ctx.userId,
        },
      });

      // 2. Fetch candidate invoices to allocate against
      let candidateInvoices = [];
      if (v.invoiceId) {
        const singleInv = await tx.academyInvoice.findFirst({
          where: { id: v.invoiceId, tenantId: ctx.tenantId, playerId: v.playerId },
          include: { payments: true },
        });
        if (!singleInv) {
          throw Object.assign(new Error("Target invoice not found for this player"), { code: "INVOICE_NOT_FOUND" });
        }
        candidateInvoices.push(singleInv);
      } else {
        // FIFO order: unpaid or partially paid finalized/draft invoices
        candidateInvoices = await tx.academyInvoice.findMany({
          where: {
            tenantId: ctx.tenantId,
            playerId: v.playerId,
            status: { in: ["FINALIZED", "PARTIALLY_PAID", "DRAFT"] },
          },
          include: { payments: true },
          orderBy: [{ period: "asc" }, { createdAt: "asc" }],
        });
      }

      let remainingBalance = v.amount;
      const createdAllocations = [];
      let primaryInvoiceId = v.invoiceId || (candidateInvoices[0]?.id ?? null);

      for (const inv of candidateInvoices) {
        if (remainingBalance <= 0) break;

        const alreadyPaid = inv.payments.reduce((sum, a) => sum + Number(a.amount), 0);
        const due = Math.max(Number(inv.totalAmount) - alreadyPaid, 0);

        if (due > 0) {
          const allocateAmount = Math.min(remainingBalance, due);
          remainingBalance -= allocateAmount;

          const alloc = await tx.academyPaymentAllocation.create({
            data: {
              paymentId: payment.id,
              invoiceId: inv.id,
              amount: new Prisma.Decimal(allocateAmount),
            },
          });
          createdAllocations.push({
            id: alloc.id,
            invoiceId: inv.id,
            amount: allocateAmount,
          });

          // Update invoice status
          const totalPaidNow = alreadyPaid + allocateAmount;
          const newStatus = totalPaidNow >= Number(inv.totalAmount) ? "PAID" : "PARTIALLY_PAID";
          await tx.academyInvoice.update({
            where: { id: inv.id },
            data: { status: newStatus },
          });

          if (!primaryInvoiceId) primaryInvoiceId = inv.id;
        }
      }

      // 3. Create Receipt row if any invoice was settled
      let receipt = null;
      if (primaryInvoiceId) {
        receipt = await tx.academyReceipt.create({
          data: {
            tenantId: ctx.tenantId,
            invoiceId: primaryInvoiceId,
            paymentId: payment.id,
            storageKey: `receipts/${ctx.tenantId}/${primaryInvoiceId}/${payment.id}.json`,
          },
        });
      }

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "payment.recorded",
        entityType: "academy_payment",
        entityId: payment.id,
        summary: `Recorded ${v.method} payment of Rs.${v.amount} for ${player.name} (${player.playerCode})`,
        after: { playerId: v.playerId, amount: v.amount, method: v.method, allocationsCount: createdAllocations.length },
        operationId: request.headers.get("x-operation-id"),
      });

      return { payment, allocations: createdAllocations, receipt };
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: result.payment.id,
        playerId: result.payment.playerId,
        amount: Number(result.payment.amount),
        method: result.payment.method,
        reference: result.payment.reference,
        allocations: result.allocations,
        receiptId: result.receipt?.id ?? null,
        receipt: result.receipt ? { id: result.receipt.id, storageKey: result.receipt.storageKey } : null,
      },
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "INVOICE_NOT_FOUND") {
      return academyError(404, "NOT_FOUND", "Target invoice not found for this player");
    }
    console.error("[POST /api/academy/finance/payments]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to record payment");
  }
}
