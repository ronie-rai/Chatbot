import { NextResponse } from "next/server";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/development/assessments/[id]
 * Fetches assessment details and all player scorecard results.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "growth", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const assessment = await prisma.academyAssessment.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
      include: {
        template: { select: { id: true, name: true, fields: true } },
        results: {
          include: {
            player: { select: { id: true, name: true, playerCode: true } },
          },
        },
      },
    });

    if (!assessment) {
      return academyError(404, "NOT_FOUND", "Assessment not found");
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: assessment.id,
        template: assessment.template,
        batchId: assessment.batchId,
        assessedDate: assessment.assessedDate.toISOString().slice(0, 10),
        conductedBy: assessment.conductedBy,
        notes: assessment.notes,
        results: assessment.results.map((r) => ({
          id: r.id,
          player: r.player,
          scores: r.scores,
          notes: r.notes,
        })),
        createdAt: assessment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/development/assessments/[id]]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load assessment details");
  }
}
