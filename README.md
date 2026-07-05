# 🎬 Fremo

**Watch the latest. Download in seconds.**

A fast, clean, modern movie discovery & download app built with **Next.js 14**, **TypeScript**, **Tailwind CSS** and **Framer Motion**.

Fremo pulls the freshest movies & series, lets you search and preview them, and resolves a direct download link behind the scenes — all in one smooth, animated experience.

---

## Sources (no single point of failure)

Fremo aggregates several catalog sources in parallel and merges them into one
de-duplicated feed, so if one site is down or slow the others keep the catalogue
full. Each card shows which source it came from. Sources live in one file —
[`src/lib/sources.ts`](src/lib/sources.ts) — and adding another is a single line.

Currently integrated: **Net9ja**, **NaijaPrey**, **Net9ja Series**, **TheNetNaija**.
They share a common WordPress theme family, so one parser reads them all; sources
that fail a request are simply skipped for that page. (NGMovies is wired up but
disabled — it only carries YouTube trailers, no downloadable files.)

### Every surfaced movie is downloadable

Fremo resolves each movie's download from **its own source detail page** (the exact
link, not a fuzzy title search) and **filters the feed to movies that actually have
a working download** — if a title can't be resolved, it isn't shown. Resolvers cover:

- **Net9ja / TheNetNaija** → `dldownload.com.ng` SDM page → file host
- **NaijaPrey** → `np-downloader.com` SDM page → file host
- **Net9ja Series** → direct file-host links on the page
- File hosts → **wildshare.net** (signed-token CDN) and **meetdownload.com**
  (`kissorgrab.com` CDN), both streamed through `/api/stream`

Downloadability verdicts are cached per movie, so the feed stays fast after warm-up.

### English subtitles

Each movie's modal resolves an **English `.srt`** on demand and serves it through
Fremo (`/api/subtitle`):

- **subdl.com** is searched first (year-aware for movies, season-aware for series).
- **OpenSubtitles.org** is the fallback (XML-RPC search → website download), with
  **strict title matching** so a wrong movie's subtitle is never served, and its
  promo cue stripped.
- For meetdownload-hosted releases, the release's **own bundled `.srt`** is the last
  resort.
- Whatever the source, the file is **extracted from `.zip`/`.gz`, converted from
  `.ass`/`.vtt` → `.srt`**, cleaned of override tags, and served as a real `.srt`.
- The button only shows "Download English Subtitle" when a *real, validated* `.srt`
  was extracted (probe and download share one cache, so they never disagree). When
  no English subtitle exists yet (common for brand-new releases), the modal says so
  rather than offering a dead link.

## How it works

Fremo never scrapes from the browser (that would be blocked by CORS). All fetching happens in **server-side API routes**, so the UI just talks to your own backend:

1. **Browse / Search** — every enabled source is fetched in parallel, parsed for
   titles, posters and synopses, then merged + de-duped by title.
2. **Resolve download** — when you hit *Get Download Link*, Fremo searches the
   `dldownload.com.ng` mirror for the title, follows its download button, follows
   the redirect to the final file host (`wildshare.net` / `meetdownload.com`), and
   resolves the host's process token into a **portable, signed, range-capable CDN
   link** to the actual file.
3. **Download through Fremo** — *Download Now* streams the movie's bytes through
   Fremo's own `/api/stream` proxy with the correct filename. **No host page, no
   countdown, no extra clicks** — the file saves straight to the device. Range
   requests are forwarded, so downloads are resumable and show real progress.

### API routes

| Route | Purpose |
|---|---|
| `GET /api/movies?page=&category=` | Trending / Movies / Series listings |
| `GET /api/search?q=` | Search titles |
| `GET /api/movie?url=` | Full detail (poster, synopsis) |
| `GET /api/download?page=` / `?detail=` | Resolve a download link to the signed CDN url |
| `GET /api/stream?url=&name=` | Stream the file through Fremo (attachment, Range-aware, host-allowlisted) |
| `GET /api/subtitle?title=&page=` | Resolve + serve an English `.srt` (`&check=1` to probe) |
| `GET /api/img?u=` | Image proxy (hotlink/referer safe) |

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000  (this build previews on :3939)
```

Production:

```bash
npm run build
npm start
```

---

## Deploying

Fremo needs a **Node.js server runtime** for its API routes.

| Target | Works? | Notes |
|---|---|---|
| **Your own server / VPS** | ✅ | `npm run build && npm start` behind nginx/PM2. |
| **Vercel** | ✅ | Zero config — import the repo and deploy. |
| **Netlify** | ✅ | Uses the official Next.js runtime (serverless functions). |
| **GitHub Pages** | ❌ | Static-only host. It **cannot run the `/api/*` scraping routes**, so search & download won't work there. Use Vercel/Netlify/your server instead. |

> If a host blocks the source sites by datacenter IP, run Fremo on your own server (which is on a residential/normal IP) — the scrapers work exactly as they do locally.

### Note on direct streaming (`/api/stream`)

The *Download Now* button streams the movie through Fremo so it saves directly to
the user's device. Because a full movie can be hundreds of MB:

- ✅ **Your own server / VPS** — ideal. Node streams the file with constant memory
  and no artificial timeout.
- ⚠️ **Vercel / Netlify** — serverless functions cap execution time (and Netlify
  caps response size), so proxying a large movie can be cut off. If you deploy
  serverless, prefer a long-lived Node host for the streaming route, or have the
  client use the resolved `directUrl` from `/api/download` directly.

---

## Security & anti-scraping

Fremo is hardened so the deployed app resists abuse and casual data scraping:

- **Layered API guard** on every route: per-IP **rate limiting** (fixed-window),
  **bot/scraper user-agent blocking** (curl, python, scrapy, headless browsers, AI
  crawlers…), **cross-site request blocking** (`Sec-Fetch-Site`), and a **first-party
  header gate** on JSON data routes — so `curl /api/movies` and direct scrapers get
  **403**, while the real app (which sends the gate header + same-origin) works.
- **Strong security headers** (set in `next.config.mjs`): strict **CSP**
  (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), **HSTS**,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, COOP/CORP,
  `Permissions-Policy`, and `X-Powered-By` removed.
- **SSRF-safe proxies**: `/api/img` and `/api/stream` only fetch allow-listed hosts.
- **Input validation**: query params are clamped/validated; download/stream hosts
  are allow-listed.
- **`robots.txt`** disallows `/api/` and blocks aggressive AI/SEO crawlers.

> Set `NEXT_PUBLIC_FREMO_KEY` and `FREMO_SECRET` in production (see `.env.example`).
> No app-level code makes a site truly "unhackable" — for a public deployment, also
> put it behind **HTTPS + a CDN/WAF (e.g. Cloudflare)** for DDoS protection and an
> extra bot-management layer. The app-level defenses above stop the overwhelming
> majority of scraping and automated abuse.

## Analytics

**Real, server-side analytics** (no third-party tracker, privacy-friendly — visitor
IDs are salted SHA-256 hashes of IP+UA, no PII stored):

- Persisted to `.data/analytics.json` (atomic writes, survives restarts).
- Tracks **unique visitors, page views, searches, downloads, subtitles**, and a
  **live "watching now"** count (active in the last 5 min).
- Shown in an animated **footer** (count-up stats + live pulse), refreshing every 20s.
- Endpoints: `GET /api/stats`, `POST /api/track`, plus `GET /api/health` for uptime
  monitoring.

## Extra touches

- `/` keyboard shortcut focuses search; `Esc` closes the modal.
- Graceful `error.tsx` / `not-found.tsx` pages.
- Shareable `#movie=<id>` deep-links.

## Stack

- **Next.js 14** (App Router, server API routes)
- **TypeScript**
- **Tailwind CSS** (custom cinematic dark theme)
- **Framer Motion** (page, card, modal & download-flow animations)
- **Cheerio** (server-side HTML parsing)

---

## Note

Fremo is a discovery front-end. It does not host any files — all content is served
by the third-party sources it links to.
