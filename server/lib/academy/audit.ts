/**
 * Append-only academy audit trail writer.
 * Pass a transaction client so the audit row commits atomically with the business change.
 * Secrets are redacted before persisting.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  tenantId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  /** Client-supplied idempotency / troubleshooting id (x-operation-id header). */
  operationId?: string | null;
}

const SECRET_KEY = /pass(word)?|token|secret|hash|credential|api[-_]?key/i;

/** Recursively strip secret-looking keys; returns JSON-safe data. */
export function redact(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => redact(v) ?? null) as Prisma.InputJsonArray;
  }
  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = redact(v);
    }
    return out as Prisma.InputJsonObject;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  const before = redact(entry.before);
  const after = redact(entry.after);
  await db.academyAuditLog.create({
    data: {
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary ?? null,
      before: before === null ? undefined : before,
      after: after === null ? undefined : after,
      reason: entry.reason ?? null,
      operationId: entry.operationId ?? null,
    },
  });
}
