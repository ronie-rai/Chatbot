import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    const users = await prisma.user.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatarUrl,
      tenantId: u.tenantId,
      tenantName: u.tenant.name,
      tenantSlug: u.tenant.slug,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch users" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, email, password, role, tenantId } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "USER" | "ADMIN";
      tenantId?: string;
    };

    if (!email || !password || !tenantId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "Email, password, and organization are required" } },
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

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: cleanEmail } },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: { code: "USER_EXISTS", message: "User already exists in this organization" } },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenantId,
        name: name?.trim() || cleanEmail.split("@")[0],
        email: cleanEmail,
        passwordHash,
        role: role === "ADMIN" ? "ADMIN" : "USER",
      },
      include: {
        tenant: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        tenantSlug: user.tenant.slug,
        createdAt: user.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/users]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to create user" } },
      { status: 500 }
    );
  }
}
