"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { Movie } from "@/lib/types";
import { img, typeLabel } from "@/lib/util";
import { PlayIcon, FilmIcon } from "./icons";

export default function MovieCard({
  movie,
  index = 0,
  onOpen,
}: {
  movie: Movie;
  index?: number;
  onOpen: (m: Movie) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const tag = typeLabel(movie.categories, movie.tags);

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(movie)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.4), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="group relative block w-full text-left focus:outline-none"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-850 shadow-card transition-shadow duration-300 group-hover:border-white/20 group-hover:shadow-glow">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-ink-800">
          {!failed && movie.thumb ? (
            <img
              src={img(movie.thumb)}
              alt={movie.title}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-105 ${
                loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-700 text-white/20">
              <FilmIcon className="h-10 w-10" />
            </div>
          )}
          {!loaded && !failed && <div className="shimmer absolute inset-0 bg-white/[0.03]" />}

          {/* hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent opacity-90" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/90 text-white shadow-glow backdrop-blur">
              <PlayIcon className="ml-0.5 h-6 w-6" />
            </span>
          </div>

          {movie.year && (
            <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur">
              {movie.year}
            </span>
          )}
          {tag && (
            <span className="absolute left-2 top-2 rounded-full bg-brand-500/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {tag}
            </span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow">
            {movie.title}
          </h3>
        </div>
      </div>
    </motion.button>
  );
}
