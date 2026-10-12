import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { academyError, academyFlagKey } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/academy/enable   (super-admin token required)
 * Body: { tenantId: string, enabled?: boolean, ownerUserId?: string }
 * Turns the academy module on/off for a tenant and optionally makes an
 * existing user of that tenant its OWNER. Idempotent.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const admin = verifyAdminToken(request);
  if (!admin.valid) {
    return academyError(401, "UNAUTHORIZED", admin.error || "Admin authentication required");
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }
    const input = (body ?? {}) as { tenantId?: unknown; enabled?: unknown; ownerUserId?: unknown };

    if (typeof input.tenantId !== "string" || !input.tenantId) {
      return academyError(400, "MISSING_FIELDS", "tenantId is required");
    }
    if (input.enabled !== undefined && typeof input.enabled !== "boolean") {
      return academyError(400, "INVALID_FIELD", "enabled must be a boolean");
    }
    if (input.ownerUserId !== undefined && typeof input.ownerUserId !== "string") {
      return academyError(400, "INVALID_FIELD", "ownerUserId must be a string");
    }
    const tenantId = input.tenantId;
    const enabled = input.enabled ?? true;
    const ownerUserId = input.ownerUserId;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return academyError(404, "NOT_FOUND", "Tenant not found");

    if (ownerUserId) {
      const owner = await prisma.user.findFirst({
        where: { id: ownerUserId, tenantId },
        select: { id: true },
      });
      if (!owner) return academyError(404, "NOT_FOUND", "Owner user not found in this tenant");
    }

    await prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: academyFlagKey(tenantId) },
        create: { key: academyFlagKey(tenantId), value: String(enabled) },
        update: { value: String(enabled) },
      });
      if (ownerUserId) {
        await tx.academyMembership.upsert({
          where: { tenantId_userId: { tenantId, userId: ownerUserId } },
          create: { tenantId, userId: ownerUserId, role: "OWNER", active: true },
          update: { role: "OWNER", active: true },
        });
      }
      await recordAudit(tx, {
        tenantId,
        actorUserId: null,
        action: enabled ? "academy.enabled" : "academy.disabled",
        entityType: "academy",
        entityId: tenantId,
        summary: `Super admin ${admin.email ?? "unknown"} ${enabled ? "enabled" : "disabled"} the academy module${
          ownerUserId ? ` (owner: ${ownerUserId})` : ""
        }`,
        operationId: request.headers.get("x-operation-id"),
      });
    });

    return NextResponse.json({ ok: true, data: { tenantId, enabled, ownerUserId: ownerUserId ?? null } });
  } catch (error) {
    console.error("[POST /api/academy/enable]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to update academy settings");
  }
}
