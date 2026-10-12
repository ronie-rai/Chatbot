-- CreateTable
CREATE TABLE "acad_sports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultBillingMethod" TEXT NOT NULL DEFAULT 'FIXED',
    "attendanceRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_player_counters" (
    "tenantId" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "acad_player_counters_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "acad_players" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "playerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "address" TEXT,
    "joiningDate" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "photoKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_player_sports" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acad_player_sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coachUserId" TEXT,
    "days" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "facilityId" TEXT,
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_batch_enrollments" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,

    CONSTRAINT "acad_batch_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "coachUserId" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acad_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_attendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "markedBy" TEXT NOT NULL,
    "opId" TEXT,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_attendance_corrections" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "correctedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acad_attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_form_sections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "acad_form_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_form_fields" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectionId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "validation" JSONB,
    "options" JSONB,
    "visibility" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_field_values" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acad_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_guardians" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acad_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_guardian_players" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "relation" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "acad_guardian_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acad_guardian_invites" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acad_guardian_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acad_sports_tenantId_active_idx" ON "acad_sports"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "acad_sports_tenantId_name_key" ON "acad_sports"("tenantId", "name");

-- CreateIndex
CREATE INDEX "acad_players_tenantId_status_idx" ON "acad_players"("tenantId", "status");

-- CreateIndex
CREATE INDEX "acad_players_tenantId_guardianPhone_idx" ON "acad_players"("tenantId", "guardianPhone");

-- CreateIndex
CREATE INDEX "acad_players_tenantId_name_idx" ON "acad_players"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "acad_players_tenantId_playerCode_key" ON "acad_players"("tenantId", "playerCode");

-- CreateIndex
CREATE INDEX "acad_player_sports_sportId_idx" ON "acad_player_sports"("sportId");

-- CreateIndex
CREATE UNIQUE INDEX "acad_player_sports_playerId_sportId_key" ON "acad_player_sports"("playerId", "sportId");

-- CreateIndex
CREATE INDEX "acad_batches_tenantId_active_idx" ON "acad_batches"("tenantId", "active");

-- CreateIndex
CREATE INDEX "acad_batches_tenantId_coachUserId_idx" ON "acad_batches"("tenantId", "coachUserId");

-- CreateIndex
CREATE UNIQUE INDEX "acad_batches_tenantId_sportId_name_key" ON "acad_batches"("tenantId", "sportId", "name");

-- CreateIndex
CREATE INDEX "acad_batch_enrollments_playerId_idx" ON "acad_batch_enrollments"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "acad_batch_enrollments_batchId_playerId_startDate_key" ON "acad_batch_enrollments"("batchId", "playerId", "startDate");

-- CreateIndex
CREATE INDEX "acad_sessions_tenantId_date_idx" ON "acad_sessions"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "acad_sessions_batchId_date_startTime_key" ON "acad_sessions"("batchId", "date", "startTime");

-- CreateIndex
CREATE INDEX "acad_attendance_tenantId_playerId_idx" ON "acad_attendance"("tenantId", "playerId");

-- CreateIndex
CREATE INDEX "acad_attendance_tenantId_opId_idx" ON "acad_attendance"("tenantId", "opId");

-- CreateIndex
CREATE UNIQUE INDEX "acad_attendance_sessionId_playerId_key" ON "acad_attendance"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "acad_attendance_corrections_attendanceId_idx" ON "acad_attendance_corrections"("attendanceId");

-- CreateIndex
CREATE INDEX "acad_form_sections_tenantId_order_idx" ON "acad_form_sections"("tenantId", "order");

-- CreateIndex
CREATE INDEX "acad_form_fields_tenantId_archived_order_idx" ON "acad_form_fields"("tenantId", "archived", "order");

-- CreateIndex
CREATE UNIQUE INDEX "acad_form_fields_tenantId_key_key" ON "acad_form_fields"("tenantId", "key");

-- CreateIndex
CREATE INDEX "acad_field_values_tenantId_fieldId_idx" ON "acad_field_values"("tenantId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "acad_field_values_playerId_fieldId_key" ON "acad_field_values"("playerId", "fieldId");

-- CreateIndex
CREATE INDEX "acad_guardians_tenantId_phone_idx" ON "acad_guardians"("tenantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "acad_guardians_tenantId_userId_key" ON "acad_guardians"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "acad_guardian_players_playerId_idx" ON "acad_guardian_players"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "acad_guardian_players_guardianId_playerId_key" ON "acad_guardian_players"("guardianId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "acad_guardian_invites_tokenHash_key" ON "acad_guardian_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "acad_guardian_invites_tenantId_playerId_idx" ON "acad_guardian_invites"("tenantId", "playerId");

-- AddForeignKey
ALTER TABLE "acad_player_sports" ADD CONSTRAINT "acad_player_sports_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_player_sports" ADD CONSTRAINT "acad_player_sports_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "acad_sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_batches" ADD CONSTRAINT "acad_batches_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "acad_sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_batch_enrollments" ADD CONSTRAINT "acad_batch_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "acad_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_batch_enrollments" ADD CONSTRAINT "acad_batch_enrollments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_sessions" ADD CONSTRAINT "acad_sessions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "acad_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_attendance" ADD CONSTRAINT "acad_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "acad_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_attendance" ADD CONSTRAINT "acad_attendance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_attendance_corrections" ADD CONSTRAINT "acad_attendance_corrections_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "acad_attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_form_fields" ADD CONSTRAINT "acad_form_fields_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "acad_form_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_field_values" ADD CONSTRAINT "acad_field_values_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_field_values" ADD CONSTRAINT "acad_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "acad_form_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_guardian_players" ADD CONSTRAINT "acad_guardian_players_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "acad_guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_guardian_players" ADD CONSTRAINT "acad_guardian_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acad_guardian_invites" ADD CONSTRAINT "acad_guardian_invites_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "acad_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

