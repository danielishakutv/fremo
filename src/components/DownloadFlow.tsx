"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { DownloadResult, Episode } from "@/lib/types";
import { DownloadIcon, CheckIcon, AlertIcon, ExternalIcon, FilmIcon } from "./icons";
import { apiFetch } from "@/lib/api";

const STEPS = [
  "Searching download mirrors",
  "Matching the best source",
  "Resolving secure link",
  "Preparing your download",
];

type Phase = "idle" | "working" | "done" | "series" | "error";
type EpStatus = "idle" | "resolving" | "downloading" | "error";
interface EpState {
  status: EpStatus;
  fileName?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fire a browser download of a file streamed through Fremo. */
function streamFile(directUrl: string, fileName?: string) {
  const url = `/api/stream?url=${encodeURIComponent(directUrl)}&name=${encodeURIComponent(
    fileName || "video.mkv"
  )}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DownloadFlow({
  title,
  downloadPage,
  detailUrl,
}: {
  title: string;
  downloadPage?: string;
  detailUrl?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [started, setStarted] = useState(false);
  const [epStates, setEpStates] = useState<Record<string, EpState>>({});
  const [allRunning, setAllRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const setEp = (page: string, s: EpState) =>
    setEpStates((prev) => ({ ...prev, [page]: s }));

  async function start() {
    setPhase("working");
    setStep(0);
    setResult(null);
    setStarted(false);
    setEpStates({});
    timers.current.forEach(clearTimeout);
    timers.current = STEPS.slice(0, -1).map((_, i) =>
      setTimeout(() => setStep((s) => Math.max(s, i + 1)), 800 * (i + 1))
    );

    try {
      // Resolve via the detail page so multi-episode series are discovered.
      const qs = detailUrl
        ? `detail=${encodeURIComponent(detailUrl)}`
        : `page=${encodeURIComponent(downloadPage || "")}`;
      const res = await apiFetch(`/api/download?${qs}`);
      const data: DownloadResult = await res.json();
      timers.current.forEach(clearTimeout);
      setStep(STEPS.length - 1);
      await sleep(400);
      setResult(data);
      if (data.found && data.episodes && data.episodes.length > 1) setPhase("series");
      else if (data.found && (data.downloadUrl || data.directUrl)) setPhase("done");
      else setPhase("error");
    } catch {
      timers.current.forEach(clearTimeout);
      setResult({ found: false, query: title, message: "Something went wrong while resolving the link." });
      setPhase("error");
    }
  }

  function triggerDownload() {
    if (!result) return;
    if (result.directUrl) {
      streamFile(result.directUrl, result.fileName);
      setStarted(true);
    } else if (result.downloadUrl) {
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    }
  }

  /** Resolve a single episode's signed link and start its download. Returns success. */
  async function downloadEpisode(ep: Episode): Promise<boolean> {
    setEp(ep.page, { status: "resolving" });
    try {
      const res = await apiFetch(`/api/download?page=${encodeURIComponent(ep.page)}`);
      const data: DownloadResult = await res.json();
      if (data.found && data.directUrl) {
        streamFile(data.directUrl, data.fileName);
        setEp(ep.page, { status: "downloading", fileName: data.fileName });
        return true;
      }
      if (data.found && data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        setEp(ep.page, { status: "downloading" });
        return true;
      }
      setEp(ep.page, { status: "error" });
      return false;
    } catch {
      setEp(ep.page, { status: "error" });
      return false;
    }
  }

  async function downloadAll() {
    if (!result?.episodes) return;
    setAllRunning(true);
    for (const ep of result.episodes) {
      await downloadEpisode(ep);
      await sleep(1200); // stagger so the browser doesn't block the batch
    }
    setAllRunning(false);
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* IDLE — the big CTA */}
        {phase === "idle" && (
          <motion.button
            key="cta"
            type="button"
            onClick={start}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 text-base font-semibold text-white shadow-glow transition"
          >
            <DownloadIcon className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
            Get Download Link
          </motion.button>
        )}

        {/* WORKING — animated steps */}
        {phase === "working" && (
          <motion.div
            key="working"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass space-y-3 rounded-2xl p-5"
          >
            {STEPS.map((label, i) => {
              const state = i < step ? "done" : i === step ? "active" : "pending";
              return (
                <div key={label} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs transition-colors ${
                      state === "done"
                        ? "bg-emerald-500 text-white"
                        : state === "active"
                        ? "bg-brand-500 text-white"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {state === "done" ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : state === "active" ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`text-sm transition-colors ${
                      state === "pending" ? "text-white/40" : "text-white/90"
                    }`}
                  >
                    {label}
                    {state === "active" && <AnimatedDots />}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* DONE — single file ready to download */}
        {phase === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="glass flex items-center gap-3 rounded-2xl p-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <CheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {result.fileName || "Download ready"}
                </p>
                <p className="text-xs text-white/50">
                  {result.fileSize ? `${result.fileSize} · ` : ""}
                  via {result.host || "mirror"}
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={triggerDownload}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-base font-semibold text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.6)]"
            >
              <DownloadIcon className="h-5 w-5" />
              {started ? "Downloading — restart" : result.directUrl ? "Download Now" : "Open Download"}
            </motion.button>

            {started ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[11px] leading-relaxed text-emerald-300/80"
              >
                Your download has started — saving to your device. Check your browser&apos;s
                downloads bar.
              </motion.p>
            ) : (
              <p className="text-center text-[11px] leading-relaxed text-white/40">
                {result.directUrl
                  ? "Streams straight to your device through Fremo — no extra pages, no waiting."
                  : "Opens the secure file host in a new tab. If a countdown appears, wait a moment then press its download button."}
              </p>
            )}
          </motion.div>
        )}

        {/* SERIES — list of episodes */}
        {phase === "series" && result?.episodes && (
          <motion.div
            key="series"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <FilmIcon className="h-4 w-4 text-brand-400" />
                <span>{result.episodes.length} episodes found</span>
              </div>
              <button
                type="button"
                onClick={downloadAll}
                disabled={allRunning}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_30px_-12px_rgba(16,185,129,0.7)] transition disabled:opacity-60"
              >
                {allRunning ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <DownloadIcon className="h-4 w-4" />
                )}
                {allRunning ? "Downloading…" : "Download all"}
              </button>
            </div>

            <div className="no-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1">
              {result.episodes.map((ep) => {
                const st = epStates[ep.page]?.status || "idle";
                return (
                  <div
                    key={ep.page}
                    className="glass flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-white/10 px-1.5 text-[11px] text-white/70">
                        {ep.n ?? "•"}
                      </span>
                      {ep.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadEpisode(ep)}
                      disabled={st === "resolving"}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        st === "downloading"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : st === "error"
                          ? "bg-amber-400/15 text-amber-300"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {st === "resolving" ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Resolving
                        </>
                      ) : st === "downloading" ? (
                        <>
                          <CheckIcon className="h-3.5 w-3.5" /> Started
                        </>
                      ) : st === "error" ? (
                        <>Retry</>
                      ) : (
                        <>
                          <DownloadIcon className="h-3.5 w-3.5" /> Download
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-[11px] leading-relaxed text-white/40">
              Each episode streams straight to your device through Fremo. If your browser asks to
              allow multiple downloads, choose Allow.
            </p>
          </motion.div>
        )}

        {/* ERROR / not found */}
        {phase === "error" && result && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <span className="mt-0.5 flex-none text-amber-400">
                <AlertIcon className="h-5 w-5" />
              </span>
              <p className="text-sm text-amber-100/90">
                {result.message || "We couldn't resolve a direct download for this title."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={start}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Try again
              </button>
              {result.sourcePage && (
                <a
                  href={result.sourcePage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <ExternalIcon className="h-4 w-4" /> Open mirror
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnimatedDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x % 3) + 1), 400);
    return () => clearInterval(id);
  }, []);
  return <span className="text-white/50">{".".repeat(n)}</span>;
}
