import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    const conversations = await prisma.conversation.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    const data = conversations.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      tenantId: c.tenantId,
      tenantName: c.tenant.name,
      tenantSlug: c.tenant.slug,
      messageCount: c._count.messages,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      participants: c.participants.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        role: p.user.role,
      })),
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/admin/groups]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch groups" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, tenantId, kind, participantIds } = body as {
      name?: string;
      tenantId?: string;
      kind?: "GROUP" | "DIRECT" | "AI";
      participantIds?: string[];
    };

    if (!name?.trim() || !tenantId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "Group name and organization are required" } },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: { code: "TENANT_NOT_FOUND", message: "Organization not found" } },
        { status: 404 }
      );
    }

    // Always include the organization's bot if kind is AI or if requested
    const botUser = await prisma.user.findFirst({
      where: { tenantId, role: "BOT" },
    });

    const uniqueUserIds = new Set<string>(participantIds || []);
    if (kind === "AI" && botUser) {
      uniqueUserIds.add(botUser.id);
    }

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        name: name.trim(),
        kind: kind || "GROUP",
        participants: {
          create: Array.from(uniqueUserIds).map((userId) => ({
            userId,
          })),
        },
      },
      include: {
        tenant: { select: { name: true, slug: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: conversation.id,
        name: conversation.name,
        kind: conversation.kind,
        tenantId: conversation.tenantId,
        tenantName: conversation.tenant.name,
        tenantSlug: conversation.tenant.slug,
        participants: conversation.participants.map((p) => ({
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          role: p.user.role,
        })),
        createdAt: conversation.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/groups]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to create group" } },
      { status: 500 }
    );
  }
}
