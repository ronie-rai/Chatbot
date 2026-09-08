import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/data
 * Supplies all tables, submissions, and aggregate insights with filtering for the User Dashboard.
 * Strictly scoped by tenantId for tenant isolation.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    let tenantId = searchParams.get("tenantId")?.trim();

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id || "";
    }

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_TENANT", message: "No tenant organization found" } },
        { status: 404 }
      );
    }

    // Filter Parameters
    const commandFilter = searchParams.get("command")?.trim().toLowerCase().replace(/^\//, "") || "";
    const searchFilter = searchParams.get("search")?.trim().toLowerCase() || "";
    const startDateParam = searchParams.get("startDate")?.trim() || "";
    const endDateParam = searchParams.get("endDate")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim() || "";
    const sportFilter = searchParams.get("sport")?.trim().toLowerCase() || "";
    const syncFilter = searchParams.get("sync")?.trim() || ""; // "synced", "pending", or ""
    const timeSlotFilter = searchParams.get("timeSlot")?.trim().toLowerCase() || "";
    const targetDateParam = searchParams.get("targetDate")?.trim() || "";

    // 1. Fetch all templates for tenant
    const templates = await getTenantTemplates(tenantId);

    // 2. Fetch all submissions for tenant (for global insights and filtering)
    const allSubmissions = await prisma.templateSubmission.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        template: {
          select: {
            name: true,
            command: true,
            icon: true,
            sheetName: true,
            fields: true,
          },
        },
      },
    });

    // 3. Calculate Insights (Global across tenant)
    const totalSubmissions = allSubmissions.length;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const submissionsToday = allSubmissions.filter(
      (s) => new Date(s.createdAt) >= startOfToday
    ).length;

    const syncedCount = allSubmissions.filter((s) => s.syncedToSheet).length;
    const syncRate = totalSubmissions > 0 ? Math.round((syncedCount / totalSubmissions) * 100) : 100;

    // Submissions by Template / Tab
    const templateCountsMap: Record<string, number> = {};
    for (const sub of allSubmissions) {
      const cmd = sub.templateCommand || "other";
      templateCountsMap[cmd] = (templateCountsMap[cmd] || 0) + 1;
    }

    const byTemplate = templates.map((t) => {
      const fieldList = Array.isArray(t.fields) ? (t.fields as any[]) : [];
      return {
        command: t.command,
        name: t.name,
        icon: t.icon || "📋",
        sheetName: t.sheetName,
        count: templateCountsMap[t.command] || 0,
        fieldCount: fieldList.length,
      };
    });

    // Sport / Court Distribution
    const sportCountsMap: Record<string, number> = {};
    const timeSlotsMap = { morning: 0, afternoon: 0, evening: 0 };
    const distinctSportsSet = new Set<string>();

    // Pre-populate sports from templates options
    for (const t of templates) {
      const fieldList = Array.isArray(t.fields) ? (t.fields as any[]) : [];
      for (const f of fieldList) {
        if (f.options && Array.isArray(f.options)) {
          for (const opt of f.options) {
            distinctSportsSet.add(opt);
          }
        }
      }
    }

    for (const sub of allSubmissions) {
      const data = (sub.data as Record<string, any>) || {};
      const sportVal =
        data["Sport / Facility"] ||
        data["Sport"] ||
        data["Target Sport"] ||
        data["Sport Program"] ||
        data["Gear Requested"];

      if (sportVal && typeof sportVal === "string") {
        distinctSportsSet.add(sportVal);
        sportCountsMap[sportVal] = (sportCountsMap[sportVal] || 0) + 1;
      }

      // Time slot distribution
      const timeVal = (data["Time Slot"] || data["time_slot"] || "").toLowerCase();
      if (timeVal.includes("am") || timeVal.includes("06:") || timeVal.includes("07:") || timeVal.includes("08:") || timeVal.includes("09:") || timeVal.includes("10:") || timeVal.includes("11:")) {
        timeSlotsMap.morning += 1;
      } else if (timeVal.includes("12:") || timeVal.includes("01:") || timeVal.includes("02:") || timeVal.includes("03:") || timeVal.includes("04:")) {
        timeSlotsMap.afternoon += 1;
      } else if (timeVal.includes("pm") || timeVal.includes("05:") || timeVal.includes("06:") || timeVal.includes("07:") || timeVal.includes("08:") || timeVal.includes("09:")) {
        timeSlotsMap.evening += 1;
      }
    }

    const bySport = Object.entries(sportCountsMap)
      .map(([sport, count]) => ({
        sport,
        count,
        percentage: totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 14-Day Activity Trend
    const dailyMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }

    for (const sub of allSubmissions) {
      const key = new Date(sub.createdAt).toISOString().slice(0, 10);
      if (key in dailyMap) {
        dailyMap[key] += 1;
      }
    }

    const dailyActivity = Object.entries(dailyMap).map(([date, count]) => {
      const d = new Date(date);
      const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
      return { date, label, count };
    });

    // 4. Apply User Filters to Submissions
    let filteredSubmissions = allSubmissions;

    if (commandFilter) {
      filteredSubmissions = filteredSubmissions.filter(
        (s) => s.templateCommand.toLowerCase() === commandFilter
      );
    }

    if (searchFilter) {
      filteredSubmissions = filteredSubmissions.filter((s) => {
        const nameMatch = (s.userName || "").toLowerCase().includes(searchFilter);
        const phoneMatch = (s.userPhone || "").toLowerCase().includes(searchFilter);
        const refMatch = (s.submissionRef || "").toLowerCase().includes(searchFilter);
        const sheetMatch = (s.sheetName || "").toLowerCase().includes(searchFilter);
        const dataMatch = JSON.stringify(s.data || {}).toLowerCase().includes(searchFilter);
        return nameMatch || phoneMatch || refMatch || sheetMatch || dataMatch;
      });
    }

    if (startDateParam) {
      const start = new Date(startDateParam);
      filteredSubmissions = filteredSubmissions.filter((s) => new Date(s.createdAt) >= start);
    }

    if (endDateParam) {
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
      filteredSubmissions = filteredSubmissions.filter((s) => new Date(s.createdAt) <= end);
    }

    if (statusFilter) {
      filteredSubmissions = filteredSubmissions.filter(
        (s) => s.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (sportFilter) {
      filteredSubmissions = filteredSubmissions.filter((s) => {
        const dataStr = JSON.stringify(s.data || {}).toLowerCase();
        return dataStr.includes(sportFilter);
      });
    }

    if (syncFilter === "synced") {
      filteredSubmissions = filteredSubmissions.filter((s) => s.syncedToSheet);
    } else if (syncFilter === "pending") {
      filteredSubmissions = filteredSubmissions.filter((s) => !s.syncedToSheet);
    }

    if (targetDateParam) {
      filteredSubmissions = filteredSubmissions.filter((s) => {
        const cDate = new Date(s.createdAt).toISOString().slice(0, 10);
        const dataStr = JSON.stringify(s.data || "");
        return cDate === targetDateParam || dataStr.includes(targetDateParam);
      });
    }

    if (timeSlotFilter) {
      filteredSubmissions = filteredSubmissions.filter((s) => {
        const timeVal = JSON.stringify(s.data || {}).toLowerCase();
        if (timeSlotFilter === "morning") {
          return (
            timeVal.includes("am") ||
            timeVal.includes("06:") ||
            timeVal.includes("07:") ||
            timeVal.includes("08:") ||
            timeVal.includes("09:") ||
            timeVal.includes("10:") ||
            timeVal.includes("11:")
          );
        }
        if (timeSlotFilter === "afternoon") {
          return (
            timeVal.includes("12:") ||
            timeVal.includes("01:") ||
            timeVal.includes("02:") ||
            timeVal.includes("03:") ||
            timeVal.includes("04:")
          );
        }
        if (timeSlotFilter === "evening") {
          return (
            timeVal.includes("pm") ||
            timeVal.includes("05:") ||
            timeVal.includes("06:") ||
            timeVal.includes("07:") ||
            timeVal.includes("08:") ||
            timeVal.includes("09:")
          );
        }
        return true;
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        tenantId,
        templates,
        submissions: filteredSubmissions,
        totalFiltered: filteredSubmissions.length,
        insights: {
          totalSubmissions,
          submissionsToday,
          syncedCount,
          pendingCount: totalSubmissions - syncedCount,
          syncRate,
          byTemplate,
          bySport,
          dailyActivity,
          byTimeSlot: timeSlotsMap,
          availableSports: Array.from(distinctSportsSet),
        },
      },
    });
  } catch (error: any) {
    console.error("[GET /api/dashboard/data]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to load dashboard data" } },
      { status: 500 }
    );
  }
}
