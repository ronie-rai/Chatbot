-- Academy Phase 3-5: Finance, Bookings, Development, Inventory, Comms, Settings
-- Additive only -- no existing tables modified.

CREATE TABLE "acad_fee_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingMethod" TEXT NOT NULL DEFAULT 'FIXED',
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billingPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
    "proRateMidPeriod" BOOLEAN NOT NULL DEFAULT true,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "policies" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_fee_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_fee_plans_tenantId_sportId_active_idx" ON "acad_fee_plans"("tenantId","sportId","active");

CREATE TABLE "acad_player_fee_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "feePlanId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acad_player_fee_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_player_fee_assignments_tenantId_playerId_idx" ON "acad_player_fee_assignments"("tenantId","playerId");
CREATE INDEX "acad_player_fee_assignments_tenantId_feePlanId_idx" ON "acad_player_fee_assignments"("tenantId","feePlanId");

CREATE TABLE "acad_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "feePlanId" TEXT,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE,
    "finalizedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_invoices_tenantId_playerId_sportId_period_key" ON "acad_invoices"("tenantId","playerId","sportId","period");
CREATE INDEX "acad_invoices_tenantId_playerId_idx" ON "acad_invoices"("tenantId","playerId");
CREATE INDEX "acad_invoices_tenantId_status_idx" ON "acad_invoices"("tenantId","status");
CREATE INDEX "acad_invoices_tenantId_period_idx" ON "acad_invoices"("tenantId","period");

CREATE TABLE "acad_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "formulaSnapshot" JSONB NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "acad_invoice_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_invoice_lines_invoiceId_idx" ON "acad_invoice_lines"("invoiceId");

CREATE TABLE "acad_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acad_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_payments_tenantId_playerId_idx" ON "acad_payments"("tenantId","playerId");
CREATE INDEX "acad_payments_tenantId_paidAt_idx" ON "acad_payments"("tenantId","paidAt");

CREATE TABLE "acad_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "acad_payment_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_payment_allocations_paymentId_invoiceId_key" ON "acad_payment_allocations"("paymentId","invoiceId");
CREATE INDEX "acad_payment_allocations_invoiceId_idx" ON "acad_payment_allocations"("invoiceId");

CREATE TABLE "acad_fee_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acad_fee_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_fee_adjustments_tenantId_invoiceId_idx" ON "acad_fee_adjustments"("tenantId","invoiceId");

CREATE TABLE "acad_receipts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "storageKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acad_receipts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_receipts_tenantId_invoiceId_idx" ON "acad_receipts"("tenantId","invoiceId");

CREATE TABLE "acad_facilities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "capacity" INTEGER,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_facilities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_facilities_tenantId_name_key" ON "acad_facilities"("tenantId","name");
CREATE INDEX "acad_facilities_tenantId_active_idx" ON "acad_facilities"("tenantId","active");

CREATE TABLE "acad_facility_hours" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    CONSTRAINT "acad_facility_hours_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_facility_hours_facilityId_idx" ON "acad_facility_hours"("facilityId");

CREATE TABLE "acad_facility_closures" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    CONSTRAINT "acad_facility_closures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_facility_closures_facilityId_date_idx" ON "acad_facility_closures"("facilityId","date");

CREATE TABLE "acad_bookings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "title" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_bookings_tenantId_facilityId_startAt_idx" ON "acad_bookings"("tenantId","facilityId","startAt");
CREATE INDEX "acad_bookings_tenantId_requestedBy_idx" ON "acad_bookings"("tenantId","requestedBy");
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "acad_bookings" ADD COLUMN "_tsrange" TSTZRANGE GENERATED ALWAYS AS (tstzrange("startAt" AT TIME ZONE 'UTC',"endAt" AT TIME ZONE 'UTC')) STORED;
CREATE INDEX "acad_bookings_tsrange_gist_idx" ON "acad_bookings" USING GIST ("facilityId","_tsrange");
ALTER TABLE "acad_bookings" ADD CONSTRAINT "acad_bookings_no_overlap"
    EXCLUDE USING GIST ("facilityId" WITH =, "_tsrange" WITH &&)
    WHERE (status = 'CONFIRMED');

CREATE TABLE "acad_assessment_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sportId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_assessment_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_assessment_templates_tenantId_sportId_active_idx" ON "acad_assessment_templates"("tenantId","sportId","active");

CREATE TABLE "acad_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "batchId" TEXT,
    "assessedDate" DATE NOT NULL,
    "notes" TEXT,
    "conductedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acad_assessments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_assessments_tenantId_assessedDate_idx" ON "acad_assessments"("tenantId","assessedDate");
CREATE INDEX "acad_assessments_tenantId_templateId_idx" ON "acad_assessments"("tenantId","templateId");

CREATE TABLE "acad_assessment_results" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "notes" TEXT,
    CONSTRAINT "acad_assessment_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_assessment_results_assessmentId_playerId_key" ON "acad_assessment_results"("assessmentId","playerId");
CREATE INDEX "acad_assessment_results_playerId_idx" ON "acad_assessment_results"("playerId");

CREATE TABLE "acad_item_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_item_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_item_types_tenantId_name_key" ON "acad_item_types"("tenantId","name");
CREATE INDEX "acad_item_types_tenantId_active_idx" ON "acad_item_types"("tenantId","active");

CREATE TABLE "acad_item_allocations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemTypeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'ISSUED',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "size" TEXT,
    "number" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acad_item_allocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_item_allocations_tenantId_playerId_idx" ON "acad_item_allocations"("tenantId","playerId");
CREATE INDEX "acad_item_allocations_tenantId_itemTypeId_idx" ON "acad_item_allocations"("tenantId","itemTypeId");

CREATE TABLE "acad_announcements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "sportId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_announcements_tenantId_publishedAt_idx" ON "acad_announcements"("tenantId","publishedAt");

CREATE TABLE "acad_announcement_reads" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acad_announcement_reads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_announcement_reads_announcementId_userId_key" ON "acad_announcement_reads"("announcementId","userId");

CREATE TABLE "acad_notification_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "daysOffset" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_notification_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_notification_rules_tenantId_eventType_daysOffset_key" ON "acad_notification_rules"("tenantId","eventType","daysOffset");
CREATE INDEX "acad_notification_rules_tenantId_enabled_idx" ON "acad_notification_rules"("tenantId","enabled");

CREATE TABLE "acad_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_notifications_tenantId_userId_status_idx" ON "acad_notifications"("tenantId","userId","status");
CREATE INDEX "acad_notifications_tenantId_type_dedupeKey_idx" ON "acad_notifications"("tenantId","type","dedupeKey");

CREATE TABLE "acad_notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerRef" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_notification_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "acad_notification_deliveries_notificationId_idx" ON "acad_notification_deliveries"("notificationId");
CREATE INDEX "acad_notification_deliveries_status_lastAttemptAt_idx" ON "acad_notification_deliveries"("status","lastAttemptAt");

CREATE TABLE "acad_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "playerIdPrefix" TEXT NOT NULL DEFAULT 'OFA',
    "attendanceCorrectionWindowDays" INTEGER NOT NULL DEFAULT 7,
    "holidays" JSONB,
    "policies" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "acad_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "acad_settings_tenantId_key" ON "acad_settings"("tenantId");

ALTER TABLE "acad_player_fee_assignments" ADD CONSTRAINT "acad_player_fee_assignments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acad_player_fee_assignments" ADD CONSTRAINT "acad_player_fee_assignments_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "acad_fee_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_invoices" ADD CONSTRAINT "acad_invoices_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_invoice_lines" ADD CONSTRAINT "acad_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "acad_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acad_payments" ADD CONSTRAINT "acad_payments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_payment_allocations" ADD CONSTRAINT "acad_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "acad_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acad_payment_allocations" ADD CONSTRAINT "acad_payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "acad_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_fee_adjustments" ADD CONSTRAINT "acad_fee_adjustments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "acad_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_receipts" ADD CONSTRAINT "acad_receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "acad_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_receipts" ADD CONSTRAINT "acad_receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "acad_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "acad_facility_hours" ADD CONSTRAINT "acad_facility_hours_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "acad_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acad_facility_closures" ADD CONSTRAINT "acad_facility_closures_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "acad_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acad_bookings" ADD CONSTRAINT "acad_bookings_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "acad_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_assessments" ADD CONSTRAINT "acad_assessments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "acad_assessment_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_assessment_results" ADD CONSTRAINT "acad_assessment_results_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "acad_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acad_assessment_results" ADD CONSTRAINT "acad_assessment_results_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_item_allocations" ADD CONSTRAINT "acad_item_allocations_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "acad_item_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_item_allocations" ADD CONSTRAINT "acad_item_allocations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "acad_announcement_reads" ADD CONSTRAINT "acad_announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "acad_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "acad_notification_deliveries" ADD CONSTRAINT "acad_notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "acad_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;