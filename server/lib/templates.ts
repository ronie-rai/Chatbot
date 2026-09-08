import { prisma } from "@/lib/prisma";
import {
  getEffectiveSpreadsheetId,
  getGoogleSheetsClient,
  getGroqClient,
  getGroqModel,
} from "@/lib/ai";

export type FieldDataType =
  | "text"
  | "textarea"
  | "number"
  | "float"
  | "phone"
  | "email"
  | "date"
  | "time"
  | "dropdown"
  | "choice"
  | "boolean";

export interface TemplateField {
  key: string;
  label: string;
  required: boolean;
  type?: FieldDataType;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  optionSource?: "manual" | "table";
  linkedTemplateCommand?: string;
  linkedFieldKey?: string;
}

export interface TemplateInput {
  command: string;
  name: string;
  description?: string;
  sheetName: string;
  icon?: string;
  fields: TemplateField[];
  promptMessage?: string;
}

// ─── Default Sports Foundation Templates ──────────────────────────────────────

export const DEFAULT_SPORTS_TEMPLATES: TemplateInput[] = [
  {
    command: "booking",
    name: "Facility & Court Booking",
    description: "Reserve tennis courts, badminton courts, football turf, or gym slots",
    sheetName: "Facility Bookings",
    icon: "🏟️",
    fields: [
      { key: "phone", label: "Phone Number", required: true, type: "phone", placeholder: "+91 98765 43210" },
      { key: "name", label: "Full Name", required: true, type: "text", placeholder: "e.g. Rohan Sharma" },
      {
        key: "sport",
        label: "Sport / Facility",
        required: true,
        type: "dropdown",
        placeholder: "Select Court or Facility",
        options: [
          "Tennis - Court 1",
          "Tennis - Court 2",
          "Tennis - Court 3",
          "Tennis - Court 4",
          "Badminton - Court 1",
          "Badminton - Court 2",
          "Football Turf",
          "Cricket Nets",
          "Basketball Court",
          "Gym & Fitness Area",
        ],
      },
      { key: "date", label: "Booking Date", required: true, type: "date", placeholder: "Select Date" },
      { key: "time_slot", label: "Time Slot", required: true, type: "time", placeholder: "Select Time Slot" },
      { key: "duration", label: "Duration", required: false, type: "text", defaultValue: "1 Hr", placeholder: "1 Hr" },
      { key: "players", label: "No. of Players", required: false, type: "number", placeholder: "e.g. 4" },
      { key: "notes", label: "Special Requests", required: false, type: "textarea", placeholder: "Need rackets, balls, or coach" },
    ],
  },
  {
    command: "membership",
    name: "Academy & Club Membership",
    description: "Register for ongoing sports foundation training batches and memberships",
    sheetName: "Memberships",
    icon: "🏅",
    fields: [
      { key: "name", label: "Member Name", required: true, type: "text" },
      { key: "guardian", label: "Guardian / Parent Name", required: false, type: "text" },
      { key: "phone", label: "Contact Phone", required: true, type: "phone" },
      { key: "email", label: "Email Address", required: false, type: "text" },
      { key: "sport", label: "Sport Program", required: true, type: "text", placeholder: "Athletics, Football, Basketball, Swimming" },
      { key: "tier", label: "Membership Plan", required: true, type: "choice", placeholder: "Monthly / Quarterly / Annual / Scholarship" },
      { key: "start_date", label: "Preferred Start Date", required: true, type: "date" },
      { key: "emergency_contact", label: "Emergency Contact", required: false, type: "phone" },
    ],
  },
  {
    command: "trial",
    name: "Free Assessment & Trial Session",
    description: "Book an athlete skills evaluation or trial training session",
    sheetName: "Trial Assessments",
    icon: "⚡",
    fields: [
      { key: "name", label: "Athlete Name", required: true, type: "text" },
      { key: "age", label: "Age / Category", required: true, type: "text", placeholder: "e.g. 14 years / U-15" },
      { key: "phone", label: "Contact Phone", required: true, type: "phone" },
      { key: "sport", label: "Sport of Interest", required: true, type: "text" },
      { key: "skill_level", label: "Experience Level", required: true, type: "choice", placeholder: "Beginner / Intermediate / Advanced" },
      { key: "preferred_date", label: "Preferred Trial Date", required: true, type: "date" },
    ],
  },
  {
    command: "tournament",
    name: "Tournament & Event Entry",
    description: "Register for upcoming foundation leagues, matches, and tournaments",
    sheetName: "Tournament Entries",
    icon: "🏆",
    fields: [
      { key: "team_or_player", label: "Team / Player Name", required: true, type: "text" },
      { key: "captain_phone", label: "Contact Phone", required: true, type: "phone" },
      { key: "event_name", label: "Tournament / Event Name", required: true, type: "text" },
      { key: "category", label: "Age Category / Division", required: true, type: "text", placeholder: "e.g. Open / U-17 Boys" },
      { key: "player_count", label: "Number of Squad Members", required: false, type: "number" },
      { key: "payment_ref", label: "Entry Fee / UPI Reference", required: false, type: "text" },
    ],
  },
  {
    command: "equipment",
    name: "Sports Kit & Gear Requisition",
    description: "Request foundation sports gear, kits, balls, or protective equipment",
    sheetName: "Equipment Requests",
    icon: "🎽",
    fields: [
      { key: "requested_by", label: "Student / Coach Name", required: true, type: "text" },
      { key: "id_number", label: "Member / Roll ID", required: false, type: "text" },
      { key: "sport", label: "Sport Department", required: true, type: "text" },
      { key: "gear_item", label: "Gear / Kit Requested", required: true, type: "text", placeholder: "e.g. Training Bibs, Football Size 5, Bat" },
      { key: "quantity", label: "Quantity", required: true, type: "number", placeholder: "e.g. 2" },
      { key: "issue_date", label: "Required Date", required: true, type: "date" },
      { key: "return_date", label: "Expected Return Date", required: false, type: "date" },
    ],
  },
  {
    command: "coaching",
    name: "1-on-1 Coaching Consultation",
    description: "Schedule private high-performance coaching or fitness consultation",
    sheetName: "Coaching Enquiries",
    icon: "🏋️",
    fields: [
      { key: "name", label: "Trainee Name", required: true, type: "text" },
      { key: "phone", label: "Contact Phone", required: true, type: "phone" },
      { key: "sport", label: "Target Sport", required: true, type: "text" },
      { key: "skill_level", label: "Current Level", required: true, type: "choice", placeholder: "Grassroots / State / National" },
      { key: "goals", label: "Focus / Goals", required: true, type: "text", placeholder: "Strength, Speed, Technique, Match Play" },
      { key: "preferred_schedule", label: "Preferred Days / Timing", required: false, type: "text" },
    ],
  },
  {
    command: "feedback",
    name: "Athlete & Parent Feedback",
    description: "Submit feedback, coaching reviews, or facility improvement suggestions",
    sheetName: "Feedback & Grievances",
    icon: "💬",
    fields: [
      { key: "name", label: "Your Name", required: true, type: "text" },
      { key: "phone", label: "Contact Phone", required: false, type: "phone" },
      { key: "category", label: "Feedback Category", required: true, type: "choice", placeholder: "Coaching / Facilities / Administration / Safety" },
      { key: "rating", label: "Overall Rating (1 to 5)", required: true, type: "number", placeholder: "e.g. 5" },
      { key: "comments", label: "Comments & Suggestions", required: true, type: "text" },
    ],
  },
  {
    command: "sponsor",
    name: "Foundation Grant & Sponsorship",
    description: "Partner with our sports foundation to sponsor athletes, equipment, or events",
    sheetName: "Sponsorships & Grants",
    icon: "🤝",
    fields: [
      { key: "sponsor_name", label: "Sponsor / Organization", required: true, type: "text" },
      { key: "contact_person", label: "Contact Person", required: true, type: "text" },
      { key: "contact_phone", label: "Phone / WhatsApp", required: true, type: "phone" },
      { key: "email", label: "Email Address", required: false, type: "text" },
      { key: "program", label: "Supported Sport / Athlete", required: true, type: "text" },
      { key: "contribution", label: "Contribution / Grant Amount", required: true, type: "text", placeholder: "e.g. ₹50,000 / Kit Supply" },
      { key: "message", label: "Collaboration Details", required: false, type: "text" },
    ],
  },
];

// ─── Format Form Prompt for Users ─────────────────────────────────────────────

export function buildTemplatePromptMessage(t: {
  command: string;
  name: string;
  icon?: string | null;
  fields: TemplateField[];
  description?: string | null;
}): string {
  const icon = t.icon || "📋";
  const fieldList = t.fields
    .map((f) => {
      const reqMark = f.required ? " *(Required)*" : " *(Optional)*";
      const hint = f.placeholder ? ` — *e.g. ${f.placeholder}*` : "";
      return `• **${f.label}**${reqMark}${hint}`;
    })
    .join("\n");

  return `${icon} *${t.name}*\n${t.description ? `_${t.description}_\n\n` : "\n"}Please copy, fill, and reply with the details below (or reply in your own words):\n\n${fieldList}\n\n💡 *Tip:* You can send all details in a single message or answer line by line!`;
}

// ─── Google Sheets Multi-Sheet Tab Management ──────────────────────────────────

/**
 * Ensures that a dedicated sheet tab exists for the template in the Google Spreadsheet,
 * and sets up standard headers in row 1 if newly created.
 */
export async function ensureTemplateSheetTab(
  spreadsheetId: string,
  sheetName: string,
  fields: TemplateField[]
): Promise<{ success: boolean; created: boolean; error?: string }> {
  try {
    const sheets = await getGoogleSheetsClient();
    if (!sheets) {
      console.log(`[templates] Google credentials not configured. Simulated sheet tab "${sheetName}".`);
      return { success: true, created: false };
    }

    // 1. Fetch spreadsheet metadata to check if tab exists
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTabs = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter(Boolean);

    const cleanTitle = sheetName.trim();
    const tabExists = existingTabs.some((t) => t.toLowerCase() === cleanTitle.toLowerCase());

    if (!tabExists) {
      // 2. Create the new tab in Google Sheets
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: cleanTitle,
                },
              },
            },
          ],
        },
      });
      console.log(`[templates] 📑 Created new Google Sheet tab: "${cleanTitle}"`);
    }

    // 3. Check and write headers in row 1
    const standardHeaders = [
      "Submission ID",
      "Timestamp",
      "User Name",
      "User Phone",
      ...fields.map((f) => f.label),
      "Status",
      "Raw Message",
    ];

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${cleanTitle}'!1:1`,
    });

    const existingHeaders = (headerRes.data.values?.[0] as string[] | undefined) || [];

    if (existingHeaders.length === 0) {
      // Write full headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${cleanTitle}'!1:1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [standardHeaders],
        },
      });
      console.log(`[templates] 📋 Wrote header row for "${cleanTitle}"`);
    } else {
      // Append any missing field headers
      const missing = standardHeaders.filter((h) => !existingHeaders.includes(h));
      if (missing.length > 0) {
        const updated = [...existingHeaders, ...missing];
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${cleanTitle}'!1:1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [updated],
          },
        });
        console.log(`[templates] ➕ Appended new column headers to "${cleanTitle}":`, missing);
      }
    }

    return { success: true, created: !tabExists };
  } catch (err: any) {
    console.error(`[templates] Failed to create or sync sheet tab "${sheetName}":`, err);
    return { success: false, created: false, error: err.message || "Google Sheets error" };
  }
}

// ─── Tenant-Scoped Database Operations ────────────────────────────────────────

/**
 * Fetch all chat templates for a tenant, automatically seeding defaults if none exist.
 */
export async function getTenantTemplates(tenantId: string) {
  let templates = await prisma.chatTemplate.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  if (templates.length === 0) {
    await seedDefaultSportsTemplates(tenantId);
    templates = await prisma.chatTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
  }

  return templates;
}

/**
 * Find template by slash command (case-insensitive, e.g. "booking" or "/booking")
 */
export async function getTemplateByCommand(tenantId: string, rawCommand: string) {
  const cleanCmd = rawCommand.trim().toLowerCase().replace(/^\//, "");
  return prisma.chatTemplate.findFirst({
    where: {
      tenantId,
      command: cleanCmd,
    },
  });
}

/**
 * Create a new template and automatically generate its Google Sheet tab.
 */
export async function createTemplate(
  tenantId: string,
  input: TemplateInput,
  createSheet = true
) {
  const cleanCmd = input.command.trim().toLowerCase().replace(/^\//, "");

  // Check if command already exists for tenant
  const existing = await prisma.chatTemplate.findFirst({
    where: { tenantId, command: cleanCmd },
  });

  if (existing) {
    throw new Error(`A template with command "/${cleanCmd}" already exists.`);
  }

  const promptMessage =
    input.promptMessage ||
    buildTemplatePromptMessage({
      command: cleanCmd,
      name: input.name,
      icon: input.icon,
      fields: input.fields,
      description: input.description,
    });

  const template = await prisma.chatTemplate.create({
    data: {
      tenantId,
      command: cleanCmd,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sheetName: input.sheetName.trim(),
      icon: input.icon?.trim() || "📋",
      fields: input.fields as any,
      promptMessage,
    },
  });

  // Automatically create Google Sheet tab if configured
  if (createSheet) {
    const sheetConn = await prisma.sheetConnection.findFirst({ where: { tenantId } });
    const spreadsheetId = getEffectiveSpreadsheetId(sheetConn?.spreadsheetId);
    if (spreadsheetId) {
      await ensureTemplateSheetTab(spreadsheetId, template.sheetName, input.fields).catch(
        (err) => console.warn("[createTemplate] Non-blocking sheet tab creation error:", err)
      );
    }
  }

  return template;
}

/**
 * Modify an existing template and sync any new columns to the sheet tab.
 */
export async function modifyTemplate(
  tenantId: string,
  command: string,
  updates: Partial<TemplateInput>
) {
  const cleanCmd = command.trim().toLowerCase().replace(/^\//, "");

  const existing = await prisma.chatTemplate.findFirst({
    where: { tenantId, command: cleanCmd },
  });

  if (!existing) {
    throw new Error(`Template "/${cleanCmd}" not found.`);
  }

  const newFields = (updates.fields || existing.fields) as TemplateField[];
  const newName = updates.name || existing.name;
  const newSheetName = updates.sheetName || existing.sheetName;
  const newIcon = updates.icon !== undefined ? updates.icon : existing.icon;
  const newDesc = updates.description !== undefined ? updates.description : existing.description;

  const promptMessage =
    updates.promptMessage ||
    buildTemplatePromptMessage({
      command: cleanCmd,
      name: newName,
      icon: newIcon,
      fields: newFields,
      description: newDesc,
    });

  const updated = await prisma.chatTemplate.update({
    where: { id: existing.id },
    data: {
      name: newName,
      description: newDesc,
      sheetName: newSheetName,
      icon: newIcon,
      fields: newFields as any,
      promptMessage,
    },
  });

  // Sync with Google Sheet tab
  const sheetConn = await prisma.sheetConnection.findFirst({ where: { tenantId } });
  const spreadsheetId = getEffectiveSpreadsheetId(sheetConn?.spreadsheetId);
  if (spreadsheetId) {
    await ensureTemplateSheetTab(spreadsheetId, newSheetName, newFields).catch((err) =>
      console.warn("[modifyTemplate] Non-blocking sheet sync error:", err)
    );
  }

  return updated;
}

/**
 * Delete a template from the database.
 * IMPORTANT: Google Sheet tab and existing data are NEVER deleted.
 */
export async function deleteTemplate(tenantId: string, command: string) {
  const cleanCmd = command.trim().toLowerCase().replace(/^\//, "");

  const existing = await prisma.chatTemplate.findFirst({
    where: { tenantId, command: cleanCmd },
  });

  if (!existing) {
    throw new Error(`Template "/${cleanCmd}" not found.`);
  }

  await prisma.chatTemplate.delete({
    where: { id: existing.id },
  });

  return {
    success: true,
    command: cleanCmd,
    sheetName: existing.sheetName,
    message: `Template "/${cleanCmd}" was deleted. Google Sheet tab "${existing.sheetName}" and its submitted data remain preserved.`,
  };
}

/**
 * Seeds all default sports foundation templates for a tenant idempotently.
 */
export async function seedDefaultSportsTemplates(tenantId: string) {
  const sheetConn = await prisma.sheetConnection.findFirst({ where: { tenantId } });
  const spreadsheetId = getEffectiveSpreadsheetId(sheetConn?.spreadsheetId);

  const results = [];

  for (const tpl of DEFAULT_SPORTS_TEMPLATES) {
    const existing = await prisma.chatTemplate.findFirst({
      where: { tenantId, command: tpl.command },
    });

    if (!existing) {
      const promptMessage = buildTemplatePromptMessage(tpl);
      const created = await prisma.chatTemplate.create({
        data: {
          tenantId,
          command: tpl.command,
          name: tpl.name,
          description: tpl.description,
          sheetName: tpl.sheetName,
          icon: tpl.icon,
          fields: tpl.fields as any,
          promptMessage,
        },
      });

      if (spreadsheetId) {
        await ensureTemplateSheetTab(spreadsheetId, tpl.sheetName, tpl.fields).catch(() => {});
      }

      results.push(created);
    } else {
      results.push(existing);
    }
  }

  return results;
}

// ─── Record Filled Form Submission into Dedicated Google Sheet Tab ─────────────

export async function appendTemplateSubmission(
  tenantId: string,
  templateCommand: string,
  extractedValues: Record<string, string>,
  userMeta: { name?: string; phone?: string; rawMessage?: string },
  conversationId?: string
): Promise<{ success: boolean; sheetName: string; submissionId: string; dbId?: string }> {
  const template = await getTemplateByCommand(tenantId, templateCommand);
  if (!template) {
    throw new Error(`Template "/${templateCommand}" not found`);
  }

  const fields = (template.fields as unknown as TemplateField[]) || [];
  const targetSheetTitle = template.sheetName.trim();
  const submissionId = `SUB-${Date.now().toString(36).toUpperCase()}`;

  // 1. ALWAYS persist in PostgreSQL database first to ensure 100% sync
  const submissionRecord = await prisma.templateSubmission.create({
    data: {
      tenantId,
      conversationId: conversationId || null,
      templateId: template.id,
      templateCommand: template.command,
      sheetName: targetSheetTitle,
      submissionRef: submissionId,
      userName: userMeta.name || null,
      userPhone: userMeta.phone || null,
      data: extractedValues,
      rawMessage: userMeta.rawMessage || null,
      status: "CONFIRMED",
      syncedToSheet: false,
    },
  });

  const sheetConn = await prisma.sheetConnection.findFirst({ where: { tenantId } });
  const spreadsheetId = getEffectiveSpreadsheetId(sheetConn?.spreadsheetId);

  if (!spreadsheetId) {
    console.log(`[templates] No spreadsheet configured. Saved in database (ID: ${submissionId}) for tab "${targetSheetTitle}"`);
    return { success: true, sheetName: targetSheetTitle, submissionId, dbId: submissionRecord.id };
  }

  const sheets = await getGoogleSheetsClient();
  if (!sheets) {
    console.log(`[templates] Google credentials not found. Saved in database (ID: ${submissionId}) for tab "${targetSheetTitle}"`);
    return { success: true, sheetName: targetSheetTitle, submissionId, dbId: submissionRecord.id };
  }

  try {
    // Ensure tab and headers exist
    await ensureTemplateSheetTab(spreadsheetId, targetSheetTitle, fields);

    // Fetch current header row to map order accurately
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${targetSheetTitle}'!1:1`,
    });

    const headers = (headerRes.data.values?.[0] as string[]) || [
      "Submission ID",
      "Timestamp",
      "User Name",
      "User Phone",
      ...fields.map((f) => f.label),
      "Status",
      "Raw Message",
    ];

    const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const rowValues = headers.map((header) => {
      const hLower = header.toLowerCase();
      if (hLower === "submission id") return submissionId;
      if (hLower === "timestamp" || hLower === "date" || hLower === "logged at") return now;
      if (hLower === "user name" || hLower === "sender name") return userMeta.name || "";
      if (hLower === "user phone" || hLower === "phone number") return userMeta.phone || "";
      if (hLower === "status") return "CONFIRMED";
      if (hLower === "raw message") return userMeta.rawMessage || "";

      // Direct match or normalized key match
      if (extractedValues[header] !== undefined) return extractedValues[header];

      const matchedKey = Object.keys(extractedValues).find((k) => {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        const hNorm = header.toLowerCase().replace(/[^a-z0-9]/g, "");
        return kNorm === hNorm || kNorm.includes(hNorm) || hNorm.includes(kNorm);
      });

      return matchedKey ? extractedValues[matchedKey] : "";
    });

    // Append row into Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${targetSheetTitle}'!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowValues],
      },
    });

    // 2. Mark syncedToSheet as true in PostgreSQL
    await prisma.templateSubmission.update({
      where: { id: submissionRecord.id },
      data: { syncedToSheet: true },
    });

    console.log(`[templates] ✅ Appended row into Google Sheet tab "${targetSheetTitle}" & synced in DB (ID: ${submissionId})`);
    return { success: true, sheetName: targetSheetTitle, submissionId, dbId: submissionRecord.id };
  } catch (sheetErr) {
    console.error(`[templates] Error syncing to Google Sheet (saved safely in DB):`, sheetErr);
    return { success: true, sheetName: targetSheetTitle, submissionId, dbId: submissionRecord.id };
  }
}

/**
 * Retrieves all template submissions saved in the PostgreSQL database for a tenant.
 */
export async function getTenantSubmissions(
  tenantId: string,
  options?: {
    templateCommand?: string;
    sheetName?: string;
    limit?: number;
  }
) {
  const limit = options?.limit || 100;
  return prisma.templateSubmission.findMany({
    where: {
      tenantId,
      ...(options?.templateCommand ? { templateCommand: options.templateCommand } : {}),
      ...(options?.sheetName ? { sheetName: options.sheetName } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      template: {
        select: { name: true, command: true, icon: true },
      },
    },
  });
}

/**
 * Re-syncs an individual submission from the database into its dedicated Google Sheet tab.
 */
export async function syncSubmissionToSheet(
  tenantId: string,
  submissionId: string
): Promise<{ success: boolean; error?: string }> {
  const sub = await prisma.templateSubmission.findFirst({
    where: { id: submissionId, tenantId },
    include: { template: true },
  });

  if (!sub) {
    return { success: false, error: "Submission not found" };
  }

  const sheetConn = await prisma.sheetConnection.findFirst({ where: { tenantId } });
  const spreadsheetId = getEffectiveSpreadsheetId(sheetConn?.spreadsheetId);
  if (!spreadsheetId) {
    return { success: false, error: "No Google Spreadsheet connected for this organization" };
  }

  const sheets = await getGoogleSheetsClient();
  if (!sheets) {
    return { success: false, error: "Google Sheets credentials not configured on server" };
  }

  try {
    const targetSheetTitle = sub.sheetName.trim();
    const fields = (sub.template?.fields as unknown as TemplateField[]) || [];

    // Ensure tab exists
    await ensureTemplateSheetTab(spreadsheetId, targetSheetTitle, fields);

    // Fetch headers
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${targetSheetTitle}'!1:1`,
    });

    const headers = (headerRes.data.values?.[0] as string[]) || [
      "Submission ID",
      "Timestamp",
      "User Name",
      "User Phone",
      ...fields.map((f) => f.label),
      "Status",
      "Raw Message",
    ];

    const dataObj = (sub.data as Record<string, string>) || {};
    const formattedDate = new Date(sub.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const rowValues = headers.map((header) => {
      const hLower = header.toLowerCase();
      if (hLower === "submission id") return sub.submissionRef || sub.id;
      if (hLower === "timestamp" || hLower === "date" || hLower === "logged at") return formattedDate;
      if (hLower === "user name" || hLower === "sender name") return sub.userName || "";
      if (hLower === "user phone" || hLower === "phone number") return sub.userPhone || "";
      if (hLower === "status") return sub.status || "CONFIRMED";
      if (hLower === "raw message") return sub.rawMessage || "";

      if (dataObj[header] !== undefined) return dataObj[header];

      const matchedKey = Object.keys(dataObj).find((k) => {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        const hNorm = header.toLowerCase().replace(/[^a-z0-9]/g, "");
        return kNorm === hNorm || kNorm.includes(hNorm) || hNorm.includes(kNorm);
      });

      return matchedKey ? dataObj[matchedKey] : "";
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${targetSheetTitle}'!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowValues],
      },
    });

    await prisma.templateSubmission.update({
      where: { id: sub.id },
      data: { syncedToSheet: true },
    });

    console.log(`[templates] ✅ Successfully synced DB submission ${sub.id} to Google Sheet tab "${targetSheetTitle}"`);
    return { success: true };
  } catch (err: any) {
    console.error(`[templates] Failed to sync submission ${sub.id} to sheet:`, err);
    return { success: false, error: err.message || "Failed to sync to Google Sheet" };
  }
}

/**
 * Re-syncs all pending (syncedToSheet: false) database submissions for a tenant.
 */
export async function syncAllPendingSubmissions(
  tenantId: string
): Promise<{ total: number; synced: number; failed: number }> {
  const pending = await prisma.templateSubmission.findMany({
    where: { tenantId, syncedToSheet: false },
    take: 50,
  });

  let synced = 0;
  let failed = 0;
  for (const item of pending) {
    const res = await syncSubmissionToSheet(tenantId, item.id);
    if (res.success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { total: pending.length, synced, failed };
}


// ─── Intelligent Field Extraction ─────────────────────────────────────────────

/**
 * Extracts key-value fields from user messages using regex and AI fallback.
 */
export async function extractTemplateFields(
  template: { name: string; sheetName: string; fields: any },
  rawText: string
): Promise<Record<string, string>> {
  const fields = (template.fields as TemplateField[]) || [];
  const extracted: Record<string, string> = {};

  // 1. Fast line-by-line regex extraction
  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(?:[•\-*]|\d+\.?)?\s*([A-Za-z0-9\s/_\-()]+?)[:=]\s*(.+)$/);
    if (match) {
      const candidateKey = match[1].trim();
      const val = match[2].trim();
      if (candidateKey && val) {
        extracted[candidateKey] = val;
      }
    }
  }

  // Check how many template fields were captured
  const matchedFieldCount = fields.filter((f) => {
    const fNorm = f.label.toLowerCase().replace(/[^a-z0-9]/g, "");
    return Object.keys(extracted).some((k) => {
      const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      return kNorm === fNorm || kNorm.includes(fNorm) || fNorm.includes(kNorm);
    });
  }).length;

  // 2. If sparse or unstructured message, enhance with Groq AI extraction
  if (matchedFieldCount < Math.min(2, fields.length)) {
    try {
      const groq = await getGroqClient();
      const model = await getGroqModel();

      const fieldDescriptions = fields
        .map((f) => `"${f.label}": string${f.required ? " (required)" : " (optional)"}`)
        .join(", ");

      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a precise data extractor for a sports foundation. Extract the following fields from the user message for template "${template.name}": { ${fieldDescriptions} }. Return only a clean JSON object where keys are the field labels and values are strings. Leave empty string if not found.`,
          },
          {
            role: "user",
            content: rawText,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        for (const [k, v] of Object.entries(parsed)) {
          if (v && String(v).trim() && !extracted[k]) {
            extracted[k] = String(v).trim();
          }
        }
      }
    } catch (err) {
      console.warn("[templates] Groq extraction fallback error (using regex):", err);
    }
  }

  return extracted;
}

// ─── Slash Command Controller ──────────────────────────────────────────────────

export interface SlashCommandContext {
  conversationId: string;
  tenantId: string;
  senderId: string;
  senderRole: string; // "admin" | "user" | "bot"
  senderName: string;
  senderPhone?: string;
  text: string;
}

export interface SlashCommandResult {
  handled: boolean;
  reply?: string;
  kind?: "text" | "tool_result";
  sheetInserted?: boolean;
  sheetName?: string;
  activeTemplate?: string | null;
}

/**
 * Handles slash commands (/create, /modify, /delete, /templates, /<templateName>).
 */
export async function handleSlashCommand(
  ctx: SlashCommandContext
): Promise<SlashCommandResult> {
  const trimmed = ctx.text.trim();
  if (!trimmed.startsWith("/")) {
    return { handled: false };
  }

  const parts = trimmed.split(/\s+/);
  const commandWord = parts[0].substring(1).toLowerCase();
  const restText = trimmed.substring(parts[0].length).trim();
  const isAdmin = ctx.senderRole.toLowerCase() === "admin";

  // ── 1. Admin Command: /create ───────────────────────────────────────────────
  if (commandWord === "create") {
    if (!isAdmin) {
      return {
        handled: true,
        reply: `⛔ *Admin Access Required*\n\nThe \`/create\` command is restricted to Foundation Administrators.\nOnly Admins can create new templates and Google Sheet tabs.`,
      };
    }

    if (!restText || !restText.includes("|")) {
      return {
        handled: true,
        reply: `🛠️ *Admin Template Creator*\n\nTo create a new chat template and automatically generate its Google Sheet tab, use this format:\n\n\`/create <command> | <Sheet Tab Name> | <Field 1, Field 2, Field 3...>\`\n\n*Example:*\n\`/create physio | Physio Bookings | Athlete Name, Sport, Injury Description, Preferred Date\`\n\n💡 *Tip:* You can also create templates visually with the drag-and-drop builder in the **Admin Portal**!`,
      };
    }

    try {
      const segments = restText.split("|").map((s) => s.trim());
      const cmd = segments[0].toLowerCase().replace(/^\//, "");
      const sheetName = segments[1] || `${cmd.charAt(0).toUpperCase() + cmd.slice(1)} Records`;
      const rawFields = segments[2] ? segments[2].split(",").map((f) => f.trim()).filter(Boolean) : [];

      if (!cmd) {
        return {
          handled: true,
          reply: `⚠️ Please specify a valid command name, e.g. \`/create physio | Physio Bookings | Athlete Name, Sport\``,
        };
      }

      const fields: TemplateField[] = rawFields.length > 0
        ? rawFields.map((f) => ({
            key: f.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            label: f,
            required: true,
            type: "text",
          }))
        : [
            { key: "full_name", label: "Full Name", required: true, type: "text" },
            { key: "contact_number", label: "Contact Number", required: true, type: "phone" },
            { key: "details", label: "Details / Request", required: true, type: "text" },
          ];

      const template = await createTemplate(
        ctx.tenantId,
        {
          command: cmd,
          name: `${cmd.charAt(0).toUpperCase() + cmd.slice(1)} Template`,
          sheetName,
          icon: "⚡",
          fields,
        },
        true
      );

      return {
        handled: true,
        reply: `✅ *New Template & Google Sheet Tab Created!*\n\n• Command: **/${template.command}**\n• Name: **${template.name}**\n• Google Sheet Tab: **"${template.sheetName}"**\n• Columns: ${fields.map((f) => `\`${f.label}\``).join(", ")}\n\nAthletes and members can now type **/${template.command}** in any chat to load this form and record data directly into the sheet!`,
        sheetInserted: true,
        sheetName: template.sheetName,
      };
    } catch (err: any) {
      return {
        handled: true,
        reply: `❌ *Failed to Create Template*\n${err.message || "An error occurred while creating the template."}`,
      };
    }
  }

  // ── 2. Admin Command: /modify ───────────────────────────────────────────────
  if (commandWord === "modify") {
    if (!isAdmin) {
      return {
        handled: true,
        reply: `⛔ *Admin Access Required*\n\nThe \`/modify\` command is restricted to Foundation Administrators.`,
      };
    }

    if (!restText || !restText.includes("|")) {
      return {
        handled: true,
        reply: `✏️ *Admin Template Modifier*\n\nTo add or modify fields in an existing template, use:\n\n\`/modify <command> | <Field 1, Field 2, Field 3...>\`\n\n*Example:*\n\`/modify booking | Full Name, Phone Number, Sport, Booking Date, Time Slot, Duration, Advance Paid\`\n\nAny newly added fields will be automatically synchronized to row 1 of the Google Sheet tab.`,
      };
    }

    try {
      const segments = restText.split("|").map((s) => s.trim());
      const cmd = segments[0].toLowerCase().replace(/^\//, "");
      const rawFields = segments[1] ? segments[1].split(",").map((f) => f.trim()).filter(Boolean) : [];

      if (!cmd || rawFields.length === 0) {
        return {
          handled: true,
          reply: `⚠️ Please provide a valid command and list of fields, e.g.:\n\`/modify booking | Full Name, Phone, Sport, Date, Slot, Advance Paid\``,
        };
      }

      const fields: TemplateField[] = rawFields.map((f) => ({
        key: f.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: f,
        required: true,
        type: "text",
      }));

      const updated = await modifyTemplate(ctx.tenantId, cmd, { fields });

      return {
        handled: true,
        reply: `✅ *Template "/${cmd}" Updated!*\n\n• Google Sheet Tab: **"${updated.sheetName}"**\n• Synchronized Columns: ${fields.map((f) => `\`${f.label}\``).join(", ")}\n\nRow 1 of the Google Sheet has been updated with any new headers.`,
      };
    } catch (err: any) {
      return {
        handled: true,
        reply: `❌ *Modification Failed*\n${err.message || "Template not found or error updating."}`,
      };
    }
  }

  // ── 3. Admin Command: /delete ───────────────────────────────────────────────
  if (commandWord === "delete") {
    if (!isAdmin) {
      return {
        handled: true,
        reply: `⛔ *Admin Access Required*\n\nThe \`/delete\` command is restricted to Foundation Administrators.`,
      };
    }

    if (!restText) {
      return {
        handled: true,
        reply: `🗑️ *Admin Template Deletion*\n\nTo delete a template shortcut from chat, use:\n\n\`/delete <command>\`\n\n*Example:*\n\`/delete physio\`\n\n🛡️ *Safety Guarantee:* Deleting a template removes the chat trigger only. Your Google Sheet tab and all previously submitted data are **never deleted**.`,
      };
    }

    try {
      const cmd = restText.trim().toLowerCase().replace(/^\//, "");
      const res = await deleteTemplate(ctx.tenantId, cmd);

      return {
        handled: true,
        reply: `🗑️ *Template "/${cmd}" Deleted*\n\nThe chat shortcut has been removed.\n\n🛡️ *Google Sheet Preserved:* Sheet tab **"${res.sheetName}"** and all previous records remain completely intact and safe.`,
      };
    } catch (err: any) {
      return {
        handled: true,
        reply: `❌ *Delete Failed*\n${err.message || "Template not found."}`,
      };
    }
  }

  // ── 4. General Commands: /templates or /help ─────────────────────────────────
  if (commandWord === "templates" || commandWord === "help") {
    const templates = await getTenantTemplates(ctx.tenantId);

    const list = templates
      .map(
        (t) =>
          `${t.icon || "📋"} **/${t.command}** — *${t.name}*\n   ↳ Sheet: \`${t.sheetName}\`${t.description ? ` (${t.description})` : ""}`
      )
      .join("\n\n");

    const adminNote = isAdmin
      ? `\n\n🛠️ *Admin Controls:*\n• \`/create <cmd> | <Sheet> | <Fields>\` to create a template & sheet\n• \`/modify <cmd> | <Fields>\` to update columns\n• \`/delete <cmd>\` to delete a template (Google Sheet data is preserved)`
      : "";

    return {
      handled: true,
      reply: `📋 *OFA Sports Foundation — Available Templates*\n\nType or tap any command below to load its structured form:\n\n${list}${adminNote}`,
    };
  }

  // ── 5. User Invokes a Template Command (e.g. /booking, /membership) ──────────
  const template = await getTemplateByCommand(ctx.tenantId, commandWord);
  if (template) {
    // Check if user provided the values immediately on the same line
    // e.g. /booking Name: Rahul, Sport: Badminton, Date: Tomorrow
    if (restText.length > 5 && (restText.includes(":") || restText.includes(","))) {
      try {
        const extracted = await extractTemplateFields(template, restText);
        const result = await appendTemplateSubmission(
          ctx.tenantId,
          template.command,
          extracted,
          {
            name: ctx.senderName,
            phone: ctx.senderPhone,
            rawMessage: trimmed,
          }
        );

        const summary = Object.entries(extracted)
          .filter(([_, v]) => v && v.trim())
          .map(([k, v]) => `• **${k}:** *${v}*`)
          .join("\n");

        return {
          handled: true,
          kind: "tool_result",
          sheetInserted: true,
          sheetName: result.sheetName,
          reply: `✅ *${template.name} Confirmed!*\n\nYour details have been recorded into the **${result.sheetName}** Google Sheet:\n\n${summary || `• Logged by: *${ctx.senderName}*`}\n\n🎫 *Ref ID:* \`${result.submissionId}\`\nLet us know if you need anything else!`,
          activeTemplate: null,
        };
      } catch (err: any) {
        console.error("[handleSlashCommand] Immediate submission error:", err);
      }
    }

    // User simply typed /<command> without data -> Present template form
    return {
      handled: true,
      reply: template.promptMessage,
      activeTemplate: template.command,
    };
  }

  return { handled: false };
}

/**
 * Checks if the conversation has an active template expecting a response.
 */
export async function handleActiveTemplateReply(
  conversationId: string,
  tenantId: string,
  userText: string,
  senderUser: { name?: string; phone?: string }
): Promise<SlashCommandResult | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  const metadata = (conversation?.metadata as Record<string, any>) || {};
  const activeTemplateCmd = metadata.activeTemplate;

  if (!activeTemplateCmd) {
    return null;
  }

  const template = await getTemplateByCommand(tenantId, activeTemplateCmd);
  if (!template) {
    // Clear invalid state
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, activeTemplate: null } },
    });
    return null;
  }

  try {
    const extracted = await extractTemplateFields(template, userText);
    const result = await appendTemplateSubmission(
      tenantId,
      template.command,
      extracted,
      {
        name: senderUser.name,
        phone: senderUser.phone,
        rawMessage: userText,
      }
    );

    // Clear active template from conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, activeTemplate: null } },
    });

    const summary = Object.entries(extracted)
      .filter(([_, v]) => v && v.trim())
      .map(([k, v]) => `• **${k}:** *${v}*`)
      .join("\n");

    return {
      handled: true,
      kind: "tool_result",
      sheetInserted: true,
      sheetName: result.sheetName,
      reply: `✅ *${template.name} Recorded!*\n\nYour submission was logged into the **${result.sheetName}** Google Sheet:\n\n${summary || `• Submission recorded for: *${senderUser.name || "Member"}*`}\n\n🎫 *Ref ID:* \`${result.submissionId}\`\nFeel free to ask if you have any questions!`,
      activeTemplate: null,
    };
  } catch (err: any) {
    console.error("[handleActiveTemplateReply] Error submitting:", err);
    return null;
  }
}
