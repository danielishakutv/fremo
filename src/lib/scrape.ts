import * as cheerio from "cheerio";
import type { Movie, MovieDetail, DownloadResult } from "./types";
import { ENABLED_SOURCES, isSourceHost, sourceForUrl, type Source } from "./sources";

export const NET9JA = "https://www.net9ja.tv";
export const DLD = "https://dldownload.com.ng";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

interface FetchOpts {
  referer?: string;
  redirect?: RequestInit["redirect"];
  timeout?: number;
  cookie?: string;
}

/** Fetch a URL as a browser would, with a timeout. */
export async function fetchHtml(url: string, opts: FetchOpts = {}): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeout ?? 20000);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(opts.referer ? { Referer: opts.referer } : {}),
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      },
      redirect: opts.redirect ?? "follow",
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

/** Collapse a response's Set-Cookie header(s) into a "k=v; k2=v2" Cookie string. */
function collectCookies(res: Response): string {
  const h = res.headers as unknown as { getSetCookie?: () => string[] };
  let arr: string[] = [];
  if (typeof h.getSetCookie === "function") arr = h.getSetCookie();
  else {
    const sc = res.headers.get("set-cookie");
    if (sc) arr = [sc];
  }
  return arr.map((c) => c.split(";")[0]).join("; ");
}

/** Hosts whose download pages are Yetishare-style (file page -> pt token -> signed CDN). */
export const FILE_HOSTS = ["wildshare.net", "meetdownload.com", "kissorgrab.com"];

export function isAllowedFileHost(hostname: string): boolean {
  return FILE_HOSTS.some((d) => hostname === d || hostname.endsWith("." + d));
}

/* ----------------------------- helpers ----------------------------- */

export function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    return path.split("/").filter(Boolean).pop() ?? url;
  } catch {
    return url;
  }
}

/** Strip trailing "(2026)" / "(Season 2)" / quality tags for matching. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*\((?:19|20)\d{2}\)\s*$/i, "")
    .replace(/\s*\(season\s*\d+\)\s*/i, " ")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractYear(title: string): string | undefined {
  const m = title.match(/\((19|20)\d{2}\)/);
  return m ? m[0].replace(/[()]/g, "") : undefined;
}

/** Pick the largest image from a srcset, falling back to src. */
function bestImage($img: cheerio.Cheerio<any>): string {
  const srcset = $img.attr("srcset");
  if (srcset) {
    const candidates = srcset
      .split(",")
      .map((p) => p.trim())
      .map((p) => {
        const [u, w] = p.split(/\s+/);
        return { u, w: parseInt(w || "0", 10) || 0 };
      })
      .filter((c) => c.u);
    if (candidates.length) {
      candidates.sort((a, b) => b.w - a.w);
      return candidates[0].u;
    }
  }
  return $img.attr("src") || $img.attr("data-src") || "";
}

function classesToTaxonomy(cls: string | undefined): { categories: string[]; tags: string[] } {
  const categories: string[] = [];
  const tags: string[] = [];
  (cls || "").split(/\s+/).forEach((c) => {
    if (c.startsWith("category-")) categories.push(c.replace("category-", "").replace(/-/g, " "));
    else if (c.startsWith("tag-")) tags.push(c.replace("tag-", "").replace(/-/g, " "));
  });
  return { categories, tags };
}

/* ------------------------- multi-source listing ------------------------- */

/** Parse a WordPress (mh-magazine family) listing/search page into Movies. */
function parseList(html: string, source: Source): Movie[] {
  const $ = cheerio.load(html);
  const movies: Movie[] = [];

  $("article.mh-loop-item, article.mh-custom-posts-item, article.post").each((_, el) => {
    const $el = $(el);
    const $titleLink = $el.find(".entry-title a").first();
    const title = $titleLink.text().trim();
    const url = $titleLink.attr("href") || "";
    if (!title || !url) return;
    // only keep links that live on this source (skip nav/related off-site links)
    try {
      if (new URL(url).hostname.replace(/^www\./, "") !== source.domain && !new URL(url).hostname.endsWith(source.domain))
        return;
    } catch {
      return;
    }

    const thumb = bestImage($el.find(".mh-loop-thumb img, .entry-thumbnail img, figure img").first());
    const excerptRaw = $el.find(".mh-excerpt, .mh-loop-excerpt, .entry-summary").first().text();
    const excerpt = excerptRaw.replace(/\[…\].*$/s, "").replace(/\[?\.\.\.\]?\s*$/, "").trim();
    const date = $el.find(".mh-meta-date, .entry-meta-date, time").first().text().trim();
    const { categories, tags } = classesToTaxonomy($el.attr("class"));
    const slug = slugFromUrl(url);

    movies.push({
      id: `${source.id}:${slug}`,
      slug,
      source: source.id,
      sourceName: source.name,
      title,
      cleanTitle: cleanTitle(title),
      year: extractYear(title),
      url,
      thumb,
      excerpt,
      date,
      categories,
      tags,
    });
  });

  // De-dupe by slug within a page (sticky posts can repeat).
  const seen = new Set<string>();
  return movies.filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)));
}

async function listFromSource(source: Source, page = 1, category?: string): Promise<Movie[]> {
  let url = source.base + "/";
  if (category) url = `${source.base}/category/${encodeURIComponent(category)}/`;
  if (page > 1) url += `page/${page}/`;
  const res = await fetchHtml(url, { timeout: 14000 });
  if (!res.ok) return [];
  return parseList(await res.text(), source);
}

async function searchFromSource(source: Source, query: string, page = 1): Promise<Movie[]> {
  let url = `${source.base}/?s=${encodeURIComponent(query)}`;
  if (page > 1) url = `${source.base}/page/${page}/?s=${encodeURIComponent(query)}`;
  const res = await fetchHtml(url, { timeout: 14000 });
  if (!res.ok) return [];
  return parseList(await res.text(), source);
}

/** Round-robin interleave several source lists, de-duping identical titles. */
function mergeSources(lists: Movie[][], category?: string): Movie[] {
  const seen = new Set<string>();
  const out: Movie[] = [];
  const key = (m: Movie) => m.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const maxLen = lists.reduce((n, l) => Math.max(n, l.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      const m = list[i];
      if (!m) continue;
      const k = key(m);
      if (!k || seen.has(k)) continue;
      // light category sanity filter (drops cross-contamination from soft-404s)
      if (category === "series" && m.categories.includes("movies") && !m.categories.includes("series")) continue;
      if (category === "movies" && m.categories.includes("series") && !m.categories.includes("movies")) continue;
      seen.add(k);
      out.push(m);
    }
  }
  return out;
}

/* ---- downloadability filter: only surface movies with a real download ---- */

/** Run an async fn over items with bounded concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Cache the (detailUrl -> downloadPage|null) verdict so repeated feeds are fast.
const dlCache = new Map<string, { page: string | null; ts: number }>();
const DL_TTL = 45 * 60 * 1000;

async function confirmDownloadable(detailUrl: string): Promise<string | null> {
  const cached = dlCache.get(detailUrl);
  if (cached && Date.now() - cached.ts < DL_TTL) return cached.page;
  let page: string | null = null;
  try {
    page = await resolveFromDetail(detailUrl);
  } catch {
    page = null;
  }
  dlCache.set(detailUrl, { page, ts: Date.now() });
  return page;
}

/** Keep only movies that actually have a resolvable download; attach the link. */
async function filterDownloadable(movies: Movie[]): Promise<Movie[]> {
  const checked = await mapLimit(movies, 14, async (m) => {
    const page = await confirmDownloadable(m.url);
    return page ? ({ ...m, downloadPage: page } as Movie) : null;
  });
  return checked.filter((m): m is Movie => m !== null);
}

/** Aggregate a listing page across every enabled source, then keep only downloadable. */
export async function getMovies(page = 1, category?: string): Promise<Movie[]> {
  const settled = await Promise.allSettled(
    ENABLED_SOURCES.map((s) => listFromSource(s, page, category))
  );
  const lists = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  return filterDownloadable(mergeSources(lists, category));
}

/** Aggregate a search across every enabled source, then keep only downloadable. */
export async function searchMovies(query: string, page = 1): Promise<Movie[]> {
  const settled = await Promise.allSettled(
    ENABLED_SOURCES.map((s) => searchFromSource(s, query, page))
  );
  const lists = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  return filterDownloadable(mergeSources(lists));
}

/* ---------------------------- movie detail ---------------------------- */

/** Fetch a movie's full detail straight from its (allow-listed) source URL. */
export async function getMovieDetail(detailUrl: string): Promise<MovieDetail> {
  let u: URL;
  try {
    u = new URL(detailUrl);
  } catch {
    throw new Error("bad url");
  }
  if (!isSourceHost(u.hostname)) throw new Error("host not allowed");

  const res = await fetchHtml(detailUrl);
  if (!res.ok) throw new Error(`detail ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const title =
    $("h1.entry-title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    "";
  const poster =
    $('meta[property="og:image"]').attr("content") ||
    bestImage($(".entry-content img, .entry-thumbnail img").first());

  // Collect meaningful paragraph text from the article body, skipping boilerplate.
  const paras: string[] = [];
  $(".entry-content p, .entry-summary p").each((_, p) => {
    const text = $(p).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (
      /join our telegram|download (now|link|below)|click here|whatsapp|telegram channel/i.test(text)
    )
      return;
    if (
      /what do you think about this (movie|film|series)|what would you rate|average rating|vote count|no votes so far|be the first to rate|rate this post|leave a (comment|reply)/i.test(
        text
      )
    )
      return;
    if (text.length < 25) return;
    paras.push(text);
  });
  const description = paras.join("\n\n").trim();

  const { categories, tags } = classesToTaxonomy($("article").first().attr("class"));
  const src = sourceForUrl(detailUrl);
  const slug = slugFromUrl(detailUrl);

  return {
    id: `${src?.id || "src"}:${slug}`,
    slug,
    source: src?.id || "",
    sourceName: src?.name || "",
    title,
    cleanTitle: cleanTitle(title),
    year: extractYear(title),
    url: detailUrl,
    thumb: poster || "",
    poster,
    excerpt: paras[0] || "",
    description,
    categories,
    tags,
  };
}

/* --------------------- download resolution (generic) --------------------- */

// SDM (Simple Download Monitor) mirror hosts used by the sources' download pages.
const SDM_HOSTS = ["dldownload.com.ng", "np-downloader.com"];

function hostMatches(hostname: string, domains: string[]): boolean {
  return domains.some((d) => hostname === d || hostname.endsWith("." + d));
}
function isFileHostUrl(url: string): boolean {
  try {
    return hostMatches(new URL(url).hostname, FILE_HOSTS);
  } catch {
    return false;
  }
}
function isSdmUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      hostMatches(u.hostname, SDM_HOSTS) &&
      (u.pathname.includes("/sdm_downloads/") || u.search.includes("sdm_process_download"))
    );
  } catch {
    return false;
  }
}

/**
 * Find the best download link on a movie's OWN source detail page.
 * Prefers a direct file-host link (net9jaseries), else an SDM page
 * (net9ja/thenetnaija -> dldownload, naijaprey -> np-downloader).
 * Returns the link URL, or null if the movie has no resolvable download.
 */
export async function resolveFromDetail(detailUrl: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(detailUrl);
  } catch {
    return null;
  }
  if (!isSourceHost(u.hostname)) return null;

  const res = await fetchHtml(detailUrl, { timeout: 14000 });
  if (!res.ok) return null;
  const $ = cheerio.load(await res.text());

  const fileLinks: string[] = [];
  const sdmLinks: string[] = [];
  $("a[href]").each((_, a) => {
    const href = ($(a).attr("href") || "").trim();
    if (!href) return;
    if (isFileHostUrl(href)) fileLinks.push(href);
    else if (isSdmUrl(href)) sdmLinks.push(href);
  });

  return fileLinks[0] || sdmLinks[0] || null;
}

/**
 * Resolve an SDM page to the file-host page. Two flavours:
 *  - dldownload.com.ng: button is `?sdm_process_download=...` which 302s to the host.
 *  - np-downloader.com: button links DIRECTLY to the wildshare file url.
 */
async function resolveSdmToFileHost(sdmUrl: string): Promise<string | null> {
  let link = sdmUrl;
  if (sdmUrl.includes("/sdm_downloads/")) {
    const res = await fetchHtml(sdmUrl, { timeout: 14000 });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    let p =
      $("a.sdm_download").attr("href") || $('a[href*="sdm_process_download"]').attr("href") || "";
    if (!p) return null;
    if (p.startsWith("/")) p = new URL(p, sdmUrl).href;
    link = p;
  }
  // Already a direct file-host link → use it as-is.
  if (isFileHostUrl(link)) return link;
  // Otherwise it's a process-download link → follow the 302 to the file host.
  const hop = await fetchHtml(link, { redirect: "manual", referer: sdmUrl, timeout: 14000 });
  const loc = hop.headers.get("location");
  return loc && /^https?:\/\//i.test(loc) ? loc : null;
}

/** Resolve a file-host page to its portable signed CDN url + filename/size. */
async function resolveFileHostToSigned(
  fileUrl: string
): Promise<{ directUrl?: string; fileName?: string; fileSize?: string; host: string }> {
  const host = (() => {
    try {
      return new URL(fileUrl).hostname;
    } catch {
      return "";
    }
  })();
  let directUrl: string | undefined;
  let fileName: string | undefined;
  let fileSize: string | undefined;

  try {
    const res = await fetchHtml(fileUrl, { referer: fileUrl, timeout: 15000 });
    if (res.ok) {
      const cookie = collectCookies(res);
      const html = await res.text();
      const $$ = cheerio.load(html);
      fileName =
        $$("span.heading3").first().text().trim() ||
        $$(".icon-and-title h1, .file-info h1").first().text().trim() ||
        $$("title")
          .text()
          .replace(/^\s*download\s+/i, "")
          .replace(/\s*-\s*[a-z0-9.]+\.[a-z]+\s*$/i, "")
          .trim() ||
        undefined;

      const sizeMatch = html.match(/Size:\s*\(([^)]+)\)/i);
      if (sizeMatch) fileSize = sizeMatch[1].trim();
      else {
        const m = $$(".size-number").first().text().match(/([0-9.]+)\s*([KMGT]B)/i);
        if (m) fileSize = `${m[1]} ${m[2].toUpperCase()}`;
      }

      // wildshare-style: a ?pt= token that 302s to the signed CDN url.
      const ptMatch = html.match(/window\.location\s*=\s*['"]([^'"]+pt=[^'"]+)['"]/i);
      if (ptMatch) {
        let ptUrl = ptMatch[1];
        if (ptUrl.startsWith("/")) ptUrl = new URL(ptUrl, fileUrl).href;
        const hop = await fetchHtml(ptUrl, {
          redirect: "manual",
          cookie,
          referer: fileUrl,
          timeout: 15000,
        });
        const loc = hop.headers.get("location");
        if (loc && /^https?:\/\//i.test(loc)) directUrl = loc;
      }

      // meetdownload-style: the download button's onclick sets location.href
      // straight to the direct CDN url (e.g. kissorgrab.com).
      if (!directUrl) {
        const btn = html.match(
          /getElementById\(['"]downloadButton['"]\)\.onclick\s*=\s*function\s*\(\)\s*\{[^}]*?(?:location\.href|window\.location(?:\.href)?)\s*=\s*['"]([^'"]+)['"]/i
        );
        if (btn && /^https?:\/\//i.test(btn[1])) directUrl = btn[1];
      }
    }
  } catch {
    /* best-effort */
  }
  if (!fileName) {
    try {
      fileName = decodeURIComponent(new URL(fileUrl).pathname.split("/").pop() || "");
    } catch {
      /* ignore */
    }
  }
  return { directUrl, fileName, fileSize, host };
}

/**
 * Resolve a download link (SDM page or file-host page) all the way to the
 * signed, streamable CDN url. This is the click-time deep resolution.
 */
export async function resolveDeep(downloadPage: string): Promise<DownloadResult> {
  let u: URL;
  try {
    u = new URL(downloadPage);
  } catch {
    return { found: false, query: downloadPage, message: "Invalid download link." };
  }
  // SSRF guard: only our known mirrors / file hosts.
  if (!hostMatches(u.hostname, [...SDM_HOSTS, ...FILE_HOSTS])) {
    return { found: false, query: downloadPage, message: "Unsupported download host." };
  }

  try {
    let fileHostUrl = downloadPage;
    if (isSdmUrl(downloadPage)) {
      const fh = await resolveSdmToFileHost(downloadPage);
      if (!fh) {
        return { found: false, query: downloadPage, message: "The download link is unavailable." };
      }
      fileHostUrl = fh;
    }

    const { directUrl, fileName, fileSize, host } = await resolveFileHostToSigned(fileHostUrl);
    return {
      found: true,
      query: downloadPage,
      sourcePage: downloadPage,
      downloadUrl: fileHostUrl,
      directUrl,
      fileName,
      fileSize,
      host,
    };
  } catch {
    return { found: false, query: downloadPage, message: "Could not resolve the download." };
  }
}

/** Resolve straight from a movie's source detail page (find link, then deep-resolve). */
export async function resolveFromDetailDeep(detailUrl: string): Promise<DownloadResult> {
  const page = await resolveFromDetail(detailUrl);
  if (!page) {
    return { found: false, query: detailUrl, message: "No download is available for this title." };
  }
  return resolveDeep(page);
}
