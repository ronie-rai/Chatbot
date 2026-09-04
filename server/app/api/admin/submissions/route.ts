import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminAuth";
import {
  getTenantSubmissions,
  syncSubmissionToSheet,
  syncAllPendingSubmissions,
} from "@/lib/templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/submissions?tenantId=...&command=...&sheet=...&limit=...
 * Lists submissions saved in PostgreSQL with Google Sheets sync status.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    let tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_TENANT", message: "No organization found" } },
        { status: 404 }
      );
    }

    const command = searchParams.get("command") || undefined;
    const sheet = searchParams.get("sheet") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const [submissions, totalCount, syncedCount] = await Promise.all([
      getTenantSubmissions(tenantId, {
        templateCommand: command,
        sheetName: sheet,
        limit,
      }),
      prisma.templateSubmission.count({ where: { tenantId } }),
      prisma.templateSubmission.count({ where: { tenantId, syncedToSheet: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        submissions,
        stats: {
          total: totalCount,
          synced: syncedCount,
          pending: totalCount - syncedCount,
        },
      },
    });
  } catch (error: any) {
    console.error("[GET /api/admin/submissions]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch submissions" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/submissions
 * Manual on-demand re-sync of database records to Google Sheets.
 * Body: { action: "sync_all" } or { action: "sync_one", submissionId: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    let tenantId = body.tenantId;

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_TENANT", message: "No organization found" } },
        { status: 404 }
      );
    }

    const action = body.action || "sync_all";

    if (action === "sync_one") {
      const submissionId = body.submissionId;
      if (!submissionId) {
        return NextResponse.json(
          { ok: false, error: { code: "MISSING_ID", message: "submissionId is required" } },
          { status: 400 }
        );
      }

      const res = await syncSubmissionToSheet(tenantId, submissionId);
      if (!res.success) {
        return NextResponse.json(
          { ok: false, error: { code: "SYNC_FAILED", message: res.error || "Failed to sync submission" } },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        data: { message: "Successfully synced submission to Google Sheets", submissionId },
      });
    }

    if (action === "sync_all") {
      const result = await syncAllPendingSubmissions(tenantId);
      return NextResponse.json({
        ok: true,
        data: {
          message: `Processed ${result.total} pending submissions (${result.synced} synced, ${result.failed} failed)`,
          ...result,
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: { code: "INVALID_ACTION", message: `Unknown action "${action}"` } },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[POST /api/admin/submissions]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error.message || "Sync operation failed" } },
      { status: 500 }
    );
  }
}
