import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseAssessmentTemplateInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/development/templates
 * Query: sportId, active, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "growth", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const sportId = sp.get("sportId");
    const active = sp.get("active");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyAssessmentTemplateWhereInput = {
      tenantId: ctx.tenantId,
      ...(sportId ? { sportId } : {}),
      ...(active !== null ? { active: active === "1" || active === "true" } : {}),
    };

    const rows = await prisma.academyAssessmentTemplate.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        _count: { select: { assessments: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((t) => ({
          id: t.id,
          name: t.name,
          sportId: t.sportId,
          description: t.description,
          fields: t.fields,
          active: t.active,
          assessmentsCount: t._count.assessments,
          createdAt: t.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/development/templates]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load assessment templates");
  }
}

/**
 * POST /api/academy/development/templates
 * Creates an assessment template. Requires growth:create.
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

    const parsed = parseAssessmentTemplateInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    if (v.sportId) {
      const sport = await prisma.academySport.findFirst({
        where: { id: v.sportId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!sport) {
        return academyError(404, "NOT_FOUND", "Sport not found");
      }
    }

    const template = await prisma.$transaction(async (tx) => {
      const t = await tx.academyAssessmentTemplate.create({
        data: {
          tenantId: ctx.tenantId,
          sportId: v.sportId,
          name: v.name,
          description: v.description,
          fields: v.fields as unknown as Prisma.InputJsonValue,
          active: v.active,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "assessment_template.created",
        entityType: "academy_assessment_template",
        entityId: t.id,
        summary: `Created assessment template '${v.name}' with ${v.fields.length} metrics`,
        after: { name: v.name, sportId: v.sportId, fieldsCount: v.fields.length },
        operationId: request.headers.get("x-operation-id"),
      });

      return t;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: template.id,
        name: template.name,
        sportId: template.sportId,
        description: template.description,
        fields: template.fields,
        active: template.active,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/development/templates]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create assessment template");
  }
}
