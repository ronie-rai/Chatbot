import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantTemplates, seedDefaultSportsTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/templates?tenantId=...
 * Public/app endpoint to list active templates and their field schemas for chat.
 */
export async function GET(request: Request): Promise<NextResponse> {
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

    let templates = await getTenantTemplates(tenantId);

    // Auto-seed default sports templates if none exist yet
    if (!templates || templates.length === 0) {
      await seedDefaultSportsTemplates(tenantId).catch(() => {});
      templates = await getTenantTemplates(tenantId);
    }

    return NextResponse.json({ ok: true, data: templates });
  } catch (error: any) {
    console.error("[GET /api/templates]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to load templates" } },
      { status: 500 }
    );
  }
}
