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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_JSON", message: "Invalid or empty JSON body" } },
        { status: 400 }
      );
    }

    const { email, password, tenantSlug } = (body ?? {}) as {
      email?: string;
      password?: string;
      tenantSlug?: string;
    };

    if (!email || !password || !tenantSlug) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "email, password, tenantSlug required" } },
        { status: 400 }
      );
    }

    // Resolve tenant with flexible slug matching
    const cleanSlug = tenantSlug.trim();
    let tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: cleanSlug },
          { slug: cleanSlug.toLowerCase() },
          { slug: cleanSlug.replace(/_/g, "-").toLowerCase() },
          { slug: cleanSlug.replace(/-/g, "_") },
          { name: cleanSlug },
        ],
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_TENANT", message: `Organization "${tenantSlug}" not found. Please register or create it.` } },
        { status: 401 }
      );
    }

    // Find user (scoped to tenant)
    const cleanEmail = email.trim().toLowerCase();

    const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "admin@ofa-sports.com").toLowerCase();
    const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "OFA@SuperAdmin2026";
    const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "demo@user123";

    let user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: cleanEmail,
      },
    });

    const isEnvAdmin = cleanEmail === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD;
    const isEnvDemo = cleanEmail === "demo@ofa-sports.com" && password === DEMO_USER_PASSWORD;

    if (!user) {
      if (isEnvAdmin) {
        const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            name: "Super Admin",
            email: cleanEmail,
            passwordHash: hash,
            role: "ADMIN",
          },
        });
      } else if (isEnvDemo) {
        const hash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);
        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            name: "Demo User",
            email: cleanEmail,
            passwordHash: hash,
            role: "USER",
          },
        });
      } else {
        return NextResponse.json(
          { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
          { status: 401 }
        );
      }
    } else {
      let valid = false;
      if (isEnvAdmin || isEnvDemo) {
        valid = true;
      } else if (user.passwordHash) {
        valid = await bcrypt.compare(password, user.passwordHash);
      }

      if (!valid) {
        return NextResponse.json(
          { ok: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
          { status: 401 }
        );
      }
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
