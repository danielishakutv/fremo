import { NextRequest, NextResponse } from "next/server";
import { assertPublicUrl, startJob, isYouTubeUrl, YOUTUBE_ENABLED, YOUTUBE_SOON_MSG } from "@/lib/grab";
import { guard, clampParam } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 20, windowMs: 60_000, bucket: "grab-start" });
  if (blocked) return blocked;

  const sp = req.nextUrl.searchParams;
  const url = clampParam(sp.get("url"), 600);
  const mode = sp.get("mode") === "audio" ? "audio" : "video";
  const height = parseInt(sp.get("height") || "0", 10) || undefined;
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  let u: URL;
  try {
    u = await assertPublicUrl(url);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid link." }, { status: 400 });
  }

  if (isYouTubeUrl(u) && !YOUTUBE_ENABLED) {
    return NextResponse.json({ error: YOUTUBE_SOON_MSG, comingSoon: true }, { status: 400 });
  }

  const id = startJob(url, mode, mode === "video" ? height : undefined);
  return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
