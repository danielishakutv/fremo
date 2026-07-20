export interface Movie {
  /** Globally-unique id: `${source}:${slug}` */
  id: string;
  slug: string;
  /** Source id (e.g. "net9ja", "naijaprey") */
  source: string;
  /** Human-readable source name (e.g. "Net9ja") */
  sourceName: string;
  title: string;
  /** Title with the trailing "(2026)" / "(Season 1)" stripped — used for matching */
  cleanTitle: string;
  year?: string;
  url: string; // net9ja detail page url
  thumb: string; // best thumbnail url
  poster?: string; // hi-res portrait poster (detail page)
  excerpt: string;
  date?: string;
  categories: string[];
  tags: string[];
  /** Pre-resolved download link (SDM page or file-host page) found on the source. */
  downloadPage?: string;
}

export interface MovieDetail extends Movie {
  description: string;
}

/** One downloadable item on a series page (an episode) or a quality variant. */
export interface Episode {
  /** Human label, e.g. "Episode 1" */
  label: string;
  /** file-host or SDM link to deep-resolve at click time */
  page: string;
  /** episode number, for ordering */
  n?: number;
}

export interface DownloadResult {
  found: boolean;
  /** What the user asked us to resolve */
  query: string;
  matchedTitle?: string;
  /** Set when the title has multiple episodes/parts to download. */
  isSeries?: boolean;
  /** The list of episodes when isSeries is true. */
  episodes?: Episode[];
  /** dldownload sdm post page */
  sourcePage?: string;
  /** wildshare file page — where the user completes the download (fallback) */
  downloadUrl?: string;
  /** resolved direct, signed file URL (streams the actual bytes) */
  directUrl?: string;
  fileName?: string;
  fileSize?: string;
  /** Whether downloadUrl points at the auto-download host (wildshare) */
  host?: string;
  /** A friendly message for the UI when not found */
  message?: string;
}
