import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { syncAllDatabaseToSheet } from "@/lib/sheetsSync";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  // Allow authorized admin or requests with valid header
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const result = await syncAllDatabaseToSheet();
    return NextResponse.json({
      ok: result.success,
      data: {
        stats: result.stats,
        message: result.message,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/admin/sync-sheet]", error);
    return NextResponse.json(
      { ok: false, error: { code: "SYNC_ERROR", message: error?.message || "Sync failed" } },
      { status: 500 }
    );
  }
}
