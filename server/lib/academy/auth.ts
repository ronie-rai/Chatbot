/**
 * Academy request authentication & authorization.
 *
 * Every /api/academy/* route (except the super-admin bootstrap) goes through
 * `requireAcademy()`, which:
 *   1. verifies the signed user JWT issued by /api/auth/login,
 *   2. checks the per-tenant feature flag,
 *   3. loads an active AcademyMembership scoped to the token's tenantId,
 *   4. resolves effective permissions (defaults + tenant overrides),
 *   5. enforces the requested resource:action.
 */
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import {
  can,
  isAcademyRole,
  resolvePermissions,
  type AcademyAction,
  type AcademyResource,
  type AcademyRoleName,
  type PermissionKey,
} from "@/lib/academy/permissions";

// Same signing secret/derivation as /api/auth/login (safe default for local dev only).
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production"
);

export const academyFlagKey = (tenantId: string): string => `academy.enabled.${tenantId}`;

export async function isAcademyEnabled(tenantId: string): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({ where: { key: academyFlagKey(tenantId) } });
  return row?.value === "true";
}

export function academyError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export interface AcademyContext {
  userId: string;
  tenantId: string;
  role: AcademyRoleName;
  permissions: Set<PermissionKey>;
}

export type AcademyAuthResult =
  | { ok: true; ctx: AcademyContext }
  | { ok: false; response: NextResponse };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.substring(7).trim();
  return token.length > 0 ? token : null;
}

/** Authenticate the caller as an active academy member of their own tenant. */
export async function authenticateAcademy(request: Request): Promise<AcademyAuthResult> {
  const token = bearerToken(request);
  if (!token) {
    return { ok: false, response: academyError(401, "UNAUTHORIZED", "Sign-in token required") };
  }

  let userId: string;
  let tenantId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.tenantId !== "string") {
      throw new Error("Malformed token claims");
    }
    userId = payload.sub;
    tenantId = payload.tenantId;
  } catch {
    return { ok: false, response: academyError(401, "UNAUTHORIZED", "Invalid or expired token") };
  }

  // Do not reveal whether the module exists to tenants that haven't enabled it.
  if (!(await isAcademyEnabled(tenantId))) {
    return { ok: false, response: academyError(403, "ACADEMY_DISABLED", "Academy module is not enabled") };
  }

  const membership = await prisma.academyMembership.findFirst({
    where: { tenantId, userId, active: true },
    select: { role: true },
  });
  if (!membership || !isAcademyRole(membership.role)) {
    return { ok: false, response: academyError(403, "FORBIDDEN", "No academy access for this account") };
  }

  const overrides = await prisma.academyRolePermission.findMany({
    where: { tenantId, role: membership.role },
    select: { resource: true, action: true, granted: true },
  });

  return {
    ok: true,
    ctx: {
      userId,
      tenantId,
      role: membership.role,
      permissions: resolvePermissions(membership.role, overrides),
    },
  };
}

/** Authenticate AND enforce a specific permission (backend authorization boundary). */
export async function requireAcademy(
  request: Request,
  resource: AcademyResource,
  action: AcademyAction
): Promise<AcademyAuthResult> {
  const auth = await authenticateAcademy(request);
  if (!auth.ok) return auth;
  if (!can(auth.ctx.permissions, resource, action)) {
    return {
      ok: false,
      response: academyError(403, "FORBIDDEN", `Missing permission ${resource}:${action}`),
    };
  }
  return auth;
}
