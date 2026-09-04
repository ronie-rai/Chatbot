import crypto from "crypto";

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "admin@ofa-sports.com").toLowerCase();
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "asdfgjsfadjdfsajkl2132334ljkfs";

// 24-hour token validity
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface AdminAuthResult {
  valid: boolean;
  email?: string;
  error?: string;
}

/**
 * Creates an HMAC-signed admin authentication token.
 */
export function createAdminToken(email: string): string {
  const timestamp = Date.now();
  const payload = `${email.trim().toLowerCase()}:${timestamp}`;
  const hmac = crypto.createHmac("sha256", NEXTAUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64");
}

/**
 * Verifies that a request carries a valid, non-expired super admin token.
 */
export function verifyAdminToken(request: Request): AdminAuthResult {
  const saHeader = request.headers.get("x-sa-token");
  const authHeader = request.headers.get("authorization");

  let rawToken = saHeader;
  if (!rawToken && authHeader?.startsWith("Bearer ")) {
    rawToken = authHeader.substring(7).trim();
  }

  if (!rawToken) {
    return { valid: false, error: "Missing admin authorization token" };
  }

  try {
    const decoded = Buffer.from(rawToken, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) {
      return { valid: false, error: "Malformed admin token" };
    }

    const [email, timestampStr, providedHmac] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return { valid: false, error: "Invalid token timestamp" };
    }

    // Check expiration (24 hours)
    if (Date.now() - timestamp > TOKEN_TTL_MS) {
      return { valid: false, error: "Admin session has expired. Please sign in again." };
    }

    // Check email identity
    if (email.toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return { valid: false, error: "Unauthorized admin email" };
    }

    // Compute expected HMAC and compare using timingSafeEqual
    const payload = `${email}:${timestampStr}`;
    const expectedHmac = crypto.createHmac("sha256", NEXTAUTH_SECRET).update(payload).digest("hex");

    const providedBuf = Buffer.from(providedHmac, "hex");
    const expectedBuf = Buffer.from(expectedHmac, "hex");

    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return { valid: false, error: "Invalid token signature" };
    }

    return { valid: true, email };
  } catch (err) {
    return { valid: false, error: "Token verification failed" };
  }
}
