import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminAuth";
import {
  getTenantTemplates,
  createTemplate,
  modifyTemplate,
  deleteTemplate,
  type TemplateField,
} from "@/lib/templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/templates?tenantId=...
 * Lists all chat templates and their connected Google Sheet tabs for a tenant.
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

    const templates = await getTenantTemplates(tenantId);
    return NextResponse.json({ ok: true, data: templates });
  } catch (error: any) {
    console.error("[GET /api/admin/templates]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to fetch templates" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/templates
 * Creates a new template and automatically creates its dedicated Google Sheet tab.
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
    const body = await request.json();
    let { tenantId, command, name, description, sheetName, icon, fields, autoCreateSheet = true } = body as {
      tenantId?: string;
      command?: string;
      name?: string;
      description?: string;
      sheetName?: string;
      icon?: string;
      fields?: TemplateField[];
      autoCreateSheet?: boolean;
    };

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id;
    }

    if (!tenantId || !command || !name) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "command and name are required" } },
        { status: 400 }
      );
    }

    const targetSheetName = sheetName?.trim() || `${name.trim()} Records`;
    const targetFields = Array.isArray(fields) && fields.length > 0
      ? fields
      : [
          { key: "full_name", label: "Full Name", required: true, type: "text" as const },
          { key: "contact_number", label: "Phone Number", required: true, type: "phone" as const },
          { key: "details", label: "Details / Notes", required: true, type: "text" as const },
        ];

    const template = await createTemplate(
      tenantId,
      {
        command: command.trim().toLowerCase().replace(/^\//, ""),
        name: name.trim(),
        description: description?.trim() || undefined,
        sheetName: targetSheetName,
        icon: icon?.trim() || "📋",
        fields: targetFields,
      },
      autoCreateSheet
    );

    return NextResponse.json({ ok: true, data: template }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/admin/templates]", error);
    return NextResponse.json(
      { ok: false, error: { code: "CREATE_ERROR", message: error.message || "Failed to create template" } },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/admin/templates
 * Modifies an existing template and syncs newly added columns to row 1 of the sheet.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    let { tenantId, command, name, description, sheetName, icon, fields, promptMessage } = body as {
      tenantId?: string;
      command?: string;
      name?: string;
      description?: string;
      sheetName?: string;
      icon?: string;
      fields?: TemplateField[];
      promptMessage?: string;
    };

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id;
    }

    if (!tenantId || !command) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "command is required" } },
        { status: 400 }
      );
    }

    const updated = await modifyTemplate(tenantId, command, {
      name,
      description,
      sheetName,
      icon,
      fields,
      promptMessage,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    console.error("[PATCH /api/admin/templates]", error);
    return NextResponse.json(
      { ok: false, error: { code: "UPDATE_ERROR", message: error.message || "Failed to update template" } },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/templates?command=...&tenantId=...
 * Deletes a template from the app while preserving all Google Sheet tabs and submission data.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const command = searchParams.get("command");
    let tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId || !command) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "command is required" } },
        { status: 400 }
      );
    }

    const result = await deleteTemplate(tenantId, command);
    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    console.error("[DELETE /api/admin/templates]", error);
    return NextResponse.json(
      { ok: false, error: { code: "DELETE_ERROR", message: error.message || "Failed to delete template" } },
      { status: 400 }
    );
  }
}
