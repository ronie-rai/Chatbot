import { NextResponse } from "next/server";
import { createAdminToken } from "@/lib/adminAuth";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "admin@ofa-sports.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "OFA@SuperAdmin2026";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { email?: string; password?: string };
    const { email = "", password = "" } = body;

    if (
      email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase() ||
      password !== SUPER_ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        { ok: false, error: { message: "Invalid credentials" } },
        { status: 401 }
      );
    }

    const token = createAdminToken(email);
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "Bad request" } },
      { status: 400 }
    );
  }
}
