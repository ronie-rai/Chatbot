import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminAuth";
import { seedDefaultSportsTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/templates/seed
 * Seeds all 8 default sports foundation templates and generates their Google Sheet tabs.
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
    let { tenantId } = body as { tenantId?: string };

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id;
    }

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: { code: "NO_TENANT", message: "No organization found" } },
        { status: 404 }
      );
    }

    const templates = await seedDefaultSportsTemplates(tenantId);
    return NextResponse.json({
      ok: true,
      data: {
        count: templates.length,
        templates,
        message: "Successfully seeded 8 Sports Foundation templates and synced Google Sheet tabs.",
      },
    });
  } catch (error: any) {
    console.error("[POST /api/admin/templates/seed]", error);
    return NextResponse.json(
      { ok: false, error: { code: "SEED_ERROR", message: error.message || "Failed to seed templates" } },
      { status: 500 }
    );
  }
}
