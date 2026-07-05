"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SearchIcon, CloseIcon } from "./icons";

export default function SearchBar({
  value,
  onChange,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  loading?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // keep in sync if cleared from outside
  useEffect(() => setLocal(value), [value]);

  // debounce upward
  useEffect(() => {
    const id = setTimeout(() => {
      if (local !== value) onChange(local.trim());
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative mx-auto w-full max-w-2xl"
    >
      <div className="glass group flex items-center gap-3 rounded-2xl px-4 py-3 shadow-card transition focus-within:border-brand-400/50 focus-within:shadow-glow">
        <span className="text-white/50">
          {loading ? (
            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
          ) : (
            <SearchIcon className="h-5 w-5" />
          )}
        </span>
        <input
          ref={inputRef}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onChange(local.trim())}
          placeholder="Search movies & series — e.g. Killhouse, Avatar…"
          className="w-full bg-transparent text-[15px] text-white placeholder-white/35 outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {local && (
          <button
            onClick={() => {
              setLocal("");
              onChange("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Clear"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
