"use client";

import type { Movie } from "@/lib/types";
import MovieCard from "./MovieCard";

export default function MovieGrid({
  movies,
  onOpen,
}: {
  movies: Movie[];
  onOpen: (m: Movie) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {movies.map((m, i) => (
        <MovieCard key={m.id} movie={m} index={i} onOpen={onOpen} />
      ))}
    </div>
  );
}
