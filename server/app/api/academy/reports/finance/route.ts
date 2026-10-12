import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/reports/finance
 * Query: period (YYYY-MM), format ("json" | "csv")
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "reports", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const period = sp.get("period");
    const format = sp.get("format")?.toLowerCase();

    const whereInvoice = {
      tenantId: ctx.tenantId,
      status: { in: ["FINALIZED", "PARTIALLY_PAID", "PAID"] },
      ...(period ? { period } : {}),
    };

    const invoices = await prisma.academyInvoice.findMany({
      where: whereInvoice,
      include: {
        player: { select: { id: true, name: true, playerCode: true, guardianPhone: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let totalInvoiced = 0;
    let totalCollected = 0;
    const playerDues = new Map<string, { playerCode: string; name: string; phone: string; billed: number; paid: number; due: number }>();

    for (const inv of invoices) {
      const invTotal = Number(inv.totalAmount);
      const invPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      const invDue = Math.max(invTotal - invPaid, 0);

      totalInvoiced += invTotal;
      totalCollected += invPaid;

      if (invDue > 0) {
        if (!playerDues.has(inv.playerId)) {
          playerDues.set(inv.playerId, {
            playerCode: inv.player.playerCode,
            name: inv.player.name,
            phone: inv.player.guardianPhone,
            billed: 0,
            paid: 0,
            due: 0,
          });
        }
        const p = playerDues.get(inv.playerId)!;
        p.billed += invTotal;
        p.paid += invPaid;
        p.due += invDue;
      }
    }

    const totalOutstanding = Math.max(totalInvoiced - totalCollected, 0);
    const defaulters = Array.from(playerDues.values()).sort((a, b) => b.due - a.due);

    if (format === "csv") {
      let csv = "Player ID,Player Name,Phone,Total Billed,Total Paid,Outstanding Due\n";
      for (const d of defaulters) {
        csv += `"${d.playerCode}","${d.name}","${d.phone}",${d.billed},${d.paid},${d.due}\n`;
      }
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="defaulters_report.csv"',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        summary: {
          period: period ?? "ALL",
          totalInvoiced,
          totalCollected,
          totalOutstanding,
          defaultersCount: defaulters.length,
        },
        defaulters,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/reports/finance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to generate financial report");
  }
}
