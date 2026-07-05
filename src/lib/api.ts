import { FREMO_KEY, FREMO_HEADER } from "./keys";

/**
 * fetch wrapper for first-party API calls. Adds the gate header so the server
 * can distinguish real app traffic from direct scrapers. Use for JSON data
 * routes (movies, search, movie, download, stats, track). Routes loaded by the
 * browser directly (img/stream/subtitle download) don't use this.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(FREMO_HEADER, FREMO_KEY);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
