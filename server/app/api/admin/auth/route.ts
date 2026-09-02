import { NextResponse } from "next/server";
import crypto from "crypto";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "admin@ofa-sports.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "OFA@SuperAdmin2026";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "changeme";

// Simple HMAC token: base64(email + ":" + timestamp + ":" + hmac)
function createToken(email: string): string {
  const payload = `${email}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", NEXTAUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64");
}

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

    const token = createToken(email);
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "Bad request" } },
      { status: 400 }
    );
  }
}
