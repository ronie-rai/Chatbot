import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { parseSportInput } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/academy/sports?includeInactive=1 — the single source for every sports dropdown. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "sports", "view");
    if (!auth.ok) return auth.response;
    const { tenantId } = auth.ctx;
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";

    const APPROVED_SPORTS = [
      "Football",
      "Cricket",
      "Badminton",
      "Tennis",
      "Pickleball",
      "Table Tennis",
    ];

    let rows = await prisma.academySport.findMany({
      where: { tenantId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: "asc" },
    });

    const existingNames = new Set(rows.map((r) => r.name.toLowerCase()));
    const missingSports = APPROVED_SPORTS.filter((s) => !existingNames.has(s.toLowerCase()));

    if (missingSports.length > 0) {
      for (const name of missingSports) {
        try {
          await prisma.academySport.upsert({
            where: { tenantId_name: { tenantId, name } },
            create: {
              tenantId,
              name,
              active: true,
              defaultBillingMethod: "FIXED",
            },
            update: { active: true },
          });
        } catch {
          // ignore concurrent collision
        }
      }
      rows = await prisma.academySport.findMany({
        where: { tenantId, ...(includeInactive ? {} : { active: true }) },
        orderBy: { name: "asc" },
      });
    }
    return NextResponse.json({
      ok: true,
      data: rows.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        active: s.active,
        defaultBillingMethod: s.defaultBillingMethod,
      })),
    });
  } catch (error) {
    console.error("[GET /api/academy/sports]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load sports");
  }
}

/** POST /api/academy/sports — add a sport (no app release needed). Requires sports:create. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "sports", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }
    const parsed = parseSportInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;
    if (!v.name) return academyError(400, "VALIDATION_ERROR", "name is required");

    try {
      const sport = await prisma.$transaction(async (tx) => {
        const created = await tx.academySport.create({
          data: {
            tenantId: ctx.tenantId,
            name: v.name as string,
            description: v.description ?? null,
            active: v.active ?? true,
            defaultBillingMethod: v.defaultBillingMethod ?? "FIXED",
          },
        });
        await recordAudit(tx, {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          action: "sport.created",
          entityType: "academy_sport",
          entityId: created.id,
          summary: `Sport "${created.name}" created`,
          after: { name: created.name, active: created.active },
          operationId: request.headers.get("x-operation-id"),
        });
        return created;
      });
      return NextResponse.json({ ok: true, data: { id: sport.id, name: sport.name } }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return academyError(409, "DUPLICATE_SPORT", "A sport with this name already exists");
      }
      throw e;
    }
  } catch (error) {
    console.error("[POST /api/academy/sports]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create sport");
  }
}
