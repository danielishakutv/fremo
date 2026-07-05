// Catalog sources Fremo aggregates. They all run the same Nigerian movie
// WordPress theme family (mh-magazine-lite / naijaprey / ngmovies / flixnseries),
// so a single parser reads them all. Adding a new source is one line here.

export interface Source {
  id: string;
  name: string;
  /** Full origin used for fetching listing/search/detail pages. */
  base: string;
  /** Registrable domain used for host allow-listing (hostname endsWith). */
  domain: string;
  /** Lower = preferred when the same title appears on multiple sources. */
  priority: number;
  enabled: boolean;
}

export const SOURCES: Source[] = [
  { id: "net9ja", name: "Net9ja", base: "https://www.net9ja.tv", domain: "net9ja.tv", priority: 1, enabled: true },
  { id: "naijaprey", name: "NaijaPrey", base: "https://www.naijaprey.tv", domain: "naijaprey.tv", priority: 2, enabled: true },
  { id: "net9jaseries", name: "Net9ja Series", base: "https://net9jaseries.com", domain: "net9jaseries.com", priority: 3, enabled: true },
  { id: "thenetnaija", name: "TheNetNaija", base: "https://thenetnaija.com.ng", domain: "thenetnaija.com.ng", priority: 4, enabled: true },
  // NGMovies is YouTube-trailer based (no downloadable files) — disabled so every
  // surfaced movie has a real, working download. Re-enable only if that changes.
  { id: "ngmovies", name: "NGMovies", base: "https://www.ngmovies.com.ng", domain: "ngmovies.com.ng", priority: 5, enabled: false },
];

export const ENABLED_SOURCES = SOURCES.filter((s) => s.enabled);

export function getSource(id: string): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Match a URL's hostname against any source's registrable domain (incl. subdomains). */
export function isSourceHost(hostname: string): boolean {
  return SOURCES.some((s) => hostname === s.domain || hostname.endsWith("." + s.domain));
}

/** Find which source a detail/image URL belongs to. */
export function sourceForUrl(url: string): Source | undefined {
  try {
    const h = new URL(url).hostname;
    return SOURCES.find((s) => h === s.domain || h.endsWith("." + s.domain));
  } catch {
    return undefined;
  }
}
