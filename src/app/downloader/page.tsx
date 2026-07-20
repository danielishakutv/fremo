"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { GrabInfo } from "@/lib/grab";
import { apiFetch } from "@/lib/api";
import {
  PlayIcon,
  LinkIcon,
  DownloadIcon,
  MusicIcon,
  VideoIcon,
  ClockIcon,
  CheckIcon,
  AlertIcon,
  SparkIcon,
} from "@/components/icons";

const PLATFORMS: { name: string; soon?: boolean }[] = [
  { name: "TikTok" },
  { name: "Facebook" },
  { name: "Instagram" },
  { name: "X" },
  { name: "Vimeo" },
  { name: "Reddit" },
  { name: "YouTube", soon: true },
];

function isYouTubeLink(link: string): boolean {
  try {
    const h = new URL(link).hostname.toLowerCase();
    return /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(h);
  } catch {
    return false;
  }
}

type Fetch = "idle" | "loading" | "ready" | "error" | "comingsoon";
type DlState = "starting" | "downloading" | "processing" | "ready" | "done" | "error";
interface Dl {
  mode: "video" | "audio";
  state: DlState;
  percent: number;
  error?: string;
}

function fmtDuration(s?: number): string {
  if (!s || s < 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
function platformLabel(x?: string): string {
  if (!x) return "Video";
  const map: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram", twitter: "X", vimeo: "Vimeo", generic: "Web" };
  const k = x.toLowerCase().replace(/[^a-z]/g, "");
  return map[k] || x.replace(/([A-Z])/g, " $1").trim();
}

export default function DownloaderPage() {
  const [url, setUrl] = useState("");
  const [fetchState, setFetchState] = useState<Fetch>("idle");
  const [info, setInfo] = useState<GrabInfo | null>(null);
  const [err, setErr] = useState("");
  const [height, setHeight] = useState<number | null>(null);
  const [dl, setDl] = useState<Dl | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  async function getInfo(e?: React.FormEvent) {
    e?.preventDefault();
    const link = url.trim();
    if (!link) return;
    if (poll.current) clearInterval(poll.current);
    setInfo(null);
    setErr("");
    setDl(null);
    setHeight(null);
    // YouTube is temporarily disabled — show the "coming soon" card instantly.
    if (isYouTubeLink(link)) {
      setFetchState("comingsoon");
      return;
    }
    setFetchState("loading");
    try {
      const res = await apiFetch(`/api/grab/info?url=${encodeURIComponent(link)}`);
      const data = await res.json();
      if (data.comingSoon) {
        setFetchState("comingsoon");
      } else if (data.info) {
        setInfo(data.info);
        setHeight(data.info.heights?.[0] ?? null);
        setFetchState("ready");
      } else {
        setErr(data.error || "Couldn't fetch that video.");
        setFetchState("error");
      }
    } catch {
      setErr("Network error — please try again.");
      setFetchState("error");
    }
  }

  async function startDownload(mode: "video" | "audio") {
    if (poll.current) clearInterval(poll.current);
    setDl({ mode, state: "starting", percent: 0 });
    try {
      const q = new URLSearchParams({ url: url.trim(), mode });
      if (mode === "video" && height) q.set("height", String(height));
      const res = await apiFetch(`/api/grab/start?${q.toString()}`);
      const data = await res.json();
      if (!data.id) {
        setDl({ mode, state: "error", percent: 0, error: data.error || "Could not start the download." });
        return;
      }
      const id = data.id as string;
      poll.current = setInterval(async () => {
        try {
          const r = await apiFetch(`/api/grab/status?id=${encodeURIComponent(id)}`);
          const s = await r.json();
          setDl({ mode, state: s.state, percent: s.percent || 0, error: s.error });
          if (s.state === "ready") {
            if (poll.current) clearInterval(poll.current);
            const a = document.createElement("a");
            a.href = `/api/grab/file?id=${encodeURIComponent(id)}`;
            a.download = s.fileName || "";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setDl({ mode, state: "done", percent: 100 });
          } else if (s.state === "error") {
            if (poll.current) clearInterval(poll.current);
          }
        } catch {
          /* keep polling briefly through transient errors */
        }
      }, 1000);
    } catch {
      setDl({ mode, state: "error", percent: 0, error: "Could not start the download." });
    }
  }

  const busy = dl != null && dl.state !== "done" && dl.state !== "error";

  return (
    <main className="relative min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow">
              <PlayIcon className="ml-0.5 h-4 w-4" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Fre<span className="text-gradient">mo</span>
            </span>
          </a>
          <a href="/" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:text-white">
            ← Movies
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="mx-auto max-w-2xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
              <VideoIcon className="h-3.5 w-3.5 text-brand-400" /> Universal video &amp; audio downloader
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
              Download any video.
              <br />
              <span className="text-gradient">Just paste the link.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
              Grab videos in full quality — or pull just the audio as MP3 — from your favourite
              sites, straight to your device.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-1.5">
              {PLATFORMS.map((p) => (
                <span
                  key={p.name}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${
                    p.soon
                      ? "border-white/5 bg-white/[0.03] text-white/30"
                      : "border-white/10 bg-white/5 text-white/50"
                  }`}
                >
                  {p.name}
                  {p.soon && (
                    <span className="rounded-full bg-brand-500/20 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-brand-300">
                      Soon
                    </span>
                  )}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Input */}
          <motion.form
            onSubmit={getInfo}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8"
          >
            <div className="glass flex items-center gap-2 rounded-2xl p-2 shadow-card focus-within:border-brand-400/50 focus-within:shadow-glow">
              <span className="pl-2 text-white/40">
                <LinkIcon className="h-5 w-5" />
              </span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a video link…"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent py-2.5 text-[15px] text-white placeholder-white/35 outline-none"
              />
              <button
                type="submit"
                disabled={fetchState === "loading" || !url.trim()}
                className="flex flex-none items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition disabled:opacity-50"
              >
                {fetchState === "loading" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <>Fetch</>
                )}
              </button>
            </div>
          </motion.form>

          {/* Result */}
          <div className="mt-6">
            <AnimatePresence mode="wait">
              {fetchState === "loading" && (
                <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="overflow-hidden rounded-2xl border border-white/5 bg-ink-850">
                  <div className="shimmer aspect-video w-full bg-white/[0.04]" />
                  <div className="space-y-2 p-4">
                    <div className="shimmer h-4 w-3/4 rounded bg-white/[0.05]" />
                    <div className="shimmer h-3 w-1/3 rounded bg-white/[0.04]" />
                  </div>
                </motion.div>
              )}

              {fetchState === "error" && (
                <motion.div key="err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
                  <AlertIcon className="mt-0.5 h-5 w-5 flex-none text-amber-400" />
                  <p className="text-sm text-amber-100/90">{err}</p>
                </motion.div>
              )}

              {fetchState === "comingsoon" && (
                <motion.div key="soon" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass overflow-hidden rounded-2xl p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
                    <SparkIcon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-white">YouTube is coming soon</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                    We&apos;re polishing YouTube support to make it fast and reliable. In the
                    meantime, Fremo grabs <span className="text-white/80">TikTok, Facebook,
                    Instagram, X, Vimeo, Reddit</span> and 1000+ other sites — paste one of those.
                  </p>
                </motion.div>
              )}

              {fetchState === "ready" && info && (
                <motion.div key="ready" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-card">
                  {/* preview */}
                  <div className="relative aspect-video w-full overflow-hidden bg-ink-800">
                    {info.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/grab/thumb?u=${encodeURIComponent(info.thumbnail)}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20">
                        <VideoIcon className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-transparent" />
                    <span className="absolute left-3 top-3 rounded-full bg-brand-500/85 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                      {platformLabel(info.extractor)}
                    </span>
                    {info.duration ? (
                      <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                        <ClockIcon className="h-3 w-3" /> {fmtDuration(info.duration)}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-4 sm:p-5">
                    <h2 className="line-clamp-2 text-base font-semibold leading-snug text-white">{info.title}</h2>
                    {info.uploader && <p className="mt-1 text-xs text-white/45">{info.uploader}</p>}

                    {/* quality chips */}
                    {info.heights?.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-white/40">Video quality</p>
                        <div className="flex flex-wrap gap-2">
                          {info.heights.map((h) => (
                            <button
                              key={h}
                              onClick={() => setHeight(h)}
                              disabled={busy}
                              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                                height === h ? "bg-white text-ink-950" : "border border-white/10 bg-white/5 text-white/70 hover:text-white"
                              }`}
                            >
                              {h >= 2160 ? "4K" : `${h}p`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* progress or actions */}
                    {dl ? (
                      <DownloadProgress dl={dl} onReset={() => setDl(null)} />
                    ) : (
                      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                        {info.heights?.length > 0 && (
                          <button
                            onClick={() => startDownload("video")}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_0_40px_-12px_rgba(16,185,129,0.7)] transition hover:brightness-110"
                          >
                            <DownloadIcon className="h-5 w-5" /> Download Video
                          </button>
                        )}
                        <button
                          onClick={() => startDownload("audio")}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          <MusicIcon className="h-5 w-5 text-brand-400" /> MP3 Audio
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-white/30">
            Please only download content you have the rights to. Fremo doesn&apos;t host any of
            these videos.
          </p>
        </div>
      </section>
    </main>
  );
}

function DownloadProgress({ dl, onReset }: { dl: Dl; onReset: () => void }) {
  const label =
    dl.state === "starting"
      ? "Starting…"
      : dl.state === "downloading"
      ? `Downloading ${dl.percent}%`
      : dl.state === "processing"
      ? dl.mode === "audio"
        ? "Converting to MP3…"
        : "Merging video + audio…"
      : dl.state === "done"
      ? "Saved to your device"
      : "Something went wrong";

  if (dl.state === "error") {
    return (
      <div className="mt-5 space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5">
          <AlertIcon className="mt-0.5 h-5 w-5 flex-none text-amber-400" />
          <p className="text-sm text-amber-100/90">{dl.error || "The download failed."}</p>
        </div>
        <button onClick={onReset} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10">
          Back
        </button>
      </div>
    );
  }

  const indeterminate = dl.state === "starting" || dl.state === "processing";
  const pct = dl.state === "done" ? 100 : dl.percent;

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-white">
          {dl.state === "done" ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckIcon className="h-3 w-3" />
            </span>
          ) : (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-brand-400" />
          )}
          {label}
        </span>
        {!indeterminate && dl.state !== "done" && <span className="text-white/50">{dl.percent}%</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${dl.state === "done" ? "bg-emerald-500" : "bg-gradient-to-r from-brand-500 to-brand-400"}`}
          animate={{ width: indeterminate ? ["15%", "85%", "35%"] : `${pct}%` }}
          transition={indeterminate ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        />
      </div>
      {dl.state === "done" && (
        <button onClick={onReset} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10">
          Download another format
        </button>
      )}
    </div>
  );
}
