import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/analytics";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;
  return NextResponse.json(getStats(), { headers: { "Cache-Control": "no-store" } });
}
