/**
 * AI service — Claude integration with tool calling.
 * Phase 5: Basic AI replies
 * Phase 6: insert_sheet_row tool + Google Sheets integration
 */

import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { prisma } from "./prisma";
import type { Message } from "@chatbot/shared-types";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const MODEL = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-20241022";

// ─── Tool Schema ──────────────────────────────────────────────────────────────

const INSERT_SHEET_ROW_TOOL: Anthropic.Tool = {
  name: "insert_sheet_row",
  description:
    "Extract important customer information from the conversation and insert it as a new row in the tenant's Google Sheet. Use this whenever a customer clearly provides contact details or makes a specific service request.",
  input_schema: {
    type: "object" as const,
    properties: {
      columns: {
        type: "object",
        description: "Key-value pairs where keys are the column names and values are the extracted data",
        additionalProperties: { type: "string" },
      },
      rawMessage: {
        type: "string",
        description: "The original customer message that triggered the extraction",
      },
    },
    required: ["columns", "rawMessage"],
  },
};

// ─── System Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(sheetColumns: Array<{ name: string; label: string; description: string; required: boolean }>): string {
  const columnDescriptions = sheetColumns
    .map((c) => `  - ${c.name} (${c.label}): ${c.description}${c.required ? " [REQUIRED]" : " [optional]"}`)
    .join("\n");

  return `You are a helpful AI assistant for a business. You assist customers with their enquiries and capture their details.

## Your Role
- Be warm, professional, and concise
- Answer questions helpfully
- Capture customer information when clearly provided

## When to Capture Information
Use the insert_sheet_row tool when a customer message clearly contains ALL required fields.

Required fields to capture:
${columnDescriptions}

## Examples of When to Capture
✅ "My name is John Smith, call me on 9876543210, I need a transformer rewound"
✅ "I'm Sarah Lee, phone 8888-9999, want to enquire about motor repair services"

## Examples of When NOT to Capture
❌ "What services do you offer?" (no personal info)
❌ "My name is Mike" (incomplete — no phone or enquiry)
❌ General questions without contact details

## Response Style
- Keep replies brief (2–4 sentences max)
- After capturing info, confirm what was captured in a friendly way
- Use *bold* for key details when confirming
- Always ask for missing required information politely`;
}

// ─── Sheets Integration ───────────────────────────────────────────────────────

async function insertSheetRow(
  spreadsheetId: string,
  sheetName: string,
  columns: Record<string, string>,
  columnDefs: Array<{ name: string; label: string }>
): Promise<void> {
  const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  if (!credPath || credPath === "./google-credentials.json") {
    console.log("[sheets] Skipping — no real credentials configured yet");
    return;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Map column definitions to ordered row values
  const orderedValues = columnDefs.map((col) => columns[col.name] ?? "");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [orderedValues],
    },
  });

  console.log(`[sheets] ✅ Inserted row into ${spreadsheetId}/${sheetName}`);
}

// ─── Main AI Turn ─────────────────────────────────────────────────────────────

export interface AITurnResult {
  reply: string;
  sheetInserted: boolean;
  toolCallId?: string;
}

export async function runAITurn(
  conversationId: string,
  tenantId: string,
  newUserMessage: string
): Promise<AITurnResult> {
  // 1. Fetch conversation history (last 20 messages)
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { sender: { select: { role: true, name: true } } },
  });

  // 2. Fetch tenant's sheet connection for dynamic tool schema
  const sheetConn = await prisma.sheetConnection.findFirst({
    where: { tenantId },
  });

  const columnDefs = (sheetConn?.columns ?? []) as Array<{
    name: string;
    label: string;
    description: string;
    required: boolean;
  }>;

  // 3. Build Claude message history
  const claudeMessages: Anthropic.MessageParam[] = history
    .filter((m) => m.kind !== "SYSTEM")
    .map((m) => ({
      role: m.sender?.role === "BOT" ? ("assistant" as const) : ("user" as const),
      content: m.body,
    }));

  // Add the new user message
  claudeMessages.push({ role: "user", content: newUserMessage });

  // 4. First Claude call
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(columnDefs),
    tools: sheetConn ? [INSERT_SHEET_ROW_TOOL] : [],
    messages: claudeMessages,
  });

  // 5. Handle tool use
  if (response.stop_reason === "tool_use") {
    const toolUseBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (toolUseBlock && toolUseBlock.name === "insert_sheet_row" && sheetConn) {
      const input = toolUseBlock.input as { columns: Record<string, string>; rawMessage: string };

      let sheetInserted = false;
      let toolResultContent = "";

      try {
        await insertSheetRow(
          sheetConn.spreadsheetId,
          sheetConn.sheetName,
          input.columns,
          columnDefs
        );
        sheetInserted = true;
        toolResultContent = JSON.stringify({
          success: true,
          message: "Row inserted successfully",
          insertedData: input.columns,
        });
      } catch (err) {
        toolResultContent = JSON.stringify({
          success: false,
          error: (err as Error).message,
        });
      }

      // 6. Second Claude call with tool result
      const followUp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: buildSystemPrompt(columnDefs),
        tools: [INSERT_SHEET_ROW_TOOL],
        messages: [
          ...claudeMessages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: toolResultContent,
              },
            ],
          },
        ],
      });

      const finalText = followUp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return { reply: finalText, sheetInserted, toolCallId: toolUseBlock.id };
    }
  }

  // 6b. No tool use — plain text reply
  const textContent = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { reply: textContent, sheetInserted: false };
}
