import { NextRequest, NextResponse } from "next/server";
import { searchMovies } from "@/lib/scrape";
import { guard, clampParam } from "@/lib/security";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const q = clampParam(searchParams.get("q"), 80);
  const page = Math.min(50, Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1));
  if (!q) return NextResponse.json({ movies: [], query: q });
  try {
    if (page === 1) recordEvent("searches", req);
    const movies = await searchMovies(q, page);
    return NextResponse.json({ movies, query: q, page }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json(
      { movies: [], query: q, error: err?.message || "Search failed" },
      { status: 502 }
    );
  }
}
