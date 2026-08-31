import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
    phase: "Phase 0 — Scaffolding",
  });
}
