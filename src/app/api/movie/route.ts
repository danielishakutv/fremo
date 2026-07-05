import { NextRequest, NextResponse } from "next/server";
import { getMovieDetail } from "@/lib/scrape";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const url = (searchParams.get("url") || "").trim().slice(0, 400);
  if (!/^https:\/\//i.test(url)) return NextResponse.json({ error: "url required" }, { status: 400 });
  try {
    const movie = await getMovieDetail(url);
    return NextResponse.json({ movie }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load movie" }, { status: 502 });
  }
}
