import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAcademy, academyError } from "@/lib/academy/auth";
import { recordAudit } from "@/lib/academy/audit";
import { formatPlayerCode, parseLimit, parsePlayerInput, PLAYER_STATUSES } from "@/lib/academy/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy/players
 * Query: q (name / player id / guardian number), status, sportId, batchId,
 *        coachUserId, joinedFrom, joinedTo (YYYY-MM-DD), limit, cursor.
 * Requires players:view. Coaches only ever see players in their own batches.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "players", "view");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    const sp = new URL(request.url).searchParams;
    const limit = parseLimit(sp.get("limit"));
    const cursor = sp.get("cursor");
    const q = sp.get("q")?.trim();
    const status = sp.get("status");
    const sportId = sp.get("sportId");
    const batchId = sp.get("batchId");
    const coachUserId = sp.get("coachUserId");
    const joinedFrom = sp.get("joinedFrom");
    const joinedTo = sp.get("joinedTo");
    const includeArchived = sp.get("includeArchived") === "1";

    if (status && !(PLAYER_STATUSES as readonly string[]).includes(status)) {
      return academyError(400, "VALIDATION_ERROR", "Invalid status filter");
    }
    const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

    // Coach scoping: restrict to players enrolled in batches the coach runs.
    const enrollmentFilter: Prisma.AcademyBatchEnrollmentWhereInput[] = [];
    if (ctx.role === "COACH") enrollmentFilter.push({ batch: { coachUserId: ctx.userId } });
    if (batchId) enrollmentFilter.push({ batchId });
    if (coachUserId) enrollmentFilter.push({ batch: { coachUserId } });

    const where: Prisma.AcademyPlayerWhereInput = {
      tenantId: ctx.tenantId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(status ? { status } : {}),
      ...(sportId ? { sports: { some: { sportId } } } : {}),
      ...(enrollmentFilter.length
        ? { AND: enrollmentFilter.map((e) => ({ enrollments: { some: e } })) }
        : {}),
      ...(isDate(joinedFrom) || isDate(joinedTo)
        ? {
            joiningDate: {
              ...(isDate(joinedFrom) ? { gte: new Date(`${joinedFrom}T00:00:00.000Z`) } : {}),
              ...(isDate(joinedTo) ? { lte: new Date(`${joinedTo}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { playerCode: { contains: q, mode: "insensitive" } },
              { guardianPhone: { contains: q.replace(/\s+/g, "") } },
            ],
          }
        : {}),
    };

    const rows = await prisma.academyPlayer.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { sports: { include: { sport: { select: { id: true, name: true } } } } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      ok: true,
      data: {
        items: page.map((p) => ({
          id: p.id,
          playerCode: p.playerCode,
          name: p.name,
          dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
          guardianName: p.guardianName,
          guardianPhone: p.guardianPhone,
          joiningDate: p.joiningDate.toISOString().slice(0, 10),
          status: p.status,
          photoUrl: p.photoKey,
          sports: p.sports.map((s) => ({ id: s.sport.id, name: s.sport.name })),
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/academy/players]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to load players");
  }
}

/**
 * POST /api/academy/players — admission. Requires players:create.
 * One transaction: unique Player ID (atomic per-tenant counter) + sport links + audit row.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAcademy(request, "players", "create");
    if (!auth.ok) return auth.response;
    const { ctx } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return academyError(400, "INVALID_JSON", "Invalid or empty JSON body");
    }
    const parsed = parsePlayerInput(body);
    if (!parsed.ok) return academyError(400, "VALIDATION_ERROR", parsed.message);
    const v = parsed.value;

    const APPROVED_SPORTS = [
      "Football",
      "Cricket",
      "Badminton",
      "Tennis",
      "Pickleball",
      "Table Tennis",
    ];

    // Sports must exist, belong to this tenant, and be active.
    // Support resolution by either id or name (case-insensitive) and auto-provision approved sports if missing.
    const existingSports = await prisma.academySport.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      select: { id: true, name: true },
    });

    const resolvedSportIds: string[] = [];
    for (const rawIdOrName of v.sportIds) {
      const trimmed = rawIdOrName.trim();
      let match = existingSports.find(
        (s) => s.id === trimmed || s.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (!match) {
        const approvedName = APPROVED_SPORTS.find(
          (app) => app.toLowerCase() === trimmed.toLowerCase()
        );
        if (approvedName) {
          try {
            match = await prisma.academySport.create({
              data: {
                tenantId: ctx.tenantId,
                name: approvedName,
                active: true,
                defaultBillingMethod: "FIXED",
              },
              select: { id: true, name: true },
            });
            existingSports.push(match);
          } catch {
            const found = await prisma.academySport.findFirst({
              where: {
                tenantId: ctx.tenantId,
                name: { equals: approvedName, mode: "insensitive" },
              },
              select: { id: true, name: true },
            });
            if (found) match = found;
          }
        }
      }

      if (match && !resolvedSportIds.includes(match.id)) {
        resolvedSportIds.push(match.id);
      }
    }

    if (resolvedSportIds.length === 0) {
      return academyError(400, "VALIDATION_ERROR", "One or more selected sports are invalid or inactive");
    }

    // Duplicate guard: same child (name + DOB) under the same guardian number.
    const duplicate = await prisma.academyPlayer.findFirst({
      where: {
        tenantId: ctx.tenantId,
        archivedAt: null,
        name: { equals: v.name, mode: "insensitive" },
        dateOfBirth: new Date(`${v.dateOfBirth}T00:00:00.000Z`),
        guardianPhone: v.guardianPhone,
      },
      select: { playerCode: true },
    });
    if (duplicate) {
      return academyError(409, "DUPLICATE_PLAYER", `This player already exists as ${duplicate.playerCode}`);
    }

    const operationId = request.headers.get("x-operation-id");

    // Atomically allocate the next sequential player number using PostgreSQL's
    // ON CONFLICT DO UPDATE ... RETURNING row-level lock. Executed standalone
    // so connection is released immediately and transaction hold time is minimized.
    const counterRows = await prisma.$queryRaw<{ allocated: number }[]>`
      INSERT INTO acad_player_counters ("tenantId", next)
      VALUES (${ctx.tenantId}, 2)
      ON CONFLICT ("tenantId")
      DO UPDATE SET next = acad_player_counters.next + 1
      RETURNING acad_player_counters.next - 1 AS allocated
    `;
    const currentNext = Number(counterRows[0].allocated);
    const playerCode = formatPlayerCode(currentNext);

    const created = await prisma.$transaction(
      async (tx) => {
        const player = await tx.academyPlayer.create({
          data: {
            tenantId: ctx.tenantId,
            playerCode,
            name: v.name,
            dateOfBirth: new Date(`${v.dateOfBirth}T00:00:00.000Z`),
            guardianName: v.guardianName,
            guardianPhone: v.guardianPhone,
            address: v.address,
            joiningDate: new Date(`${v.joiningDate}T00:00:00.000Z`),
            startTime: v.startTime,
            endTime: v.endTime,
            photoKey: v.photoUrl || (body as any)?.photoKey || null,
            status: v.status,
            createdBy: ctx.userId,
            sports: { create: resolvedSportIds.map((sportId) => ({ sportId })) },
          },
        });

        await recordAudit(tx, {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          action: "player.created",
          entityType: "academy_player",
          entityId: player.id,
          summary: `Admitted ${player.name} (${player.playerCode})`,
          after: { playerCode, name: v.name, sportIds: resolvedSportIds, status: v.status },
          operationId,
        });
        return player;
      },
      { timeout: 30000, maxWait: 20000 }
    );

    return NextResponse.json(
      { ok: true, data: { id: created.id, playerCode: created.playerCode } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/academy/players]", error);
    return academyError(500, "INTERNAL_ERROR", "Failed to create player");
  }
}
