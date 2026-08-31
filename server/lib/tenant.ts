/**
 * Tenant resolution utilities.
 * Extracts tenantId from the request context.
 * Phase 8: Will use JWT claims. Phase 7: Uses X-Tenant-Slug header for dev.
 */
import { prisma } from "./prisma";

export async function getTenantFromRequest(request: Request): Promise<string | null> {
  // Phase 8: Extract from JWT
  // For now: X-Tenant-Slug header → DB lookup
  const slug = request.headers.get("x-tenant-slug");
  if (!slug) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });

  return tenant?.id ?? null;
}

export async function requireTenant(request: Request): Promise<string> {
  const tenantId = await getTenantFromRequest(request);
  if (!tenantId) {
    throw new Error("TENANT_REQUIRED");
  }
  return tenantId;
}
