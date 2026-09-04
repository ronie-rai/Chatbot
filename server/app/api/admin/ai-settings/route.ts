import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";
import { verifyAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const [dbApiKey, dbModel, dbPrompt] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "GROQ_API_KEY" } }),
      prisma.systemSetting.findUnique({ where: { key: "GROQ_MODEL" } }),
      prisma.systemSetting.findUnique({ where: { key: "SYSTEM_PROMPT" } }),
    ]);

    const effectiveApiKey = dbApiKey?.value || process.env.GROQ_API_KEY || "";
    const effectiveModel = dbModel?.value || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const effectivePrompt =
      dbPrompt?.value ||
      "You are OFA AI, the dedicated intelligent business assistant for OFA Sports. Help customers with court bookings, coaching, events, and sports inquiries.";

    const maskedApiKey =
      effectiveApiKey.length > 8
        ? `${effectiveApiKey.slice(0, 4)}••••••••${effectiveApiKey.slice(-4)}`
        : effectiveApiKey ? "••••••••" : "";

    return NextResponse.json({
      ok: true,
      data: {
        hasApiKey: Boolean(effectiveApiKey),
        maskedApiKey,
        model: effectiveModel,
        systemPrompt: effectivePrompt,
        availableModels: [
          "openai/gpt-oss-120b",
          "llama-3.3-70b-versatile",
          "llama-3.1-8b-instant",
          "mixtral-8x7b-32768",
        ],
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/ai-settings]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch AI settings" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { apiKey, model, systemPrompt, testConnection } = body as {
      apiKey?: string;
      model?: string;
      systemPrompt?: string;
      testConnection?: boolean;
    };

    const trimmedKey = apiKey?.trim();
    const currentKeySetting = await prisma.systemSetting.findUnique({ where: { key: "GROQ_API_KEY" } });
    const effectiveKey = (trimmedKey && !trimmedKey.includes("•••"))
      ? trimmedKey
      : currentKeySetting?.value || process.env.GROQ_API_KEY || "";

    const selectedModel = model?.trim() || "openai/gpt-oss-120b";

    // If test connection requested
    if (testConnection) {
      if (!effectiveKey) {
        return NextResponse.json(
          { ok: false, error: { code: "NO_KEY", message: "Please provide a valid Groq API key to test" } },
          { status: 400 }
        );
      }

      try {
        const testGroq = new Groq({ apiKey: effectiveKey });
        const completion = await testGroq.chat.completions.create({
          model: selectedModel,
          messages: [{ role: "user", content: "Ping: respond with 'PONG'" }],
          max_tokens: 10,
        });

        const reply = completion.choices[0]?.message?.content ?? "";
        return NextResponse.json({
          ok: true,
          message: `Connection successful! Model replied: "${reply.trim()}"`,
        });
      } catch (testErr: unknown) {
        const errMsg = testErr instanceof Error ? testErr.message : "Connection failed";
        return NextResponse.json(
          { ok: false, error: { code: "TEST_FAILED", message: errMsg } },
          { status: 400 }
        );
      }
    }

    // Save settings
    const operations = [];

    if (trimmedKey && !trimmedKey.includes("•••")) {
      operations.push(
        prisma.systemSetting.upsert({
          where: { key: "GROQ_API_KEY" },
          update: { value: trimmedKey },
          create: { key: "GROQ_API_KEY", value: trimmedKey },
        })
      );
    }

    if (model?.trim()) {
      operations.push(
        prisma.systemSetting.upsert({
          where: { key: "GROQ_MODEL" },
          update: { value: model.trim() },
          create: { key: "GROQ_MODEL", value: model.trim() },
        })
      );
    }

    if (systemPrompt !== undefined) {
      operations.push(
        prisma.systemSetting.upsert({
          where: { key: "SYSTEM_PROMPT" },
          update: { value: systemPrompt.trim() },
          create: { key: "SYSTEM_PROMPT", value: systemPrompt.trim() },
        })
      );
    }

    await Promise.all(operations);

    return NextResponse.json({
      ok: true,
      message: "Common AI Agent settings updated successfully across all organizations",
    });
  } catch (error) {
    console.error("[POST /api/admin/ai-settings]", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to update AI settings" } },
      { status: 500 }
    );
  }
}
