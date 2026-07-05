import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getIp } from "./security";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "analytics.json");
const SALT = process.env.FREMO_SECRET || "fremo-analytics-salt-v1";

type EventKey = "views" | "searches" | "downloads" | "subtitles";

interface Store {
  totals: Record<EventKey, number>;
  byDay: Record<string, Partial<Record<EventKey, number>>>;
  knownVisitors: string[]; // capped
  since: string;
}

function emptyStore(): Store {
  return {
    totals: { views: 0, searches: 0, downloads: 0, subtitles: 0 },
    byDay: {},
    knownVisitors: [],
    since: new Date().toISOString().slice(0, 10),
  };
}

function load(): Store {
  try {
    const s = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const base = emptyStore();
    return {
      totals: { ...base.totals, ...(s.totals || {}) },
      byDay: s.byDay || {},
      knownVisitors: Array.isArray(s.knownVisitors) ? s.knownVisitors : [],
      since: s.since || base.since,
    };
  } catch {
    return emptyStore();
  }
}

const store = load();
const knownSet = new Set(store.knownVisitors);
const live = new Map<string, number>(); // hash -> lastSeenMs
const countedView = new Map<string, number>(); // hash -> lastCountedMs
let dirty = false;

const MAX_KNOWN = 250_000;
const DAY = () => new Date().toISOString().slice(0, 10);

function persist() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store));
    fs.renameSync(tmp, FILE);
  } catch {
    /* best-effort persistence */
  }
}
// flush periodically + on shutdown
const timer = setInterval(persist, 10_000);
if (typeof timer.unref === "function") timer.unref();
for (const sig of ["exit", "SIGINT", "SIGTERM"] as const) {
  try {
    process.on(sig, persist);
  } catch {
    /* ignore */
  }
}

function pruneDays() {
  const days = Object.keys(store.byDay).sort();
  while (days.length > 60) delete store.byDay[days.shift()!];
}
function bumpDay(k: EventKey) {
  const d = DAY();
  const day = (store.byDay[d] ||= {});
  day[k] = (day[k] || 0) + 1;
  if (Object.keys(store.byDay).length > 70) pruneDays();
}

export function visitorHash(req: Request): string {
  const ip = getIp(req);
  const ua = req.headers.get("user-agent") || "";
  return crypto.createHash("sha256").update(`${ip}|${ua}|${SALT}`).digest("hex").slice(0, 32);
}

export function recordView(req: Request) {
  const h = visitorHash(req);
  const now = Date.now();
  live.set(h, now);
  const last = countedView.get(h) || 0;
  if (now - last < 15_000) return; // dedupe refresh spam
  countedView.set(h, now);
  store.totals.views++;
  bumpDay("views");
  if (!knownSet.has(h)) {
    knownSet.add(h);
    if (store.knownVisitors.length < MAX_KNOWN) store.knownVisitors.push(h);
  }
  dirty = true;
}

export function recordEvent(type: Exclude<EventKey, "views">, req?: Request) {
  store.totals[type]++;
  bumpDay(type);
  if (req) live.set(visitorHash(req), Date.now());
  dirty = true;
}

export function getStats() {
  const now = Date.now();
  let liveCount = 0;
  for (const [h, ts] of live) {
    if (now - ts > 5 * 60_000) live.delete(h);
    else liveCount++;
  }
  for (const [h, ts] of countedView) if (now - ts > 60_000) countedView.delete(h);

  const d = DAY();
  const todayTotals = store.byDay[d] || {};
  return {
    live: liveCount,
    visitors: knownSet.size,
    views: store.totals.views,
    searches: store.totals.searches,
    downloads: store.totals.downloads,
    subtitles: store.totals.subtitles,
    today: {
      views: todayTotals.views || 0,
      downloads: todayTotals.downloads || 0,
      searches: todayTotals.searches || 0,
    },
    since: store.since,
  };
}
