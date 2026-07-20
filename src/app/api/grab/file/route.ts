import { NextRequest } from "next/server";
import { Readable } from "stream";
import { getJob, jobStream, contentTypeFor } from "@/lib/grab";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitize(name: string): string {
  return (name || "download").replace(/[\r\n"\\]/g, "").replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

export async function GET(req: NextRequest) {
  // No `data` gate: this is a same-origin anchor download and the id is an
  // unguessable UUID. Still bot-blocked + rate-limited.
  const blocked = guard(req, { limit: 60, windowMs: 60_000, bucket: "grab-file" });
  if (blocked) return blocked;

  const id = (req.nextUrl.searchParams.get("id") || "").slice(0, 64);
  const job = id ? getJob(id) : undefined;
  if (!job || job.state !== "ready") return new Response("not ready", { status: 404 });

  const s = jobStream(job);
  if (!s) return new Response("file missing", { status: 404 });

  const name = sanitize(job.fileName || "download");
  const webStream = Readable.toWeb(s.stream) as unknown as ReadableStream;
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(name),
      "Content-Length": String(s.size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
