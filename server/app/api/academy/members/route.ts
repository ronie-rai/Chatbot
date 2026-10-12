import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { canAssignRole, isAcademyRole } from "@/lib/academy/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/academy/members — list this tenant's academy team. Requires users:view. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "users", "view");
    if (!auth.ok) return auth.response;
    const { tenantId } = auth.ctx;

    const rows = await prisma.academyMembership.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({
      ok: true,
      data: rows.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        active: m.active,
      })),
    });
  } catch (error) {
    console.error("[GET /api/academy/members]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load team");
  }
}

/**
 * POST /api/academy/members
 * Body: { userId: string, role: AcademyRole, active?: boolean }
 * Assign or change a team member's academy role. Requires users:create.
 * Guards: same-tenant target only; no self-modification; only OWNER can
 * grant or modify OWNER. Change + audit row commit in one transaction.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "users", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }
    const input = (body ?? {}) as { userId?: unknown; role?: unknown; active?: unknown };

    if (typeof input.userId !== "string" || !input.userId) {
      return academyError(400, "MISSING_FIELDS", "userId is required");
    }
    if (!isAcademyRole(input.role)) {
      return academyError(400, "INVALID_ROLE", "role must be a valid academy role");
    }
    if (input.active !== undefined && typeof input.active !== "boolean") {
      return academyError(400, "INVALID_FIELD", "active must be a boolean");
    }
    const targetUserId = input.userId;
    const targetRole = input.role;
    const active = input.active ?? true;

    if (targetUserId === ctx.userId) {
      return academyError(403, "FORBIDDEN", "You cannot change your own academy role");
    }
    if (!canAssignRole(ctx.role, targetRole)) {
      return academyError(403, "FORBIDDEN", "Only an owner can assign the owner role");
    }

    const user = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    if (!user) return academyError(404, "NOT_FOUND", "User not found in this organization");

    const existing = await prisma.academyMembership.findFirst({
      where: { tenantId: ctx.tenantId, userId: targetUserId },
      select: { role: true, active: true },
    });
    if (existing?.role === "OWNER" && ctx.role !== "OWNER") {
      return academyError(403, "FORBIDDEN", "Only an owner can modify an owner");
    }

    const operationId = request.headers.get("x-operation-id");

    const saved = await prisma.$transaction(async (tx) => {
      const membership = await tx.academyMembership.upsert({
        where: { tenantId_userId: { tenantId: ctx.tenantId, userId: targetUserId } },
        create: { tenantId: ctx.tenantId, userId: targetUserId, role: targetRole, active },
        update: { role: targetRole, active },
      });
      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: existing ? "member.role_changed" : "member.added",
        entityType: "academy_membership",
        entityId: membership.id,
        summary: `${user.name}: ${existing ? `${existing.role} → ` : ""}${targetRole}${active ? "" : " (inactive)"}`,
        before: existing ?? undefined,
        after: { role: targetRole, active },
        operationId,
      });
      return membership;
    });

    return NextResponse.json({
      ok: true,
      data: { userId: saved.userId, role: saved.role, active: saved.active },
    });
  } catch (error) {
    console.error("[POST /api/academy/members]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to save team member");
  }
}
