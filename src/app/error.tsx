"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="bg-aurora flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="glass max-w-md rounded-3xl p-8">
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/55">
          We hit a snag loading this. Give it another try.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-glow"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
