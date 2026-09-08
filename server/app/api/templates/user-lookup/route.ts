import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/templates/user-lookup?phone=...&tenantId=...
 * Autopopulates user information (name, email, recent preferences) based on phone number entry.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get("phone")?.trim();
    let tenantId = searchParams.get("tenantId")?.trim();

    if (!rawPhone) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_PHONE", message: "Phone number is required" } },
        { status: 400 }
      );
    }

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id || "";
    }

    // Extract core digits (e.g. last 10 digits) for robust lookup
    const digitsOnly = rawPhone.replace(/\D/g, "");
    const lookupDigits = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

    if (lookupDigits.length < 6) {
      return NextResponse.json({ ok: true, data: { found: false } });
    }

    // 1. Search recent submissions for this tenant
    let pastSubmission = await prisma.templateSubmission.findFirst({
      where: {
        tenantId,
        OR: [
          { userPhone: { contains: lookupDigits } },
          { userPhone: { contains: rawPhone } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // If not found directly, do digit-normalized match across recent tenant submissions
    if (!pastSubmission) {
      const candidates = await prisma.templateSubmission.findMany({
        where: {
          tenantId,
          userPhone: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      pastSubmission = candidates.find((c) => {
        if (!c.userPhone) return false;
        const cDigits = c.userPhone.replace(/\D/g, "");
        return cDigits.endsWith(lookupDigits) || cDigits.includes(lookupDigits) || lookupDigits.includes(cDigits.slice(-10));
      }) || null;
    }

    if (pastSubmission) {
      const subData = (pastSubmission.data as Record<string, string>) || {};
      const email =
        subData["Email"] ||
        subData["Email Address"] ||
        subData["email"] ||
        undefined;

      return NextResponse.json({
        ok: true,
        data: {
          found: true,
          name: pastSubmission.userName || subData["Full Name"] || subData["Member Name"] || subData["Athlete Name"] || "",
          phone: pastSubmission.userPhone || rawPhone,
          email: email || "",
          recentSport: subData["Sport / Facility"] || subData["Sport"] || subData["Sport Program"] || "",
          data: subData,
        },
      });
    }

    // 2. Search registered users in tenant
    const matchedUser = await prisma.user.findFirst({
      where: {
        tenantId,
        role: "USER",
        OR: [
          { email: { contains: lookupDigits } },
          { name: { contains: lookupDigits } },
        ],
      },
    });

    if (matchedUser) {
      return NextResponse.json({
        ok: true,
        data: {
          found: true,
          name: matchedUser.name,
          phone: rawPhone,
          email: matchedUser.email,
          data: {},
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: { found: false },
    });
  } catch (error: any) {
    console.error("[GET /api/templates/user-lookup]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error.message || "Lookup failed" } },
      { status: 500 }
    );
  }
}
