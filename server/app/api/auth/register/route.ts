import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

/**
 * POST /api/auth/register
 * Body: { name, email, password, tenantSlug, tenantName }
 * Creates or selects the organization dynamically, creates user with ADMIN role if first user.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, email, password, tenantSlug, tenantName } = body as {
      name?: string;
      email?: string;
      password?: string;
      tenantSlug?: string;
      tenantName?: string;
    };

    if (!email || !password || !tenantSlug) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_FIELDS", message: "Email, password, and organization are required" } },
        { status: 400 }
      );
    }

    const cleanSlug = tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const cleanName = tenantName?.trim() || tenantSlug.trim();

    // 1. Get or create the Organization (Tenant)
    let tenant = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    let isNewTenant = false;

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: cleanName,
          slug: cleanSlug,
        },
      });
      isNewTenant = true;

      // Create the default OFA AI Bot user for this new organization
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: "OFA AI",
          email: `bot@${cleanSlug}.com`,
          role: "BOT",
        },
      });
    }

    // 2. Check if user already exists in this organization
    const existingUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: email.trim().toLowerCase() } },
    });

    if (existingUser) {
      return NextResponse.json(
        { ok: false, error: { code: "USER_EXISTS", message: "A user with this email already exists in this organization" } },
        { status: 409 }
      );
    }

    // 3. Create the user
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: name?.trim() || email.split("@")[0],
        email: email.trim().toLowerCase(),
        passwordHash,
        role: isNewTenant ? "ADMIN" : "USER",
      },
    });

    // 4. Create an initial welcome AI conversation for the user
    const botUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: "BOT" },
    });

    const initialConversation = await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        name: "Welcome to OFA Sports",
        kind: "AI",
        participants: {
          create: [
            { userId: user.id },
            ...(botUser ? [{ userId: botUser.id }] : []),
          ],
        },
      },
    });

    if (botUser) {
      await prisma.message.create({
        data: {
          conversationId: initialConversation.id,
          senderId: botUser.id,
          body: `Welcome to ${tenant.name}! I'm OFA AI. How can I assist you today?`,
          kind: "TEXT",
          status: "SENT",
        },
      });
    }

    // 5. Issue JWT
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

    return NextResponse.json(
      {
        ok: true,
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.toLowerCase(),
            tenantId: user.tenantId,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/register]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to register user" } },
      { status: 500 }
    );
  }
}
