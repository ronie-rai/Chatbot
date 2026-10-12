import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseAssessmentInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/development/assessments
 * Query: templateId, batchId, playerId, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "growth", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const templateId = sp.get("templateId");
    const batchId = sp.get("batchId");
    const playerId = sp.get("playerId");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyAssessmentWhereInput = {
      tenantId: ctx.tenantId,
      ...(templateId ? { templateId } : {}),
      ...(batchId ? { batchId } : {}),
      ...(playerId ? { results: { some: { playerId } } } : {}),
    };

    const rows = await prisma.academyAssessment.findMany({
      where,
      orderBy: [{ assessedDate: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        template: { select: { id: true, name: true, fields: true } },
        _count: { select: { results: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((a) => ({
          id: a.id,
          template: a.template,
          batchId: a.batchId,
          assessedDate: a.assessedDate.toISOString().slice(0, 10),
          conductedBy: a.conductedBy,
          notes: a.notes,
          resultsCount: a._count.results,
          createdAt: a.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/development/assessments]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load assessments");
  }
}

/**
 * POST /api/academy/development/assessments
 * Conducts an assessment session and records player scores. Requires growth:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "growth", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseAssessmentInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const template = await prisma.academyAssessmentTemplate.findFirst({
      where: { id: v.templateId, tenantId: ctx.tenantId, active: true },
      select: { id: true, name: true },
    });
    if (!template) {
      return academyError(404, "NOT_FOUND", "Assessment template not found or is inactive");
    }

    if (v.batchId) {
      const batch = await prisma.academyBatch.findFirst({
        where: { id: v.batchId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!batch) {
        return academyError(404, "NOT_FOUND", "Batch not found");
      }
    }

    // Verify all players belong to tenant
    const playerIds = v.results.map((r) => r.playerId);
    const existingPlayers = await prisma.academyPlayer.findMany({
      where: { id: { in: playerIds }, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (existingPlayers.length !== playerIds.length) {
      return academyError(400, "VALIDATION_ERROR", "One or more player IDs are invalid for this tenant");
    }

    const assessedDate = new Date(`${v.assessedDate}T00:00:00.000Z`);

    const assessment = await prisma.$transaction(async (tx) => {
      const a = await tx.academyAssessment.create({
        data: {
          tenantId: ctx.tenantId,
          templateId: v.templateId,
          batchId: v.batchId,
          assessedDate,
          notes: v.notes,
          conductedBy: ctx.userId,
        },
      });

      const resultRows = v.results.map((r) => ({
        assessmentId: a.id,
        playerId: r.playerId,
        scores: r.scores as Prisma.InputJsonValue,
        notes: r.notes ?? null,
      }));

      await tx.academyAssessmentResult.createMany({
        data: resultRows,
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "assessment.conducted",
        entityType: "academy_assessment",
        entityId: a.id,
        summary: `Conducted assessment '${template.name}' for ${v.results.length} players on ${v.assessedDate}`,
        after: {
          templateId: v.templateId,
          batchId: v.batchId,
          playersCount: v.results.length,
          assessedDate: v.assessedDate,
        },
        operationId: request.headers.get("x-operation-id"),
      });

      return a;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: assessment.id,
        templateId: assessment.templateId,
        batchId: assessment.batchId,
        assessedDate: v.assessedDate,
        playersCount: v.results.length,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/development/assessments]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to record assessment");
  }
}
