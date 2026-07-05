import { unzipSync, gunzipSync } from "fflate";
import { resolveDeep } from "./scrape";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function fetchText(url: string, timeout = 15000): Promise<string | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: c.signal, cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
async function fetchBytes(url: string, timeout = 25000): Promise<Uint8Array | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://subdl.com/" }, signal: c.signal, cache: "no-store" });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function nextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
function parseTitle(title: string) {
  const year = (title.match(/\((19|20)\d{2}\)/) || [])[0]?.replace(/[()]/g, "");
  const sm = title.match(/season\s*(\d+)/i);
  const season = sm ? parseInt(sm[1], 10) : null;
  const name = title
    .replace(/\((?:19|20)\d{2}\)/g, " ")
    .replace(/season\s*\d+/gi, " ")
    .replace(/\bspecials?\b/gi, " ")
    .replace(/[:.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { name, year, season };
}

interface SubEntry {
  language?: string;
  link?: string;
  season?: number;
  episode?: number;
  downloads?: number;
}
function collectEnglish(data: any): SubEntry[] {
  const subs: SubEntry[] = [];
  (function walk(o: any) {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      if (o.language === "english" && o.link) subs.push(o);
      Object.values(o).forEach(walk);
    }
  })(data);
  const seen = new Set<string>();
  return subs.filter((s) => (s.link && !seen.has(s.link) ? (seen.add(s.link), true) : false));
}
function searchResults(data: any): any[] {
  const out: any[] = [];
  (function walk(o: any) {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      if (o.sd_id && o.slug && o.type) out.push(o);
      Object.values(o).forEach(walk);
    }
  })(data);
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.sd_id) ? false : (seen.add(r.sd_id), true)));
}

/** Find an English subtitle on subdl for a movie/series title. */
async function resolveFromSubdl(title: string): Promise<string | null> {
  const { name, year, season } = parseTitle(title);
  const shtml = await fetchText(`https://subdl.com/search/${encodeURIComponent(name)}`);
  if (!shtml) return null;
  const results = searchResults(nextData(shtml) || {});
  if (!results.length) return null;

  const wantTv = season != null;
  const score = (r: any) => {
    let s = 0;
    if (norm(r.name) === norm(name) || norm(r.original_name || "") === norm(name)) s += 5;
    else if (norm(r.name).includes(norm(name)) || norm(name).includes(norm(r.name))) s += 2;
    if (year && String(r.year) === year) s += 3;
    s += wantTv ? (r.type === "tv" ? 2 : 0) : r.type === "movie" ? 2 : 0;
    s += Math.min(2, (r.subtitles_count || 0) / 50);
    return s;
  };
  results.sort((a, b) => score(b) - score(a));

  for (const r of results.slice(0, 3)) {
    let url = `https://subdl.com/subtitle/${r.sd_id}/${r.slug}`;
    if (r.type === "tv") url += `/season-${season || 1}`;
    const html = await fetchText(url);
    if (!html) continue;
    const eng = collectEnglish(nextData(html));
    if (!eng.length) continue;
    if (wantTv) {
      // prefer episode 1, then season pack (ep 0), then most-downloaded
      eng.sort((a, b) => {
        const rank = (e: SubEntry) => (e.episode === 1 ? 0 : e.episode === 0 ? 1 : 2);
        return rank(a) - rank(b) || (b.downloads || 0) - (a.downloads || 0);
      });
    } else {
      eng.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    }
    return `https://dl.subdl.com/subtitle/${eng[0].link}`;
  }
  return null;
}

/** Release's own subtitle from a meetdownload file page (the .srt button). */
async function resolveFromHost(downloadPage: string): Promise<string | null> {
  try {
    const r = await resolveDeep(downloadPage);
    if (!r.downloadUrl || !/meetdownload/i.test(r.host || "")) return null;
    const html = await fetchText(r.downloadUrl);
    if (!html) return null;
    const m = html.match(
      /getElementById\(['"]downloadsButton['"]\)\.onclick\s*=\s*function\s*\(\)\s*\{[^}]*?location\.href\s*=\s*['"]([^'"]+)['"]/i
    );
    return m && /^https?:\/\//i.test(m[1]) ? m[1] : null;
  } catch {
    return null;
  }
}

function srtName(title: string): string {
  return (
    title
      .replace(/[^\w.\-() ]+/g, " ")
      .replace(/\s+/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 150) + ".en.srt"
  );
}

/* ---- subtitle format converters (anime/web often ship .ass / .vtt) ---- */

function assTime(t: string): string {
  const m = t.match(/(\d+):(\d{2}):(\d{2})[.:](\d{2})/);
  if (!m) return "00:00:00,000";
  return `${m[1].padStart(2, "0")}:${m[2]}:${m[3]},${m[4]}0`;
}
function assToSrt(ass: string): string {
  const out: string[] = [];
  let n = 0;
  for (const line of ass.split(/\r?\n/)) {
    if (!/^Dialogue:/i.test(line)) continue;
    const parts = line.replace(/^Dialogue:\s*/i, "").split(",");
    if (parts.length < 10) continue;
    const start = parts[1];
    const end = parts[2];
    const text = parts
      .slice(9)
      .join(",")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\\N/gi, "\n")
      .replace(/\\h/gi, " ")
      .trim();
    if (!text) continue;
    n++;
    out.push(`${n}\n${assTime(start)} --> ${assTime(end)}\n${text}`);
  }
  return out.join("\n\n");
}
function vttToSrt(vtt: string): string {
  const body = vtt.replace(/^WEBVTT[^\n]*\n/, "").replace(/NOTE[\s\S]*?(\n\n|$)/g, "");
  const blocks = body.split(/\n\n+/).filter((b) => b.includes("-->"));
  return blocks
    .map((b, i) => {
      const lines = b.split("\n").filter(Boolean);
      const ti = lines.findIndex((l) => l.includes("-->"));
      if (ti < 0) return "";
      let time = lines[ti]
        .replace(/\./g, ",")
        .replace(/\s+(position|align|line|size)[:%\w.-]*/g, "")
        .trim();
      time = time.replace(/(^|--> )(\d{2}:\d{2},\d{3})/g, (_m, p, t) => p + "00:" + t);
      const text = lines.slice(ti + 1).join("\n");
      return `${i + 1}\n${time}\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Drop promo/credit cues (e.g. OpenSubtitles "Watch online…") and renumber.
 *  Promos sit at the very start/end, so we only strip matches at the edges to
 *  avoid ever removing real dialogue. */
function cleanSrt(srt: string): string {
  const PROMO =
    /opensubtitles|osdb\.link|advertise your|subtitles? for any video|watch online (movies|and series|free)|api\.opensubtitles|become (a )?vip member|rate this subtitle|downloaded from|subdl\.com/i;
  const blocks = srt
    .split(/\n\n+/)
    .map((b) => b.split("\n"))
    .filter((ls) => ls.some((l) => l.includes("-->")));
  const n = blocks.length;
  const kept: string[][] = [];
  blocks.forEach((lines, idx) => {
    const ti = lines.findIndex((l) => l.includes("-->"));
    const text = lines.slice(ti + 1).join(" ");
    const atEdge = idx < 2 || idx >= n - 2;
    if (atEdge && PROMO.test(text)) return;
    kept.push(lines.slice(ti));
  });
  return kept.map((c, i) => `${i + 1}\n${c.join("\n")}`).join("\n\n");
}

function finalizeSrt(raw: string | null): string | null {
  if (!raw) return null;
  let srt = raw
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\{\\[^}]*\}/g, ""); // strip ASS override tags ({\an8}, {\i1}, …)
  srt = cleanSrt(srt).trim();
  return /\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(srt) ? srt : null;
}

function bytesToSrt(bytes: Uint8Array, kind: "zip" | "srt"): string | null {
  const dec = (u8: Uint8Array) => new TextDecoder("utf-8").decode(u8);

  // gzip (some OpenSubtitles downloads) → raw srt text
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      return finalizeSrt(dec(gunzipSync(bytes)));
    } catch {
      return null;
    }
  }

  let files: Record<string, Uint8Array> = {};
  if (kind === "zip" || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    try {
      files = unzipSync(bytes);
    } catch {
      return null;
    }
  } else {
    files = { plain: bytes };
  }
  const pick = (re: RegExp) =>
    Object.entries(files)
      .filter(([n]) => re.test(n))
      .sort((a, b) => b[1].length - a[1].length)[0];

  let srt: string | null = null;
  const s = pick(/\.srt$/i);
  if (s) srt = dec(s[1]);
  if (!srt) {
    const v = pick(/\.vtt$/i);
    if (v) srt = vttToSrt(dec(v[1]));
  }
  if (!srt) {
    const a = pick(/\.(ass|ssa)$/i);
    if (a) srt = assToSrt(dec(a[1]));
  }
  if (!srt && kind === "srt") srt = dec(bytes);
  return finalizeSrt(srt);
}

/* ---- OpenSubtitles.org (XML-RPC search → website download) ---- */

const OS_EP = "https://api.opensubtitles.org/xml-rpc";
const OS_UA = "Fremo v1.0";
let osToken: { token: string; ts: number } | null = null;

async function osRpc(xml: string): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(OS_EP, {
      method: "POST",
      headers: { "Content-Type": "text/xml", "User-Agent": OS_UA },
      body: xml,
      signal: c.signal,
    });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}
async function osLogin(): Promise<string | null> {
  if (osToken && Date.now() - osToken.ts < 6 * 3600 * 1000) return osToken.token;
  const xml = `<?xml version="1.0"?><methodCall><methodName>LogIn</methodName><params><param><value><string></string></value></param><param><value><string></string></value></param><param><value><string>en</string></value></param><param><value><string>${OS_UA}</string></value></param></params></methodCall>`;
  const tok = (await osRpc(xml)).match(/<name>token<\/name>\s*<value>\s*<string>([^<]+)<\/string>/)?.[1] || null;
  if (tok) osToken = { token: tok, ts: Date.now() };
  return tok;
}
const osEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Strict title match so we never serve a different movie's subtitle. */
function titleMatches(query: string, candidate: string): boolean {
  const STOP = new Set(["the", "a", "an", "of", "and", "to", "in", "season", "part", "le", "la"]);
  const toks = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  const q = toks(query);
  if (!q.length) return false;
  const c = new Set(toks(candidate));
  const hit = q.filter((w) => c.has(w)).length;
  return hit / q.length >= 0.6;
}

async function resolveFromOpenSubtitles(title: string): Promise<string | null> {
  const { name, season } = parseTitle(title);
  const token = await osLogin();
  if (!token) return null;

  let struct = `<member><name>sublanguageid</name><value><string>eng</string></value></member><member><name>query</name><value><string>${osEsc(
    name
  )}</string></value></member>`;
  if (season != null)
    struct += `<member><name>season</name><value><string>${season}</string></value></member><member><name>episode</name><value><string>1</string></value></member>`;
  const xml = `<?xml version="1.0"?><methodCall><methodName>SearchSubtitles</methodName><params><param><value><string>${token}</string></value></param><param><value><array><data><value><struct>${struct}</struct></value></data></array></value></param></params></methodCall>`;
  const res = await osRpc(xml);

  const items: Record<string, string>[] = [];
  for (const s of res.split("<struct>").slice(1)) {
    const o: Record<string, string> = {};
    for (const m of s.matchAll(/<member><name>([^<]+)<\/name><value>(?:<(?:string|int|double)>)?([^<]*)/g))
      o[m[1]] = m[2];
    if (o.IDSubtitle) items.push(o);
  }
  const cand = items
    .filter((o) => !o.SubFormat || /srt/i.test(o.SubFormat))
    .filter((o) => titleMatches(name, o.MovieName || ""));
  if (!cand.length) return null;
  cand.sort((a, b) => (+b.SubDownloadsCount || 0) - (+a.SubDownloadsCount || 0));
  return `https://dl.opensubtitles.org/en/download/subencoding-utf8/sub/${cand[0].IDSubtitle}`;
}

export interface PreparedSub {
  found: boolean;
  fileName?: string;
  srt?: string;
}

const cache = new Map<string, { p: PreparedSub; ts: number }>();
const TTL = 45 * 60 * 1000;

/**
 * Fully resolve → download → extract a usable English .srt for a title.
 * One cached path so the "probe" and the "download" can never disagree.
 */
export async function prepareSubtitle(title: string, downloadPage?: string): Promise<PreparedSub> {
  const key = norm(title);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.p;

  let src: string | null = null;
  let kind: "zip" | "srt" = "zip";

  // 1) subdl (no hard download cap) → 2) OpenSubtitles (great coverage) → 3) host
  const subdl = await resolveFromSubdl(title);
  if (subdl) {
    src = subdl;
    kind = "zip";
  } else {
    const os = await resolveFromOpenSubtitles(title);
    if (os) {
      src = os;
      kind = "zip";
    } else if (downloadPage) {
      const host = await resolveFromHost(downloadPage);
      if (host) {
        src = host;
        kind = "srt";
      }
    }
  }

  let p: PreparedSub = { found: false };
  if (src) {
    const bytes = await fetchBytes(src);
    const srt = bytes ? bytesToSrt(bytes, kind) : null;
    if (srt) p = { found: true, fileName: srtName(title), srt };
  }
  cache.set(key, { p, ts: Date.now() });
  return p;
}

/** Probe: does a usable English subtitle exist? (extracts + caches it) */
export async function resolveSubtitle(title: string, downloadPage?: string) {
  const p = await prepareSubtitle(title, downloadPage);
  return { found: p.found, fileName: p.fileName };
}

/** Get the actual .srt text (from cache). */
export async function getSubtitleSrt(
  title: string,
  downloadPage?: string
): Promise<{ fileName: string; srt: string } | null> {
  const p = await prepareSubtitle(title, downloadPage);
  return p.found && p.srt ? { fileName: p.fileName!, srt: p.srt } : null;
}
