import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { createReadStream, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promises as dns } from "dns";

const YTDLP = process.env.YTDLP_BIN || "yt-dlp";
// Optional YouTube auth: a Netscape cookies.txt exported from a logged-in
// browser. Without it, YouTube blocks datacenter IPs ("confirm you're not a bot").
// Auto-detected at <cwd>/.secrets/youtube_cookies.txt, or override via env.
const COOKIES = process.env.YTDLP_COOKIES || join(process.cwd(), ".secrets", "youtube_cookies.txt");
const MAX_FILESIZE = process.env.GRAB_MAX_FILESIZE || "3G";

function baseArgs(): string[] {
  const a = ["--no-playlist", "--no-warnings", "--restrict-filenames"];
  // existsSync is checked per-call so cookies can be added without a restart.
  if (COOKIES && existsSync(COOKIES)) a.push("--cookies", COOKIES);
  return a;
}

/* ------------------------------- SSRF guard ------------------------------- */

function isPrivateIp(ip: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const p = ip.split(".").map(Number);
    return (
      p[0] === 0 ||
      p[0] === 10 ||
      p[0] === 127 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
    );
  }
  const h = ip.toLowerCase();
  return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h === "::";
}

// YouTube is gated off for now (needs cookies/PO-token/JS-runtime to be reliable
// from a datacenter IP). Flip on later with GRAB_YOUTUBE=on once it's solid.
export const YOUTUBE_ENABLED = process.env.GRAB_YOUTUBE === "on";
const YT_DOMAINS = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
export function isYouTubeUrl(u: URL): boolean {
  const h = u.hostname.toLowerCase();
  return YT_DOMAINS.some((d) => h === d || h.endsWith("." + d));
}
export const YOUTUBE_SOON_MSG =
  "YouTube support is coming soon. For now Fremo grabs TikTok, Facebook, Instagram, X, Vimeo, Reddit and 1000+ other sites.";

/** Validate a user-supplied media URL: http(s) only, not pointing at a private host. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Please paste a valid link.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http/https links are supported.");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("That link isn't allowed.");
  }
  if (isPrivateIp(host)) throw new Error("That link isn't allowed.");
  try {
    const addrs = await dns.lookup(host, { all: true });
    if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That link isn't allowed.");
  } catch (e: any) {
    if (/isn't allowed/.test(e?.message)) throw e;
    // DNS failure -> let yt-dlp surface a friendlier "unsupported/unavailable" later
  }
  return u;
}

/* --------------------------------- info --------------------------------- */

export interface GrabInfo {
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  extractor?: string;
  webpageUrl?: string;
  /** curated list of downloadable video heights (desc) */
  heights: number[];
  hasAudio: boolean;
}

function runCapture(bin: string, args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const to = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(to);
      resolve({ code: -1, stdout, stderr: stderr + String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(to);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

function friendlyError(stderr: string): string {
  const line = stderr.split("\n").reverse().find((l) => /ERROR/i.test(l)) || "";
  if (/confirm you.?re not a bot|Sign in to confirm|cookies/i.test(line))
    return "YouTube needs sign-in cookies on the server to download this. Other sites (TikTok, Facebook, Instagram, X, Vimeo…) work without it.";
  if (/Unsupported URL|Unable to extract|no video/i.test(line))
    return "Couldn't find a downloadable video at that link.";
  if (/Private video|login required|not available|geo/i.test(line))
    return "That video is private, region-locked, or unavailable.";
  return "Couldn't fetch that video. Double-check the link and try again.";
}

export async function fetchInfo(url: string): Promise<GrabInfo> {
  const { code, stdout, stderr } = await runCapture(YTDLP, [...baseArgs(), "-J", url], 45000);
  if (code !== 0 || !stdout.trim()) throw new Error(friendlyError(stderr));
  let j: any;
  try {
    j = JSON.parse(stdout);
  } catch {
    throw new Error("Couldn't read that video's details.");
  }
  const info = j.entries && j.entries.length ? j.entries[0] : j;
  const formats: any[] = info.formats || [];
  const vids = formats.filter((f) => f.vcodec && f.vcodec !== "none" && f.height);
  const auds = formats.filter((f) => f.acodec && f.acodec !== "none");
  const maxH = vids.reduce((m, f) => Math.max(m, f.height || 0), 0);

  const ladder = [2160, 1440, 1080, 720, 480, 360, 240];
  let heights = ladder.filter((h) => h <= maxH);
  if (heights.length === 0 && maxH > 0) heights = [maxH];
  // ensure the native max is offered when it sits between ladder rungs
  if (maxH > 0 && !heights.includes(maxH) && maxH > (heights[0] || 0)) heights = [maxH, ...heights];
  heights = heights.slice(0, 5);

  return {
    title: info.title || info.fulltitle || "Untitled",
    thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.at(-1)?.url) || undefined,
    duration: typeof info.duration === "number" ? info.duration : undefined,
    uploader: info.uploader || info.channel || info.uploader_id || undefined,
    extractor: info.extractor_key || info.extractor || undefined,
    webpageUrl: info.webpage_url || url,
    heights,
    hasAudio: auds.length > 0 || vids.length > 0,
  };
}

/* --------------------------------- jobs --------------------------------- */

type JobState = "downloading" | "processing" | "ready" | "error";
interface Job {
  id: string;
  state: JobState;
  percent: number;
  dir: string;
  file?: string;
  fileName?: string;
  error?: string;
  ts: number;
}

// Persist the registry + sweeper across dev hot-reloads / route module reloads.
const g = globalThis as unknown as { __grabJobs?: Map<string, Job>; __grabSweep?: NodeJS.Timeout };
const jobs: Map<string, Job> = g.__grabJobs || (g.__grabJobs = new Map());
const JOB_TTL = 30 * 60 * 1000;

if (!g.__grabSweep) {
  g.__grabSweep = setInterval(() => {
    const now = Date.now();
    for (const [id, j] of jobs) {
      if (now - j.ts > JOB_TTL) {
        try {
          rmSync(j.dir, { recursive: true, force: true });
        } catch {}
        jobs.delete(id);
      }
    }
  }, 5 * 60 * 1000);
  // don't keep the event loop alive just for the sweeper
  (g.__grabSweep as any).unref?.();
}

function videoFormat(height?: number): string {
  const hf = height ? `[height<=${height}]` : "";
  return (
    `bestvideo[ext=mp4]${hf}+bestaudio[ext=m4a]/` +
    `best[ext=mp4]${hf}/` +
    `bestvideo${hf}+bestaudio/` +
    `best${hf}/best`
  );
}

export function startJob(url: string, mode: "video" | "audio", height?: number): string {
  const id = randomUUID();
  const dir = mkdtempSync(join(tmpdir(), "fremo-grab-"));
  const job: Job = { id, state: "downloading", percent: 0, dir, ts: Date.now() };
  jobs.set(id, job);

  const out = join(dir, "%(title).120B.%(ext)s");
  const args =
    mode === "audio"
      ? [...baseArgs(), "--newline", "--max-filesize", MAX_FILESIZE, "-f", "bestaudio/best",
         "-x", "--audio-format", "mp3", "--audio-quality", "0", "-o", out, url]
      : [...baseArgs(), "--newline", "--max-filesize", MAX_FILESIZE, "-f", videoFormat(height),
         "--merge-output-format", "mp4", "-o", out, url];

  const child = spawn(YTDLP, args, { cwd: dir, windowsHide: true });
  let stderrTail = "";

  const onLine = (chunk: string) => {
    job.ts = Date.now();
    for (const raw of chunk.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/\[download\]\s+([\d.]+)%/);
      if (m) {
        job.percent = Math.min(100, parseFloat(m[1]));
        job.state = "downloading";
      } else if (/^\[(Merger|ExtractAudio|VideoConvertor|FixupM3u8|Fixup)/.test(line)) {
        job.state = "processing";
      }
    }
  };
  child.stdout.on("data", (b) => onLine(b.toString()));
  child.stderr.on("data", (b) => {
    stderrTail = (stderrTail + b.toString()).slice(-4000);
    onLine(b.toString());
  });
  child.on("error", (e) => {
    job.state = "error";
    job.error = "Downloader failed to start on the server.";
    job.ts = Date.now();
    void e;
  });
  child.on("close", (code) => {
    job.ts = Date.now();
    if (code === 0) {
      try {
        const f = readdirSync(dir).find((n) => !n.endsWith(".part") && !n.endsWith(".ytdl"));
        if (f) {
          job.file = join(dir, f);
          job.fileName = f;
          job.state = "ready";
          job.percent = 100;
        } else {
          job.state = "error";
          job.error = "The download finished but no file was produced.";
        }
      } catch {
        job.state = "error";
        job.error = "Could not read the downloaded file.";
      }
    } else {
      job.state = "error";
      job.error = friendlyError(stderrTail);
    }
  });

  return id;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function jobStream(job: Job): { stream: ReturnType<typeof createReadStream>; size: number } | null {
  if (!job.file || !existsSync(job.file)) return null;
  const size = statSync(job.file).size;
  return { stream: createReadStream(job.file), size };
}

export function contentTypeFor(name: string): string {
  if (/\.mp3$/i.test(name)) return "audio/mpeg";
  if (/\.m4a$/i.test(name)) return "audio/mp4";
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.mkv$/i.test(name)) return "video/x-matroska";
  return "video/mp4";
}
