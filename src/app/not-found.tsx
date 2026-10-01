import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#07090D] px-6">
      <div className="text-center">
        {/* Glow orb */}
        <div className="mx-auto mb-8 size-28 rounded-full bg-gradient-to-b from-[#39FF14]/20 via-[#39FF14]/5 to-transparent blur-2xl" />

        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#39FF14]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#F5F7FA] sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#A7AFBC] max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#39FF14] px-5 py-2.5 text-sm font-semibold text-[#07090D] shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all hover:shadow-[0_0_30px_rgba(57,255,20,0.5)]"
          >
            Go Home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-[#A7AFBC] transition-colors hover:text-white hover:border-white/20"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
