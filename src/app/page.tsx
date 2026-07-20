"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import SearchBar from "@/components/SearchBar";
import MovieGrid from "@/components/MovieGrid";
import MovieModal from "@/components/MovieModal";
import AnalyticsFooter from "@/components/AnalyticsFooter";
import { GridSkeleton } from "@/components/Skeleton";
import { FilmIcon, VideoIcon, PlayIcon } from "@/components/icons";
import { apiFetch } from "@/lib/api";

const CATEGORIES = [
  { key: "", label: "Trending" },
  { key: "movies", label: "Movies" },
  { key: "series", label: "Series" },
];

export default function Home() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<Movie | null>(null);
  const reqId = useRef(0);

  const isSearch = query.trim().length > 0;

  const load = useCallback(
    async (opts: { q: string; cat: string; page: number; append: boolean }) => {
      const id = ++reqId.current;
      const { q, cat, page, append } = opts;
      if (append) setLoadingMore(true);
      else if (q) setSearching(true);
      else setLoading(true);

      try {
        const url = q
          ? `/api/search?q=${encodeURIComponent(q)}&page=${page}`
          : `/api/movies?page=${page}${cat ? `&category=${cat}` : ""}`;
        const res = await apiFetch(url);
        const data = await res.json();
        if (id !== reqId.current) return; // stale response
        const list: Movie[] = data.movies || [];
        setHasMore(list.length >= 10);
        setMovies((prev) => {
          if (!append) return list;
          const seen = new Set(prev.map((m) => m.id));
          const seenTitles = new Set(prev.map((m) => m.title.toLowerCase()));
          return [
            ...prev,
            ...list.filter((m) => !seen.has(m.id) && !seenTitles.has(m.title.toLowerCase())),
          ];
        });
      } catch {
        if (id === reqId.current && !append) setMovies([]);
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
          setSearching(false);
        }
      }
    },
    []
  );

  // react to query / category changes
  useEffect(() => {
    setPage(1);
    load({ q: query.trim(), cat: category, page: 1, append: false });
  }, [query, category, load]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    load({ q: query.trim(), cat: category, page: next, append: true });
  }

  // Capture an incoming #movie= deep-link exactly once, before any effect can
  // mutate the hash. Using the captured value (not the live hash) avoids the
  // close→reopen race that made the modal flicker.
  const initialIdRef = useRef<string | null>(null);
  if (typeof window !== "undefined" && initialIdRef.current === null) {
    const m = window.location.hash.match(/#movie=([^&]+)/);
    initialIdRef.current = m ? decodeURIComponent(m[1]) : "";
  }

  // Open the deep-linked movie once, after the grid first loads.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current || movies.length === 0) return;
    deepLinkDone.current = true;
    const id = initialIdRef.current;
    if (id) {
      const found = movies.find((mv) => mv.id === id || mv.slug === id);
      if (found) setSelected(found);
    }
  }, [movies]);

  // Keep the URL hash in sync with the open modal (for shareable links).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selected) {
      history.replaceState(null, "", `#movie=${encodeURIComponent(selected.id)}`);
    } else if (window.location.hash.startsWith("#movie=")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [selected]);

  // Count a page view (once per mount) — real analytics.
  useEffect(() => {
    apiFetch("/api/track", { method: "POST" }).catch(() => {});
  }, []);

  // "/" focuses the search box (unless already typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (typing) return;
      e.preventDefault();
      document.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow">
              <PlayIcon className="ml-0.5 h-4 w-4" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Fre<span className="text-gradient">mo</span>
            </span>
          </a>
          <a
            href="/downloader"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-brand-400/40 hover:text-white"
          >
            <VideoIcon className="h-3.5 w-3.5 text-brand-400" /> Video Downloader
          </a>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              The newest movies, ready to download
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Watch the latest.
              <br />
              <span className="text-gradient">Download in seconds.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
              Fremo finds the freshest films & series and resolves a fast, direct download
              for you — no clutter, no chaos. Just search and grab.
            </p>
          </motion.div>

          <div className="mt-8">
            <SearchBar value={query} onChange={setQuery} loading={searching} />
          </div>

          {/* category filters (only when browsing) */}
          <AnimatePresence>
            {!isSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 flex flex-wrap justify-center gap-2"
              >
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      category === c.key
                        ? "bg-white text-ink-950 shadow"
                        : "border border-white/10 bg-white/5 text-white/60 hover:text-white"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="mb-5 flex items-center gap-2 text-sm text-white/50">
          <FilmIcon className="h-4 w-4 text-brand-400" />
          <span>
            {isSearch
              ? `Results for “${query.trim()}”`
              : CATEGORIES.find((c) => c.key === category)?.label || "Trending"}
          </span>
        </div>

        {loading ? (
          <GridSkeleton count={18} />
        ) : movies.length === 0 ? (
          <EmptyState search={isSearch} query={query} />
        ) : (
          <>
            <MovieGrid movies={movies} onOpen={setSelected} />

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Loading
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <AnalyticsFooter />

      <MovieModal movie={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function EmptyState({ search, query }: { search: boolean; query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-ink-850/50 py-20 text-center"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white/30">
        <FilmIcon className="h-8 w-8" />
      </span>
      <h3 className="mt-5 text-lg font-semibold text-white">
        {search ? `No matches for “${query.trim()}”` : "Nothing to show yet"}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-white/45">
        {search
          ? "Try a different spelling or a shorter title."
          : "We couldn't reach the catalogue right now. Please try again."}
      </p>
    </motion.div>
  );
}
