"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DownloadIcon, SearchIcon, FilmIcon, SparkIcon } from "./icons";

interface Stats {
  live: number;
  visitors: number;
  views: number;
  searches: number;
  downloads: number;
  subtitles: number;
  since?: string;
}

function useCountUp(target: number, run: boolean, duration = 1200) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (!run) return;
    const from = prev.current;
    const to = target;
    if (from === to) {
      setVal(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return val;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "k";
  return String(n);
}

function Stat({
  icon,
  label,
  value,
  run,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  run: boolean;
}) {
  const v = useCountUp(value, run);
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 text-center">
      <span className="mb-1 text-brand-400">{icon}</span>
      <span className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{fmt(v)}</span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</span>
    </div>
  );
}

export default function AnalyticsFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      apiFetch("/api/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setStats(d))
        .catch(() => {});
    pull();
    const id = setInterval(pull, 20_000); // refresh live count
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const s = stats || { live: 0, visitors: 0, views: 0, searches: 0, downloads: 0, subtitles: 0 };

  return (
    <footer className="relative border-t border-white/5 bg-ink-950/60">
      <div className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />
      <div ref={ref} className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-7 flex flex-col items-center gap-2 text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {s.live} watching right now
          </span>
          <h3 className="text-xl font-bold text-white">Fremo by the numbers</h3>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon={<SparkIcon className="h-5 w-5" />} label="Visitors" value={s.visitors} run={inView} />
          <Stat icon={<FilmIcon className="h-5 w-5" />} label="Page Views" value={s.views} run={inView} />
          <Stat icon={<SearchIcon className="h-5 w-5" />} label="Searches" value={s.searches} run={inView} />
          <Stat icon={<DownloadIcon className="h-5 w-5" />} label="Downloads" value={s.downloads} run={inView} />
          <Stat icon={<DownloadIcon className="h-5 w-5" />} label="Subtitles" value={s.subtitles} run={inView} />
        </div>

        <div className="mt-9 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-white/35 sm:flex-row">
          <p>
            Fre<span className="text-gradient font-semibold">mo</span> — discover &amp; download the
            latest, with English subtitles.
          </p>
          <p>Aggregates publicly listed titles. All files are hosted by third parties.</p>
        </div>
      </div>
    </footer>
  );
}
