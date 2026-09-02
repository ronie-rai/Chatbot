import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractSpreadsheetId } from "@/lib/ai";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: tenantId } = await params;
    const body = await request.json();
    const { spreadsheetIdOrUrl, sheetName, columns } = body as {
      spreadsheetIdOrUrl?: string;
      sheetName?: string;
      columns?: Array<{ name: string; label: string; description: string; required: boolean }>;
    };

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Organization not found" } },
        { status: 404 }
      );
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
    if (!spreadsheetId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_URL", message: "Valid Google Sheet URL or ID is required" } },
        { status: 400 }
      );
    }

    const existingSheet = await prisma.sheetConnection.findFirst({
      where: { tenantId },
    });

    const defaultCols = [
      { name: "customer_name", label: "Customer Name", description: "Name of customer", required: true },
      { name: "phone_number", label: "Phone Number", description: "Contact number", required: false },
      { name: "enquiry", label: "Enquiry", description: "Enquiry or booking details", required: true },
    ];

    let sheet;
    if (existingSheet) {
      sheet = await prisma.sheetConnection.update({
        where: { id: existingSheet.id },
        data: {
          spreadsheetId,
          sheetName: sheetName?.trim() || existingSheet.sheetName || "Sheet1",
          columns: columns || existingSheet.columns || defaultCols,
        },
      });
    } else {
      sheet = await prisma.sheetConnection.create({
        data: {
          tenantId,
          spreadsheetId,
          sheetName: sheetName?.trim() || "Sheet1",
          authMode: "SERVICE_ACCOUNT",
          columns: columns || defaultCols,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: sheet.id,
        tenantId: sheet.tenantId,
        spreadsheetId: sheet.spreadsheetId,
        sheetName: sheet.sheetName,
        authMode: sheet.authMode,
        columns: sheet.columns,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/admin/organizations/[id]/sheet]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to update Google Sheet configuration" } },
      { status: 500 }
    );
  }
}
