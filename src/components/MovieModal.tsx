"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Movie, MovieDetail } from "@/lib/types";
import { img, pretty } from "@/lib/util";
import { CloseIcon, FilmIcon } from "./icons";
import DownloadFlow from "./DownloadFlow";
import SubtitleButton from "./SubtitleButton";
import { apiFetch } from "@/lib/api";

export default function MovieModal({
  movie,
  onClose,
}: {
  movie: Movie | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!movie) return;
    setDetail(null);
    setLoadingDetail(true);
    let cancelled = false;
    apiFetch(`/api/movie?url=${encodeURIComponent(movie.url)}`)
      .then((r) => r.json())
      .then((d) => !cancelled && d.movie && setDetail(d.movie))
      .catch(() => {})
      .finally(() => !cancelled && setLoadingDetail(false));
    return () => {
      cancelled = true;
    };
  }, [movie]);

  // lock scroll + ESC to close
  useEffect(() => {
    if (!movie) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [movie, onClose]);

  const poster = detail?.poster || movie?.thumb;
  const description = detail?.description || movie?.excerpt || "";
  const chips = [...(movie?.categories || []), ...(movie?.tags || [])].slice(0, 6);

  return (
    <AnimatePresence>
      {movie && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-card sm:rounded-3xl"
          >
            {/* hero banner */}
            <div className="relative h-44 flex-none overflow-hidden sm:h-56">
              {poster ? (
                <img
                  src={img(poster)}
                  alt=""
                  className="h-full w-full scale-110 object-cover object-top opacity-50 blur-[1px]"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-ink-800 to-ink-700" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/60 to-transparent" />
              <button
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                aria-label="Close"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* body */}
            <div className="no-scrollbar -mt-16 flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
              <div className="flex gap-4 sm:gap-5">
                <div className="relative h-40 w-28 flex-none overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-card sm:h-48 sm:w-32">
                  {poster ? (
                    <img src={img(poster)} alt={movie.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                      <FilmIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-16 sm:pt-20">
                  <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
                    {movie.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/50">
                    {movie.year && <span className="font-medium text-white/70">{movie.year}</span>}
                    {movie.date && <span>· {movie.date}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70"
                      >
                        {pretty(c)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* synopsis */}
              <div className="mt-5">
                {loadingDetail && !description ? (
                  <div className="space-y-2">
                    <div className="shimmer h-3 w-full rounded bg-white/[0.05]" />
                    <div className="shimmer h-3 w-11/12 rounded bg-white/[0.05]" />
                    <div className="shimmer h-3 w-4/5 rounded bg-white/[0.05]" />
                  </div>
                ) : (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
                    {description || "No synopsis available for this title."}
                  </p>
                )}
              </div>

              {/* download */}
              <div className="mt-6">
                <DownloadFlow
                  title={movie.title}
                  downloadPage={movie.downloadPage}
                  detailUrl={movie.url}
                />
                <SubtitleButton title={movie.title} downloadPage={movie.downloadPage} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
