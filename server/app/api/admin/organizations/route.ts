import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractSpreadsheetId } from "@/lib/ai";
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
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sheetConnections: {
          take: 1,
          select: {
            id: true,
            spreadsheetId: true,
            sheetName: true,
            authMode: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            users: true,
            conversations: true,
          },
        },
      },
    });

    const data = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      createdAt: t.createdAt.toISOString(),
      userCount: t._count.users,
      groupCount: t._count.conversations,
      sheetConnection: t.sheetConnections[0]
        ? {
            id: t.sheetConnections[0].id,
            spreadsheetId: t.sheetConnections[0].spreadsheetId,
            sheetName: t.sheetConnections[0].sheetName,
            authMode: t.sheetConnections[0].authMode,
            createdAt: t.sheetConnections[0].createdAt.toISOString(),
          }
        : null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/admin/organizations]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch organizations" } },
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
    const { name, slug, sheetUrl, sheetName } = body as {
      name?: string;
      slug?: string;
      sheetUrl?: string;
      sheetName?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_NAME", message: "Organization name is required" } },
        { status: 400 }
      );
    }

    const cleanSlug = (slug?.trim() || name.trim()).toLowerCase().replace(/[^a-z0-9-_]/g, "-");

    const existing = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: { code: "ORG_EXISTS", message: "An organization with this slug already exists" } },
        { status: 409 }
      );
    }

    // 1. Create Organization
    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        slug: cleanSlug,
      },
    });

    // 2. Create the default OFA AI Bot user
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: "OFA AI",
        email: `bot@${cleanSlug}.com`,
        role: "BOT",
      },
    });

    // 3. Create Google Sheet configuration if provided
    let createdSheet = null;
    const extractedId = extractSpreadsheetId(sheetUrl);
    if (extractedId) {
      createdSheet = await prisma.sheetConnection.create({
        data: {
          tenantId: tenant.id,
          spreadsheetId: extractedId,
          sheetName: sheetName?.trim() || "Bookings",
          authMode: "SERVICE_ACCOUNT",
          columns: [
            { name: "customer_name", label: "Customer Name", description: "Name of customer", required: true },
            { name: "phone_number", label: "Phone Number", description: "Contact number", required: false },
            { name: "enquiry", label: "Enquiry", description: "Enquiry or booking details", required: true },
          ],
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.createdAt.toISOString(),
        userCount: 1, // bot
        groupCount: 0,
        sheetConnection: createdSheet
          ? {
              id: createdSheet.id,
              spreadsheetId: createdSheet.spreadsheetId,
              sheetName: createdSheet.sheetName,
              authMode: createdSheet.authMode,
            }
          : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/organizations]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to create organization" } },
      { status: 500 }
    );
  }
}
