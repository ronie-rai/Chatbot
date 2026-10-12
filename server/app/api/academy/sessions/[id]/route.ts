import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { SESSION_STATUSES } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

/**
 * PATCH /api/academy/sessions/[id]
 * Updates session status (SCHEDULED, HELD, CANCELLED, HOLIDAY).
 */
export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "attendance", "edit");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const session = await prisma.academySession.findFirst({
      where: {
        id: params.id,
        tenantId: ctx.tenantId,
        ...(ctx.role === "COACH"
          ? {
              OR: [
                { coachUserId: ctx.userId },
                { batch: { coachUserId: ctx.userId } },
              ],
            }
          : {}),
      },
    });

    if (!session) {
      return academyError(404, "NOT_FOUND", "Session not found");
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const { status, reason } = body ?? {};
    if (!status || !(SESSION_STATUSES as readonly string[]).includes(status)) {
      return academyError(400, "VALIDATION_ERROR", `Status must be one of: ${SESSION_STATUSES.join(", ")}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.academySession.update({
        where: { id: session.id },
        data: { status },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "session.status_updated",
        entityType: "academy_session",
        entityId: s.id,
        summary: `Changed session status from ${session.status} to ${status}`,
        before: { status: session.status },
        after: { status },
        reason: reason ?? null,
        operationId: request.headers.get("x-operation-id"),
      });

      return s;
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/academy/sessions/[id]]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to update session");
  }
}
