import { NextRequest } from "next/server";
import { SOURCES } from "@/lib/sources";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every source domain + the download mirrors that host thumbnails/posters.
const ALLOWED = [
  ...SOURCES.map((s) => s.domain),
  "dldownload.com.ng",
  "wildshare.net",
  "meetdownload.com",
  // WordPress Photon image CDN (i0/i1/i2.wp.com) — used by some sources' thumbnails
  "wp.com",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { limit: 600, windowMs: 60_000, bucket: "img" });
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("u");
  if (!url) return new Response("missing u", { status: 400 });

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (!ALLOWED.some((d) => host === d || host.endsWith("." + d))) {
    return new Response("forbidden host", { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: "https://" + host + "/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("upstream " + upstream.status, { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
