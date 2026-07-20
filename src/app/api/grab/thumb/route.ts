import { NextRequest } from "next/server";
import { assertPublicUrl } from "@/lib/grab";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { limit: 600, windowMs: 60_000, bucket: "grab-thumb" });
  if (blocked) return blocked;

  const url = req.nextUrl.searchParams.get("u");
  if (!url) return new Response("missing u", { status: 400 });
  try {
    await assertPublicUrl(url);
  } catch {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8" },
      cache: "no-store",
    });
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !upstream.body || !type.startsWith("image/")) {
      return new Response("bad image", { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
