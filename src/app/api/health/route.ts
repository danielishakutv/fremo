import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET(req: NextRequest) {
  const blocked = guard(req, { limit: 60, windowMs: 60_000, bucket: "health" });
  if (blocked) return blocked;
  return NextResponse.json(
    { status: "ok", uptime: Math.floor((Date.now() - startedAt) / 1000) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
