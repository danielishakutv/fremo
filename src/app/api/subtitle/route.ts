import { NextRequest, NextResponse } from "next/server";
import { resolveSubtitle, getSubtitleSrt } from "@/lib/subtitles";
import { guard, clampParam } from "@/lib/security";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function GET(req: NextRequest) {
  // download path is loaded via <a>, so no first-party header required here
  const blocked = guard(req, { data: false, limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const title = clampParam(searchParams.get("title"), 160);
  const page = (searchParams.get("page") || "").trim().slice(0, 500) || undefined;
  const check = searchParams.get("check");

  if (!title) return NextResponse.json({ found: false, error: "title required" }, { status: 400 });

  // Lightweight probe: does an English subtitle exist?
  if (check) {
    try {
      const r = await resolveSubtitle(title, page);
      return NextResponse.json({ found: r.found, fileName: r.fileName });
    } catch {
      return NextResponse.json({ found: false });
    }
  }

  // Download: serve the actual .srt through Fremo.
  try {
    const sub = await getSubtitleSrt(title, page);
    if (!sub) {
      return NextResponse.json({ found: false, message: "No English subtitle found." }, { status: 404 });
    }
    recordEvent("subtitles", req);
    return new Response(sub.srt, {
      status: 200,
      headers: {
        "Content-Type": "application/x-subrip; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sub.fileName.replace(/[\r\n"]/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { found: false, message: err?.message || "Subtitle error" },
      { status: 500 }
    );
  }
}
