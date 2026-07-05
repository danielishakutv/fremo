import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-aurora flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="glass max-w-md rounded-3xl p-8">
        <p className="text-5xl font-extrabold text-gradient">404</p>
        <h1 className="mt-3 text-xl font-bold text-white">Page not found</h1>
        <p className="mt-2 text-sm text-white/55">That page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-glow"
        >
          Back to Fremo
        </Link>
      </div>
    </main>
  );
}
