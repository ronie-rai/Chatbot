-- Academy module Phase 1: additive only. No existing table or column is modified.

-- CreateEnum
CREATE TYPE "AcademyRole" AS ENUM ('OWNER', 'MANAGER', 'COACH', 'ACCOUNTS', 'RECEPTION', 'GUARDIAN');

-- CreateTable
CREATE TABLE "acad_memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AcademyRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_role_permissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "AcademyRole" NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "operationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acad_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acad_memberships_tenantId_role_idx" ON "acad_memberships"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "acad_memberships_tenantId_userId_key" ON "acad_memberships"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "acad_role_permissions_tenantId_role_idx" ON "acad_role_permissions"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "acad_role_permissions_tenantId_role_resource_action_key" ON "acad_role_permissions"("tenantId", "role", "resource", "action");

-- CreateIndex
CREATE INDEX "acad_audit_logs_tenantId_createdAt_idx" ON "acad_audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "acad_audit_logs_tenantId_entityType_entityId_idx" ON "acad_audit_logs"("tenantId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "acad_memberships" ADD CONSTRAINT "acad_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_memberships" ADD CONSTRAINT "acad_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_role_permissions" ADD CONSTRAINT "acad_role_permissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tamper resistance: the audit log is append-only.
CREATE OR REPLACE FUNCTION acad_audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'acad_audit_logs is append-only (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acad_audit_logs_no_update
  BEFORE UPDATE OR DELETE ON "acad_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION acad_audit_logs_immutable();
