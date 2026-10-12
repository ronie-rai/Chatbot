import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseFeePlanInput, parseLimit } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/finance/plans
 * Query: sportId, active, limit, cursor
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "fees", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const sportId = sp.get("sportId");
    const active = sp.get("active");
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");

    const where: Prisma.AcademyFeePlanWhereInput = {
      tenantId: ctx.tenantId,
      ...(sportId ? { sportId } : {}),
      ...(active !== null ? { active: active === "1" || active === "true" } : {}),
    };

    const rows = await prisma.academyFeePlan.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        _count: { select: { assignments: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((p) => ({
          id: p.id,
          name: p.name,
          sportId: p.sportId,
          billingMethod: p.billingMethod,
          baseAmount: Number(p.baseAmount),
          currency: p.currency,
          billingPeriod: p.billingPeriod,
          proRateMidPeriod: p.proRateMidPeriod,
          taxRate: Number(p.taxRate),
          policies: p.policies,
          active: p.active,
          assignmentsCount: p._count.assignments,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/finance/plans]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load fee plans");
  }
}

/**
 * POST /api/academy/finance/plans
 * Requires fees:create.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "fees", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }

    const parsed = parseFeePlanInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const sport = await prisma.academySport.findFirst({
      where: { id: v.sportId, tenantId: ctx.tenantId, active: true },
      select: { id: true, name: true },
    });
    if (!sport) {
      return academyError(400, "VALIDATION_ERROR", "Sport does not exist or is inactive");
    }

    const plan = await prisma.$transaction(async (tx) => {
      const p = await tx.academyFeePlan.create({
        data: {
          tenantId: ctx.tenantId,
          sportId: v.sportId,
          name: v.name,
          billingMethod: v.billingMethod,
          baseAmount: new Prisma.Decimal(v.baseAmount),
          currency: v.currency,
          billingPeriod: v.billingPeriod,
          proRateMidPeriod: v.proRateMidPeriod,
          taxRate: new Prisma.Decimal(v.taxRate),
          policies: v.policies ? (v.policies as Prisma.InputJsonValue) : Prisma.JsonNull,
          active: v.active,
        },
      });

      await recordAudit(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: "fee_plan.created",
        entityType: "academy_fee_plan",
        entityId: p.id,
        summary: `Created ${v.billingMethod} fee plan '${v.name}' for ${sport.name} (₹${v.baseAmount})`,
        after: { name: v.name, sportId: v.sportId, billingMethod: v.billingMethod, baseAmount: v.baseAmount },
        operationId: request.headers.get("x-operation-id"),
      });

      return p;
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: plan.id,
        name: plan.name,
        sportId: plan.sportId,
        billingMethod: plan.billingMethod,
        baseAmount: Number(plan.baseAmount),
        taxRate: Number(plan.taxRate),
        active: plan.active,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/academy/finance/plans]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create fee plan");
  }
}
