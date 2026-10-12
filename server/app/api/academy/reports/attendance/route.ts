import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/reports/attendance
 * Query: sportId, batchId, fromDate, toDate, format ("json" | "csv")
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "reports", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const sportId = sp.get("sportId");
    const batchId = sp.get("batchId");
    const fromDate = sp.get("fromDate");
    const toDate = sp.get("toDate");
    const format = sp.get("format")?.toLowerCase();

    const dateFilter = {
      ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00.000Z`) } : {}),
      ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {}),
    };

    const sessions = await prisma.academySession.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(sportId ? { sportId } : {}),
        ...(batchId ? { batchId } : {}),
        ...(fromDate || toDate ? { date: dateFilter } : {}),
      },
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            sport: { select: { id: true, name: true } },
          },
        },
        attendance: { select: { playerId: true, status: true } },
      },
    });

    const totalSessions = sessions.length;
    let totalMarks = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    const batchStats = new Map<string, { name: string; sport: string; sessions: number; present: number; total: number }>();

    for (const s of sessions) {
      const bKey = s.batchId ?? "ad_hoc";
      const bName = s.batch?.name ?? "Ad-hoc";
      const sName = s.batch?.sport?.name ?? "General";

      if (!batchStats.has(bKey)) {
        batchStats.set(bKey, { name: bName, sport: sName, sessions: 0, present: 0, total: 0 });
      }
      const st = batchStats.get(bKey)!;
      st.sessions++;

      for (const a of s.attendance) {
        totalMarks++;
        st.total++;
        if (a.status === "PRESENT" || a.status === "LATE") {
          presentCount++;
          st.present++;
        }
        if (a.status === "ABSENT") absentCount++;
        if (a.status === "LATE") lateCount++;
      }
    }

    const overallRate = totalMarks > 0 ? Number(((presentCount / totalMarks) * 100).toFixed(1)) : 0;

    const batches = Array.from(batchStats.values()).map((b) => ({
      batchName: b.name,
      sport: b.sport,
      sessionsCount: b.sessions,
      attendanceRate: b.total > 0 ? Number(((b.present / b.total) * 100).toFixed(1)) : 0,
      totalMarks: b.total,
    }));

    if (format === "csv") {
      let csv = "Batch,Sport,Sessions,Attendance Rate %,Total Marks\n";
      for (const b of batches) {
        csv += `"${b.batchName}","${b.sport}",${b.sessionsCount},${b.attendanceRate}%,${b.totalMarks}\n`;
      }
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="attendance_report.csv"',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        summary: {
          totalSessions,
          totalMarks,
          presentCount,
          absentCount,
          lateCount,
          attendanceRate: overallRate,
        },
        batches,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/reports/attendance]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to generate attendance report");
  }
}
