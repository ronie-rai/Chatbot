import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

/**
 * POST /api/auth/login
 * Body: { email, password, tenantSlug }
 * Returns: { token, user }
 *
 * Simple JWT auth — Phase 8 can migrate to full NextAuth sessions.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, password, tenantSlug } = body as {
      email: string;
      password: string;
      tenantSlug: string;
    };

    if (!email || !password || !tenantSlug) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "email, password, tenantSlug required" } },
        { status: 400 }
      );
    }

    // Resolve tenant
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_TENANT", message: "Tenant not found" } },
        { status: 401 }
      );
    }

    // Find user (scoped to tenant)
    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    // Issue JWT
    const token = await new SignJWT({
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      name: user.name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    return NextResponse.json({
      ok: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.toLowerCase(),
          tenantId: user.tenantId,
          avatarUrl: user.avatarUrl,
        },
      },
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
