import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseSportInput } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/academy/sports/:id — rename / deactivate a sport. Requires sports:edit.
 * Deactivating never deletes history; players, batches and attendance keep their sport.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "sports", "edit");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }
    const parsed = parseSportInput(body, true);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const existing = await prisma.academySport.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
    });
    if (!existing) return academyError(404, "NOT_FOUND", "Sport not found");

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.academySport.update({
        where: { id: existing.id },
        data: {
          ...(v.name !== undefined ? { name: v.name } : {}),
          ...(v.description !== undefined ? { description: v.description } : {}),
          ...(v.active !== undefined ? { active: v.active } : {}),
          ...(v.defaultBillingMethod !== undefined ? { defaultBillingMethod: v.defaultBillingMethod } : {}),
        },
      });
      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "sport.updated",
        entityType: "academy_sport",
        entityId: row.id,
        summary: `Sport "${row.name}" updated`,
        before: { name: existing.name, active: existing.active, defaultBillingMethod: existing.defaultBillingMethod },
        after: { name: row.name, active: row.active, defaultBillingMethod: row.defaultBillingMethod },
        operationId: request.headers.get("x-operation-id"),
      });
      return row;
    });

    return NextResponse.json({
      ok: true,
      data: { id: updated.id, name: updated.name, active: updated.active },
    });
  } catch (error) {
    console.error("[PATCH /api/academy/sports/:id]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to update sport");
  }
}
