import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { extractSpreadsheetId, getGoogleSheetsClient } from "@/lib/ai";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { spreadsheetIdOrUrl } = body as { spreadsheetIdOrUrl?: string };

    const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
    if (!spreadsheetId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "A valid Google Sheet URL or ID is required" } },
        { status: 400 }
      );
    }

    // Check credentials file
    const credPath = path.resolve(process.cwd(), "google-credentials.json");
    const hasCredFile = fs.existsSync(credPath);
    let serviceAccountEmail = "Unknown";
    if (hasCredFile) {
      try {
        const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));
        serviceAccountEmail = creds.client_email || "Not found in credentials";
      } catch {
        serviceAccountEmail = "Error reading credentials file";
      }
    }

    const sheets = await getGoogleSheetsClient();
    if (!sheets) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NO_CREDENTIALS",
            message: "Google credentials not configured. Please ensure google-credentials.json exists.",
          },
          serviceAccountEmail,
        },
        { status: 500 }
      );
    }

    // Fetch spreadsheet metadata
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties.title",
    });

    const title = meta.data.properties?.title ?? "Untitled Spreadsheet";
    const sheetTabs = (meta.data.sheets ?? []).map((s: { properties?: { title?: string | null } | null }) => s.properties?.title ?? "Unknown");

    return NextResponse.json({
      ok: true,
      data: {
        spreadsheetId,
        title,
        tabs: sheetTabs,
        serviceAccountEmail,
        status: "CONNECTED",
        message: `Successfully connected to "${title}" with ${sheetTabs.length} tab(s).`,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/admin/sheet-test]", error);
    const msg = error?.message || "Failed to connect to Google Sheet";
    const isPermissionError = msg.includes("permission") || msg.includes("403") || msg.includes("404");

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: isPermissionError ? "PERMISSION_DENIED" : "SHEET_ERROR",
          message: isPermissionError
            ? "Cannot access spreadsheet. Please make sure the sheet is shared with your Google Service Account email."
            : msg,
        },
      },
      { status: 400 }
    );
  }
}
