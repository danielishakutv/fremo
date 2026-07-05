import { NextRequest, NextResponse } from "next/server";
import { resolveDeep, resolveFromDetailDeep } from "@/lib/scrape";
import { guard } from "@/lib/security";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const page = (searchParams.get("page") || "").trim().slice(0, 500);
  const detail = (searchParams.get("detail") || "").trim().slice(0, 400);

  if (!page && !detail) {
    return NextResponse.json({ found: false, error: "page or detail required" }, { status: 400 });
  }

  try {
    const result = page ? await resolveDeep(page) : await resolveFromDetailDeep(detail);
    if (result.found) recordEvent("downloads", req);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { found: false, query: page || detail, message: err?.message || "Could not resolve download" },
      { status: 200 }
    );
  }
}
