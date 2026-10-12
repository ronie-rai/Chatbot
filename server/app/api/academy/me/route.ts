import { NextResponse } from "next/server";
import { authenticateAcademy } from "@/lib/academy/auth";
import { buildNavigation } from "@/lib/academy/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/me
 * Returns the caller's academy role, effective permissions and the navigation
 * modules they may see. Tenants without the module (or users without a
 * membership) get { enabled: false } so the app shows nothing new.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateAcademy(request);
    if (!auth.ok) {
      const status = auth.response.status;
      // Missing/invalid token is a real error; disabled/forbidden is just "feature off".
      if (status === 401) return auth.response;
      return NextResponse.json({ ok: true, data: { enabled: false } });
    }

    const { ctx } = auth;
    const user = await prisma.user.findFirst({
      where: { id: ctx.userId, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      ok: true,
      data: {
        enabled: true,
        role: ctx.role,
        user: user ? { id: user.id, name: user.name } : null,
        permissions: Array.from(ctx.permissions).sort(),
        navigation: buildNavigation(ctx.permissions),
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/me]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to load academy profile" } },
      { status: 500 }
    );
  }
}
