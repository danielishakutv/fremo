import { NextRequest } from "next/server";
import { isAllowedFileHost } from "@/lib/scrape";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Large movies stream through here; give the platform headroom where supported.
export const maxDuration = 300;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function sanitizeFilename(name: string): string {
  return (name || "movie.mkv").replace(/[\r\n"\\]/g, "").replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

export async function GET(req: NextRequest) {
  const blocked = guard(req, { limit: 30, windowMs: 60_000, bucket: "stream" });
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const name = sanitizeFilename(searchParams.get("name") || "");

  if (!url) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  // SSRF guard: only proxy known file hosts (incl. their CDN subdomains).
  if (target.protocol !== "https:" || !isAllowedFileHost(target.hostname)) {
    return new Response("forbidden host", { status: 403 });
  }

  // Forward the browser's Range header so downloads are resumable / show progress.
  const range = req.headers.get("range") || undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target.href, {
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        ...(range ? { Range: range } : {}),
      },
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("upstream " + upstream.status, { status: 502 });
  }

  const headers = new Headers();
  const pass = (h: string) => {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  };
  pass("content-length");
  pass("content-range");
  headers.set("accept-ranges", "bytes");
  headers.set(
    "content-type",
    upstream.headers.get("content-type") || "application/octet-stream"
  );
  // Force a clean attachment download with the movie's real filename.
  headers.set("content-disposition", `attachment; filename="${name}"`);
  headers.set("cache-control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
