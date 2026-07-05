import { NextRequest, NextResponse } from "next/server";
import { recordView } from "@/lib/analytics";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  recordView(req);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
