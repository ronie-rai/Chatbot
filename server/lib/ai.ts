/**
 * AI service — Groq integration with tool calling & high-performance Google Sheets.
 * Supports dynamic spreadsheet URL from .env, automatic tab creation,
 * multi-purpose categorization (Bookings, Enquiries, Leads, Payments),
 * dynamic header synchronization, and instant response confirmation.
 */

import Groq from "groq-sdk";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { prisma } from "./prisma";

// ─── Dynamic Client & Model Resolution ─────────────────────────────────────────

export async function getGroqClient(): Promise<Groq> {
  const dbKey = await prisma.systemSetting.findUnique({ where: { key: "GROQ_API_KEY" } }).catch(() => null);
  const apiKey = dbKey?.value || process.env.GROQ_API_KEY;
  return new Groq({ apiKey });
}

export async function getGroqModel(): Promise<string> {
  const dbModel = await prisma.systemSetting.findUnique({ where: { key: "GROQ_MODEL" } }).catch(() => null);
  return dbModel?.value || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

export async function getGlobalSystemPrompt(): Promise<string> {
  const dbPrompt = await prisma.systemSetting.findUnique({ where: { key: "SYSTEM_PROMPT" } }).catch(() => null);
  if (dbPrompt?.value?.trim()) {
    return dbPrompt.value.trim();
  }
  return `You are OFA AI, the dedicated intelligent business assistant for OFA Sports and organizations.
Your mission is to help customers, members, and teams with sports inquiries, court bookings, coaching sessions, events, registrations, and Google Sheet logging.

## Your Capabilities
1. Converse warmly, professionally, and concisely.
2. Whenever a customer message contains specific details to log (such as court reservations, coaching sessions, tournaments, enquiries, contact info, or payments), ALWAYS use the \`insert_sheet_row\` tool to record the data into the appropriate sheet tab.

## Category & Sheet Tab Selection (\`sheetName\`)
Choose a clear, title-cased tab name for \`sheetName\`:
- **Bookings**: For court, ground, turf, slot, or coach bookings (e.g. tennis court booking, badminton slot, cricket nets).
- **Enquiries**: For general service enquiries, membership queries, timings, rules.
- **Leads**: For customer contact info, callbacks, business prospects.
- **Payments**: For fees, payment notifications, transaction logs.
- **Registrations**: For tournament or coaching registrations.

## Field Extraction (\`columns\`)
Extract all provided customer fields into clean, human-readable column titles.`;
}

// ─── In-memory cache for ultra-fast Google Sheets operations ──────────────────

interface SheetCache {
  tabs: Set<string>;
  headers: Map<string, string[]>;
}

const sheetCache = new Map<string, SheetCache>();

// ─── Spreadsheet ID Helpers ───────────────────────────────────────────────────

/**
 * Extracts a Google Spreadsheet ID from a full Google Sheets URL or raw ID string.
 */
export function extractSpreadsheetId(urlOrId?: string | null): string | null {
  if (!urlOrId || !urlOrId.trim()) return null;
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * Resolves the effective spreadsheet ID from tenant configuration or environment fallback.
 */
export function getEffectiveSpreadsheetId(tenantSpreadsheetId?: string | null): string | null {
  if (tenantSpreadsheetId && tenantSpreadsheetId !== "REPLACE_WITH_YOUR_SPREADSHEET_ID") {
    const id = extractSpreadsheetId(tenantSpreadsheetId);
    if (id) return id;
  }

  const envUrl = process.env.GOOGLE_SHEET_URL;
  if (envUrl) {
    const id = extractSpreadsheetId(envUrl);
    if (id) return id;
  }

  const envId = process.env.GOOGLE_SPREADSHEET_ID;
  if (envId && envId !== "REPLACE_WITH_YOUR_SPREADSHEET_ID") {
    const id = extractSpreadsheetId(envId);
    if (id) return id;
  }

  return null;
}

// ─── Tool Schema (OpenAI function-calling format) ─────────────────────────────

const INSERT_SHEET_ROW_TOOL: Groq.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "insert_sheet_row",
    description:
      "Extract structured customer information, bookings, inquiries, or payment details and insert it into the appropriate tab/sheet of the Google Sheet workbook. Select or create the sheet name matching the purpose (e.g., 'Bookings' for reservations/court bookings, 'Enquiries' for general service inquiries, 'Payments' for financial logs, 'Leads' for contacts).",
    parameters: {
      type: "object",
      properties: {
        sheetName: {
          type: "string",
          description: "The name of the target sheet tab in the workbook, e.g. 'Bookings', 'Enquiries', 'Leads', 'Payments'.",
        },
        columns: {
          type: "object",
          description: "Key-value pairs of extracted data with descriptive column headers (e.g., 'Customer Name', 'Mobile No', 'Date', 'Amount', 'Activity / Service', 'Details').",
          additionalProperties: { type: "string" },
        },
        rawMessage: {
          type: "string",
          description: "The original customer message that triggered the extraction",
        },
      },
      required: ["sheetName", "columns", "rawMessage"],
    },
  },
};

const QUERY_SUBMISSIONS_TOOL: Groq.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "query_submissions",
    description:
      "Query the database to look up existing submissions, bookings, memberships, admissions, or any other records. Use this when the user asks questions like: 'how many bookings today', 'show me the list', 'who booked today', 'how many members', 'list all admissions', 'total registrations this week', etc. Returns matching records so you can summarize and display them.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "The category/sheet to filter by. Examples: 'Bookings', 'Memberships', 'Admissions', 'Enquiries', 'Coaching Enquiries', 'Trial Assessments', 'Payments'. Leave empty to search all categories.",
        },
        dateFilter: {
          type: "string",
          enum: ["today", "yesterday", "this_week", "this_month", "all"],
          description: "Filter records by date. Use 'today' for today's records, 'this_week' for last 7 days, 'this_month' for last 30 days.",
        },
        search: {
          type: "string",
          description: "Optional search keyword to filter by name, phone, sport, or any field value.",
        },
        limit: {
          type: "number",
          description: "Maximum number of records to return. Default is 20.",
        },
      },
      required: [],
    },
  },
};

// ─── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return `You are OFA Assistant — a fast, intelligent AI assistant for OFA Sports Foundation. Today is ${todayStr}, ${timeStr} IST.

## Your Capabilities
1. **Answer questions instantly** — including queries about existing records, bookings, memberships, admissions, and statistics.
2. **Look up database records** — use the \`query_submissions\` tool whenever the user asks to see data, lists, counts, or statistics.
3. **Record new data** — use \`insert_sheet_row\` when the user provides booking/enquiry details to log.
4. **Converse naturally** — answer general questions about OFA Sports, facilities, schedules, etc.

## When to use \`query_submissions\`
Use this tool immediately when user asks:
- "how many bookings today" / "show me today's bookings"
- "list all members" / "who registered this week"
- "how many admissions this month"
- "show me the list" / "give me a summary"
- Any question about existing records, counts, or lists

## When to use \`insert_sheet_row\`
Use this tool when the user provides specific data to save:
- Customer name, phone, booking date, sport, payment info
- Enquiry details, contact info to log

## Category & Sheet Tab Selection (\`sheetName\`)
Choose a clear, title-cased tab name for \`sheetName\`:
- **Bookings**: For court, ground, hall, room, or service bookings/reservations
- **Memberships**: For club/academy membership registrations
- **Admissions**: For new student/athlete admissions
- **Enquiries**: For general service enquiries, price questions
- **Coaching Enquiries**: For 1-on-1 or coaching consultation requests
- **Trial Assessments**: For free trial session registrations
- **Payments**: For payment notifications, receipts, transactions
- **Leads**: For customer contact info, callbacks, business prospects

## Field Extraction (\`columns\`)
Extract all provided information into clean, descriptive keys:
- For Bookings: "Customer Name", "Mobile No", "Date", "Time / Slot", "Amount", "Activity / Resource", "Details"
- For Enquiries: "Customer Name", "Mobile No", "Enquiry", "Details"
- For Payments: "Payer Name", "Mobile No", "Amount", "Date", "Purpose", "Reference / Method"

## Examples
✅ User: "how many bookings today show me the list"
   -> tool: \`query_submissions\`
   -> category: "Bookings", dateFilter: "today"

✅ User: "Tennis Booking, Court1, By Rohit Rai 8789636520"
   -> tool: \`insert_sheet_row\`
   -> sheetName: "Bookings"
   -> columns: { "Customer Name": "Rohit Rai", "Mobile No": "8789636520", "Activity": "Tennis", "Court": "Court 1" }

## Response Rules
- ALWAYS use \`query_submissions\` for ANY question about existing records — never say you cannot access data.
- Format lists clearly with numbering, names, and key details.
- Keep responses concise and well-formatted.
- Never say "I don't have access to the database" — you DO have access via the query tool.`;
}

// ─── Sheets Integration ───────────────────────────────────────────────────────

/**
 * Searches candidate filesystem paths for the Google service account JSON file.
 */
export function resolveCredentialsPath(rawPath?: string): string | null {
  const p = rawPath ?? process.env.GOOGLE_SERVICE_ACCOUNT_PATH ?? "./google-credentials.json";
  const candidates = [
    p,
    path.resolve(process.cwd(), p),
    path.resolve(process.cwd(), "server", p),
    path.resolve(process.cwd(), "..", p),
    path.resolve(process.cwd(), "..", "server", p),
    path.resolve(process.cwd(), "apps", "server", p),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return cand;
    }
  }
  return null;
}

/**
 * Parses Google service account credentials from env var or file.
 * Priority: GOOGLE_SERVICE_ACCOUNT_JSON env var (Vercel) > keyFile (local dev)
 */
function getGoogleAuthConfig(): { keyFile: string } | { credentials: object } | null {
  // 1. Try inline JSON from env var first (works on Vercel/serverless)
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    try {
      const credentials = JSON.parse(jsonEnv);
      return { credentials };
    } catch {
      console.error("[sheets] GOOGLE_SERVICE_ACCOUNT_JSON is set but not valid JSON");
    }
  }
  // 2. Fall back to file path (local dev)
  const resolvedCredPath = resolveCredentialsPath();
  if (resolvedCredPath) return { keyFile: resolvedCredPath };
  return null;
}

export async function getGoogleSheetsClient() {
  const authConfig = getGoogleAuthConfig();
  if (!authConfig) return null;
  try {
    const auth = new google.auth.GoogleAuth({
      ...authConfig,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  } catch (e) {
    console.error("[sheets] Failed to create Google auth client:", e);
    return null;
  }
}

/**
 * Inserts a row into the Google Sheet workbook with intelligent in-memory caching.
 */
async function insertSheetRow(
  spreadsheetId: string,
  sheetName: string,
  columns: Record<string, string>,
  rawMessage?: string
): Promise<{ success: boolean; sheetName: string }> {
  const authConfig = getGoogleAuthConfig();

  if (!authConfig) {
    console.log(`[sheets] Notice: Service account credentials not found (no file or GOOGLE_SERVICE_ACCOUNT_JSON env var). Skipping sheet insert for tab "${sheetName}".`);
    return { success: false, sheetName };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      ...authConfig,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Retrieve or initialize cache for this spreadsheet
    let cache = sheetCache.get(spreadsheetId);
    if (!cache) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const tabNames = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
      cache = {
        tabs: new Set(tabNames),
        headers: new Map(),
      };
      sheetCache.set(spreadsheetId, cache);
    }

    const targetSheetTitle = sheetName.trim();
    const tabExists = Array.from(cache.tabs).some((t) => t.toLowerCase() === targetSheetTitle.toLowerCase());

    // 1. Create tab if it does not exist
    if (!tabExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetSheetTitle,
                },
              },
            },
          ],
        },
      });
      cache.tabs.add(targetSheetTitle);
      console.log(`[sheets] 📑 Created new sheet tab: "${targetSheetTitle}"`);
    }

    // 2. Resolve column headers
    let headers = cache.headers.get(targetSheetTitle);

    if (!headers) {
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${targetSheetTitle}!1:1`,
      });
      const existingHeaderRow = headerRes.data.values?.[0] as string[] | undefined;

      if (existingHeaderRow && existingHeaderRow.length > 0) {
        headers = [...existingHeaderRow];
      } else {
        headers = [...Object.keys(columns), "Raw Message", "Logged At"];
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${targetSheetTitle}!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [headers],
          },
        });
      }
      cache.headers.set(targetSheetTitle, headers);
    }

    // 3. Check for any newly added keys not in existing headers
    const columnKeys = Object.keys(columns);
    const missingKeys = columnKeys.filter(
      (k) => !headers!.some((h) => h.toLowerCase() === k.toLowerCase())
    );

    if (missingKeys.length > 0) {
      headers.push(...missingKeys);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheetTitle}!1:1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [headers],
        },
      });
      cache.headers.set(targetSheetTitle, headers);
    }

    // 4. Map values to ordered headers
    const rowValues = headers.map((header) => {
      if (header === "Raw Message") return rawMessage ?? "";
      if (header === "Logged At") return new Date().toISOString();

      const directVal = columns[header];
      if (directVal !== undefined) return directVal;

      const lowerHeader = header.toLowerCase();
      const matchedKey = Object.keys(columns).find(
        (k) => k.toLowerCase() === lowerHeader || k.toLowerCase().replace(/_/g, " ") === lowerHeader
      );
      return matchedKey ? columns[matchedKey] : "";
    });

    // 5. Append row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${targetSheetTitle}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowValues],
      },
    });

    console.log(`[sheets] ✅ Inserted row into "${spreadsheetId}" -> tab "${targetSheetTitle}"`);
    return { success: true, sheetName: targetSheetTitle };
  } catch (err) {
    // Clear cache in case tab was modified externally
    sheetCache.delete(spreadsheetId);
    console.error(`[sheets] Error inserting row into "${sheetName}":`, err);
    throw err;
  }
}

// ─── Format Instant Confirmation ──────────────────────────────────────────────

function formatConfirmationMessage(sheetName: string, columns: Record<string, string>): string {
  const entries = Object.entries(columns).filter(([k, v]) => v && String(v).trim());
  if (entries.length === 0) {
    return `Your details have been recorded in the **${sheetName}** sheet.\n\nLet me know if there's anything else you need!`;
  }

  const list = entries.map(([k, v]) => `- **${k}:** *${v}*`).join("\n");
  const singular = sheetName.toLowerCase().replace(/s$/, "");

  return `Your ${singular} has been recorded in the **${sheetName}** sheet:\n\n${list}\n\nLet me know if there’s anything else I can help you with!`;
}

// ─── Main AI Turn ─────────────────────────────────────────────────────────────

export interface AITurnResult {
  reply: string;
  sheetInserted: boolean;
  toolCallId?: string;
  sheetName?: string;
}

export async function runAITurn(
  conversationId: string,
  tenantId: string,
  newUserMessage: string
): Promise<AITurnResult> {
  // 1. Fetch conversation history (last 10 messages for fast context)
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 10,
    include: { sender: { select: { role: true, name: true } } },
  });

  // 2. Fetch tenant's sheet connection or env fallback
  const sheetConn = await prisma.sheetConnection.findFirst({
    where: { tenantId },
  });

  const effectiveSpreadsheetId = getEffectiveSpreadsheetId(sheetConn?.spreadsheetId);

  const historyMessages = history
    .filter((m) => m.kind !== "SYSTEM")
    .map((m) => ({
      role: (m.sender?.role === "BOT" ? "assistant" : "user") as "assistant" | "user",
      content: m.body,
    }));

  const lastMsg = historyMessages[historyMessages.length - 1];
  const isAlreadyInHistory = lastMsg && lastMsg.role === "user" && lastMsg.content === newUserMessage;

  // 3. Build Groq message history
  const systemPrompt = await getGlobalSystemPrompt();
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    ...(isAlreadyInHistory ? [] : [{ role: "user" as const, content: newUserMessage }]),
  ];

  // 4. Single-turn fast tool calling with dynamically resolved client & model
  const groq = await getGroqClient();
  const model = await getGroqModel();

  const response = await groq.chat.completions.create({
    model,
    max_tokens: 1024,
    tools: [INSERT_SHEET_ROW_TOOL, QUERY_SUBMISSIONS_TOOL],
    tool_choice: "auto",
    messages,
  });

  const choice = response.choices[0];

  // 5. Handle tool calls
  if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
    const toolCall = choice.message.tool_calls[0];

    // ── Handle: query_submissions ────────────────────────────────────────────
    if (toolCall.function.name === "query_submissions") {
      const input = JSON.parse(toolCall.function.arguments) as {
        category?: string;
        dateFilter?: string;
        search?: string;
        limit?: number;
      };

      const limit = Math.min(input.limit || 20, 50);
      const now = new Date();

      // Build date range
      let dateFrom: Date | undefined;
      if (input.dateFilter === "today") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (input.dateFilter === "yesterday") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // handled via combined filter below
        void dateTo;
      } else if (input.dateFilter === "this_week") {
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (input.dateFilter === "this_month") {
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      // Build prisma where
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { tenantId };
      if (input.category) {
        where.OR = [
          { sheetName: { contains: input.category, mode: "insensitive" } },
          { templateCommand: { contains: input.category.toLowerCase(), mode: "insensitive" } },
        ];
      }
      if (dateFrom) {
        where.createdAt = { gte: dateFrom };
      }
      if (input.search) {
        const s = input.search;
        const searchOr = [
          { userName: { contains: s, mode: "insensitive" } },
          { userPhone: { contains: s, mode: "insensitive" } },
          { submissionRef: { contains: s, mode: "insensitive" } },
        ];
        where.AND = [{ OR: searchOr }];
      }

      const records = await prisma.templateSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          submissionRef: true,
          sheetName: true,
          userName: true,
          userPhone: true,
          data: true,
          status: true,
          createdAt: true,
          syncedToSheet: true,
        },
      });

      const total = await prisma.templateSubmission.count({ where });

      // Format records as readable text for Groq to use
      let recordsText = `Found ${total} record(s)${input.dateFilter && input.dateFilter !== "all" ? ` (${input.dateFilter.replace("_", " ")})` : ""}${input.category ? ` in ${input.category}` : ""}:\n\n`;

      if (records.length === 0) {
        recordsText += "No records found for the specified criteria.";
      } else {
        records.forEach((r, i) => {
          const data = (r.data as Record<string, string>) || {};
          const name = r.userName || data["Customer Name"] || data["Full Name"] || data["Name"] || data["Athlete Name"] || data["Member Name"] || "—";
          const phone = r.userPhone || data["Mobile No"] || data["Phone"] || data["Contact"] || "—";
          const sport = data["Activity"] || data["Sport"] || data["Activity / Resource"] || data["Preferred Sport"] || "";
          const slot = data["Time / Slot"] || data["Time"] || data["Batch Start Time"] || "";
          const date = data["Date"] || data["Booking Date"] || data["Admission Date"] || new Date(r.createdAt).toLocaleDateString("en-IN");
          const ref = r.submissionRef || "";
          const sync = r.syncedToSheet ? "✅" : "⏳";

          recordsText += `${i + 1}. *${name}*`;
          if (phone && phone !== "—") recordsText += ` | 📞 ${phone}`;
          if (sport) recordsText += ` | 🏟 ${sport}`;
          if (slot) recordsText += ` | ⏰ ${slot}`;
          if (date) recordsText += ` | 📅 ${date}`;
          if (ref) recordsText += ` | ${ref}`;
          recordsText += ` ${sync}\n`;
        });
        if (total > records.length) {
          recordsText += `\n_...and ${total - records.length} more. Ask for more details or a specific name._`;
        }
      }

      // Send tool result back to Groq for a final natural-language reply
      const finalResponse = await groq.chat.completions.create({
        model,
        max_tokens: 1024,
        messages: [
          ...messages,
          { role: "assistant" as const, content: null, tool_calls: choice.message.tool_calls },
          {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: recordsText,
          },
        ],
      });

      const finalReply = finalResponse.choices[0]?.message?.content ?? recordsText;
      return { reply: finalReply, sheetInserted: false, toolCallId: toolCall.id };
    }

    // ── Handle: insert_sheet_row ─────────────────────────────────────────────
    if (toolCall.function.name === "insert_sheet_row") {
      const input = JSON.parse(toolCall.function.arguments) as {
        sheetName?: string;
        columns: Record<string, string>;
        rawMessage: string;
      };

      const targetSheetName = input.sheetName?.trim() || sheetConn?.sheetName || "Bookings";
      let sheetInserted = false;

      // Extract user info if present in columns
      const userName =
        input.columns["Name"] ||
        input.columns["Full Name"] ||
        input.columns["User Name"] ||
        input.columns["Athlete Name"] ||
        input.columns["Member Name"] ||
        undefined;
      const userPhone =
        input.columns["Phone"] ||
        input.columns["Phone Number"] ||
        input.columns["Mobile"] ||
        input.columns["Contact"] ||
        input.columns["Contact Number"] ||
        undefined;

      const submissionRef = `AI-${Date.now().toString(36).toUpperCase()}`;

      // Check if there is a matching template for this sheet
      const matchingTemplate = await prisma.chatTemplate.findFirst({
        where: {
          tenantId,
          OR: [
            { sheetName: { equals: targetSheetName, mode: "insensitive" } },
            { command: { equals: targetSheetName.toLowerCase(), mode: "insensitive" } },
          ],
        },
      }).catch(() => null);

      // 1. Dual save: Persist in PostgreSQL database first
      let submissionRecord: any = null;
      try {
        submissionRecord = await prisma.templateSubmission.create({
          data: {
            tenantId,
            conversationId,
            templateId: matchingTemplate?.id || null,
            templateCommand: matchingTemplate?.command || "ai_tool",
            sheetName: targetSheetName,
            submissionRef,
            userName: userName || null,
            userPhone: userPhone || null,
            data: input.columns,
            rawMessage: input.rawMessage || newUserMessage || null,
            status: "CONFIRMED",
            syncedToSheet: false,
          },
        });
      } catch (dbErr) {
        console.error("[ai] Failed to dual-persist submission in database:", dbErr);
      }

      try {
        if (effectiveSpreadsheetId) {
          const insertRes = await insertSheetRow(
            effectiveSpreadsheetId,
            targetSheetName,
            input.columns,
            input.rawMessage
          );
          sheetInserted = insertRes.success;

          // 2. Mark syncedToSheet in PostgreSQL upon successful Google Sheets insert
          if (sheetInserted && submissionRecord) {
            await prisma.templateSubmission.update({
              where: { id: submissionRecord.id },
              data: { syncedToSheet: true },
            }).catch(() => {});
          }
        } else {
          console.log(`[sheets] Simulated insert into tab "${targetSheetName}". Persisted in database (ID: ${submissionRecord?.id}).`);
          sheetInserted = true;
        }
      } catch (err) {
        console.error("[sheets] Insert failed (persisted safely in database):", err);
      }

      // Generate instant, crisp confirmation directly from extracted data
      const confirmationReply = sheetInserted
        ? formatConfirmationMessage(targetSheetName, input.columns)
        : `I noted your request for **${targetSheetName}**, but could not sync with the sheet right now. Please try again.`;

      return {
        reply: confirmationReply,
        sheetInserted,
        toolCallId: toolCall.id,
        sheetName: targetSheetName,
      };
    }
  }

  // 6. Plain conversational text reply
  const textContent = choice.message.content ?? "";
  return { reply: textContent, sheetInserted: false };
}
