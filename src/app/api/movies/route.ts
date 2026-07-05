import { NextRequest, NextResponse } from "next/server";
import { getMovies } from "@/lib/scrape";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const page = Math.min(50, Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1));
  const categoryRaw = (searchParams.get("category") || "").toLowerCase();
  const category = /^[a-z-]{1,20}$/.test(categoryRaw) ? categoryRaw : undefined;
  try {
    const movies = await getMovies(page, category);
    return NextResponse.json({ movies, page }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json(
      { movies: [], error: err?.message || "Failed to load movies" },
      { status: 502 }
    );
  }
}
