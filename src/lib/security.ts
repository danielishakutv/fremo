import { FREMO_KEY, FREMO_HEADER } from "./keys";

/* ----------------------------- client IP ----------------------------- */

export function getIp(req: Request): string {
  const h = (n: string) => req.headers.get(n) || "";
  const xff = h("x-forwarded-for").split(",")[0].trim();
  return xff || h("x-real-ip") || h("cf-connecting-ip") || h("x-vercel-forwarded-for") || "0.0.0.0";
}

/* --------------------------- rate limiting --------------------------- */
// Fixed-window counters, shared across all API routes (one Node process).

interface Bucket {
  count: number;
  reset: number;
}
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return b.count > limit
    ? { ok: false as const, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) }
    : { ok: true as const, retryAfter: 0 };
}

/* --------------------------- bot detection --------------------------- */

const BOT_RE =
  /(curl|wget|python-requests|python\/|scrapy|httpclient|http[-_]?client|go-http-client|libwww|java\/|okhttp|axios|node-fetch|got\/|guzzle|aiohttp|httpx|mechanize|phantomjs|headlesschrome|puppeteer|playwright|selenium|httrack|wpscan|nikto|sqlmap|nmap|masscan|zgrab|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|ccbot|claudebot|amazonbot|dataforseo|serpstat|crawler|spider|scraper|harvest|scan)/i;

export function isBot(ua: string): boolean {
  if (!ua || ua.length < 12) return true; // empty / nonsense UA
  if (!/mozilla\//i.test(ua)) return true; // real browsers start with Mozilla/
  return BOT_RE.test(ua);
}

/* ----------------------------- the guard ----------------------------- */

export interface GuardOpts {
  /** requests/window per IP */
  limit?: number;
  windowMs?: number;
  /** sensitive JSON route → require first-party signal */
  data?: boolean;
  /** distinct rate-limit bucket name (defaults to the path) */
  bucket?: string;
}

function deny(status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: status === 429 ? "Too Many Requests" : "Forbidden" }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

/**
 * Returns a blocking Response if the request should be denied, else null.
 * Layered: bot-UA block → cross-site block → rate limit → first-party gate.
 */
export function guard(req: Request, opts: GuardOpts = {}): Response | null {
  const { limit = 60, windowMs = 60_000, data = false } = opts;
  const ua = req.headers.get("user-agent") || "";
  const ip = getIp(req);
  const path = new URL(req.url).pathname;
  const bucketKey = `${ip}:${opts.bucket || path}`;

  if (isBot(ua)) return deny(403);

  const sfs = req.headers.get("sec-fetch-site");
  if (sfs && sfs !== "same-origin" && sfs !== "same-site" && sfs !== "none") return deny(403);

  const rl = rateLimit(bucketKey, limit, windowMs);
  if (!rl.ok) return deny(429, { "Retry-After": String(rl.retryAfter) });

  if (data) {
    const sameOrigin = sfs === "same-origin" || sfs === "same-site";
    const hasKey = req.headers.get(FREMO_HEADER) === FREMO_KEY;
    if (!sameOrigin && !hasKey) return deny(403);
  }

  return null;
}

/** Clamp/sanitize a free-text query param (strip control chars + cap length). */
export function clampParam(v: string | null, max = 120): string {
  let out = "";
  for (const ch of v || "") {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c !== 127) out += ch;
  }
  return out.trim().slice(0, max);
}
