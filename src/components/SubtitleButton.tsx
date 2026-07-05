"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DownloadIcon, CheckIcon } from "./icons";
import { apiFetch } from "@/lib/api";

type State = "checking" | "available" | "none";

export default function SubtitleButton({
  title,
  downloadPage,
}: {
  title: string;
  downloadPage?: string;
}) {
  const [state, setState] = useState<State>("checking");
  const [fileName, setFileName] = useState<string>("");
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setState("checking");
    const params = new URLSearchParams({ title, check: "1" });
    if (downloadPage) params.set("page", downloadPage);
    apiFetch(`/api/subtitle?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (id !== reqId.current) return;
        if (d.found) {
          setFileName(d.fileName || "");
          setState("available");
        } else setState("none");
      })
      .catch(() => id === reqId.current && setState("none"));
  }, [title, downloadPage]);

  const downloadHref = (() => {
    const params = new URLSearchParams({ title });
    if (downloadPage) params.set("page", downloadPage);
    return `/api/subtitle?${params.toString()}`;
  })();

  if (state === "checking") {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        Finding English subtitle…
      </div>
    );
  }

  if (state === "none") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-xs text-white/35">
        No English subtitle found for this title yet.
      </div>
    );
  }

  return (
    <motion.a
      href={downloadHref}
      download={fileName || true}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.12]"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/20 text-sky-300">
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      Download English Subtitle
      <span className="inline-flex items-center gap-1 text-xs text-white/45">
        <DownloadIcon className="h-3.5 w-3.5" /> .srt
      </span>
    </motion.a>
  );
}
