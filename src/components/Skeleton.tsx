export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-ink-850">
      <div className="shimmer aspect-[2/3] w-full bg-white/[0.04]" />
      <div className="space-y-2 p-3">
        <div className="shimmer h-3.5 w-4/5 rounded bg-white/[0.05]" />
        <div className="shimmer h-3 w-2/5 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
