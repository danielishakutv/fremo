import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/grab";
import { guard } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = guard(req, { data: true, limit: 600, windowMs: 60_000, bucket: "grab-status" });
  if (blocked) return blocked;

  const id = (req.nextUrl.searchParams.get("id") || "").slice(0, 64);
  const job = id ? getJob(id) : undefined;
  if (!job) return NextResponse.json({ state: "error", error: "This download expired. Please try again." });

  return NextResponse.json(
    { state: job.state, percent: Math.round(job.percent), fileName: job.fileName, error: job.error },
    { headers: { "Cache-Control": "no-store" } }
  );
}
