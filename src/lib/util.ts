/** Route a remote image through our proxy so it always loads (hotlink/referer safe). */
export function img(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/api/img")) return url;
  return `/api/img?u=${encodeURIComponent(url)}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Title-case a taxonomy slug like "sci fi" -> "Sci Fi". */
export function pretty(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pick a clean, short type/genre label from a source's (often noisy) taxonomy. */
export function typeLabel(categories: string[] = [], tags: string[] = []): string {
  const all = [...categories, ...tags].map((c) => c.toLowerCase());
  if (all.some((c) => c.includes("yoruba"))) return "Yoruba";
  if (all.some((c) => c.includes("nollywood"))) return "Nollywood";
  if (all.some((c) => c.includes("korean") || c.includes("k-drama"))) return "K-Drama";
  if (all.some((c) => c.includes("series") || c.includes("season") || c.includes(" tv"))) return "Series";
  if (all.some((c) => c.includes("movie"))) return "Movies";
  const first = categories[0] || tags[0] || "";
  const cleaned = first
    .replace(/\b(download|vx?\d+|v\d+|hd|mp4|mkv)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? pretty(cleaned) : "Movie";
}
