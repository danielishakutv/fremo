// Shared, client-safe constant. The client sends this header on internal API
// calls; the server requires it on data routes. It blocks the overwhelming
// majority of scrapers that hit the JSON endpoints directly without running the
// app's JS. Override in production via NEXT_PUBLIC_FREMO_KEY.
export const FREMO_KEY = process.env.NEXT_PUBLIC_FREMO_KEY || "fx-web-3a9k2";
export const FREMO_HEADER = "x-fremo";
