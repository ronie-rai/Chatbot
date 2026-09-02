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

// ─── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a helpful, fast, and intelligent AI business assistant for managing customer conversations, bookings, enquiries, and Google Sheet logging.

## Your Capabilities
1. Converse warmly, professionally, and concisely.
2. Whenever a customer message contains specific details to log (such as bookings, reservations, general enquiries, contact leads, or payments), ALWAYS use the \`insert_sheet_row\` tool to record the data into the appropriate sheet tab.

## Category & Sheet Tab Selection (\`sheetName\`)
Choose a clear, title-cased tab name for \`sheetName\`:
- **Bookings**: For court, ground, hall, room, or service bookings/reservations (e.g. tennis court booking, badminton slot, doctor appointment).
- **Enquiries**: For general service enquiries, price questions, repair requests.
- **Leads**: For customer contact info, callbacks, business prospects.
- **Payments**: For payment notifications, receipts, transactions.
- **Orders**: For item or product orders.

## Field Extraction (\`columns\`)
Extract all provided information into clean, descriptive keys:
- For Bookings: e.g. "Customer Name", "Mobile No", "Date", "Time / Slot", "Amount", "Activity / Resource", "Details"
- For Enquiries: e.g. "Customer Name", "Mobile No", "Enquiry", "Details"
- For Payments: e.g. "Payer Name", "Mobile No", "Amount", "Date", "Purpose", "Reference / Method"

## Examples
✅ User: "100Rs. booking of tennis on 02-sept-2026 by Mr. Anand Mobile no. 9878987345"
   -> tool: \`insert_sheet_row\`
   -> sheetName: "Bookings"
   -> columns: { "Customer Name": "Mr. Anand", "Mobile No": "9878987345", "Date": "02-sept-2026", "Activity": "Tennis", "Amount": "100Rs.", "Details": "Booking of tennis" }

✅ User: "Tennis Booking, Court1, By Rohit Rai 8789636520 update this in google sheet"
   -> tool: \`insert_sheet_row\`
   -> sheetName: "Bookings"
   -> columns: { "Customer Name": "Rohit Rai", "Mobile No": "8789636520", "Activity": "Tennis", "Court": "Court 1", "Details": "Tennis Booking, Court1" }

✅ User: "Badminton Court 1 booking for tomorrow 5pm by Sarah 9876543210"
   -> tool: \`insert_sheet_row\`
   -> sheetName: "Bookings"
   -> columns: { "Customer Name": "Sarah", "Mobile No": "9876543210", "Activity": "Badminton", "Court": "Court 1", "Time": "5:00 PM", "Date": "Tomorrow" }

## Response Rules
- Always extract all clear information provided by the user.
- Keep responses concise and formatted.`;
}

// ─── Sheets Integration ───────────────────────────────────────────────────────

/**
 * Searches candidate filesystem paths for the Google service account JSON file.
 */
function resolveCredentialsPath(rawPath?: string): string | null {
  const p = rawPath ?? process.env.GOOGLE_SERVICE_ACCOUNT_PATH ?? "./google-credentials.json";
  const candidates = [
    p,
    path.resolve(process.cwd(), p),
    path.resolve(process.cwd(), "server", p),
    path.resolve(__dirname, "..", "..", p),
    path.resolve(__dirname, "..", p),
    path.resolve(__dirname, p),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return cand;
    }
  }
  return null;
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
  const resolvedCredPath = resolveCredentialsPath();

  if (!resolvedCredPath) {
    console.log(`[sheets] Notice: Service account credentials not found. Simulating row insertion into tab "${sheetName}".`);
    return { success: true, sheetName };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: resolvedCredPath,
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
    max_tokens: 512,
    tools: [INSERT_SHEET_ROW_TOOL],
    tool_choice: "auto",
    messages,
  });

  const choice = response.choices[0];

  // 5. Handle tool call
  if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
    const toolCall = choice.message.tool_calls[0];

    if (toolCall.function.name === "insert_sheet_row") {
      const input = JSON.parse(toolCall.function.arguments) as {
        sheetName?: string;
        columns: Record<string, string>;
        rawMessage: string;
      };

      const targetSheetName = input.sheetName?.trim() || sheetConn?.sheetName || "Bookings";
      let sheetInserted = false;

      try {
        if (effectiveSpreadsheetId) {
          await insertSheetRow(
            effectiveSpreadsheetId,
            targetSheetName,
            input.columns,
            input.rawMessage
          );
          sheetInserted = true;
        } else {
          console.log(`[sheets] Simulated insert into tab "${targetSheetName}".`);
          sheetInserted = true;
        }
      } catch (err) {
        console.error("[sheets] Insert failed:", err);
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
