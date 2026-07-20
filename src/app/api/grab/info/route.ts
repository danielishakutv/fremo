import { NextRequest, NextResponse } from "next/server";
import { assertPublicUrl, fetchInfo } from "@/lib/grab";
import { guard, clampParam } from "@/lib/security";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 30, windowMs: 60_000, bucket: "grab-info" });
  if (blocked) return blocked;

  const url = clampParam(req.nextUrl.searchParams.get("url"), 600);
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    await assertPublicUrl(url);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid link." }, { status: 400 });
  }

  try {
    const info = await fetchInfo(url);
    recordEvent("grabs", req);
    return NextResponse.json({ info }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not fetch video." }, { status: 200 });
  }
}
