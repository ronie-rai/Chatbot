import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminAuth";
import { getGroqClient } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: auth.error || "Admin authentication required" } },
      { status: 401 }
    );
  }

  // 1. Check PostgreSQL latency
  let dbStatus = "ONLINE";
  let dbLatencyMs = 0;
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbStatus = "OFFLINE";
    dbLatencyMs = -1;
  }

  // 2. Check Socket.io Realtime server
  let realtimeStatus = "OFFLINE";
  let realtimeClients = 0;
  let realtimeLatencyMs = -1;
  const rtStart = Date.now();
  try {
    const rtRes = await fetch("http://localhost:4000/health", { signal: AbortSignal.timeout(3000) });
    if (rtRes.ok) {
      const rtData = await rtRes.json();
      realtimeStatus = "ONLINE";
      realtimeClients = rtData.connections ?? 0;
      realtimeLatencyMs = Date.now() - rtStart;
    }
  } catch {
    realtimeStatus = "OFFLINE";
  }

  // 3. Check Groq AI configuration
  let aiStatus = "CONFIGURED";
  let aiModel = "openai/gpt-oss-120b";
  try {
    const groq = await getGroqClient();
    if (!groq.apiKey) {
      aiStatus = "KEY_MISSING";
    }
  } catch {
    aiStatus = "ERROR";
  }

  return NextResponse.json({
    ok: true,
    data: {
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        database: {
          name: "PostgreSQL (Prisma)",
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        realtime: {
          name: "Socket.io Server (Port 4000)",
          status: realtimeStatus,
          latencyMs: realtimeLatencyMs,
          connectedClients: realtimeClients,
        },
        ai: {
          name: "Groq Cloud API",
          status: aiStatus,
          model: aiModel,
        },
      },
    },
  });
}
