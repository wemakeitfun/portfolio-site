import Link from "next/link";

// Grainy, tileable noise texture — a data URI so this page has no image
// dependency and never has a loading flash.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Pure CSS (no WebGL) on purpose — this is the page that renders when
 * something else already went wrong, so it shouldn't have a way to fail itself.
 */
export default function NotFound() {
  return (
    <div className="pt-32">
      <div className="relative flex min-h-[70svh] items-center justify-center overflow-hidden px-6 text-center">
        <style>{`
          @keyframes blob-drift-a {
            0%, 100% { transform: translate(-8%, -6%) scale(1); }
            50% { transform: translate(10%, 8%) scale(1.2); }
          }
          @keyframes blob-drift-b {
            0%, 100% { transform: translate(8%, 10%) scale(1.05); }
            50% { transform: translate(-10%, -8%) scale(1.25); }
          }
        `}</style>

        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: "-15%",
            top: "-15%",
            width: "65vw",
            height: "65vw",
            background: "var(--color-accent)",
            opacity: 0.5,
            filter: "blur(110px)",
            animation: "blob-drift-a 18s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            right: "-15%",
            bottom: "-15%",
            width: "55vw",
            height: "55vw",
            background: "var(--color-fg)",
            opacity: 0.16,
            filter: "blur(110px)",
            animation: "blob-drift-b 22s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: GRAIN, opacity: 0.07 }}
        />

        <div className="relative z-10 flex flex-col items-center">
          <h1 className="font-display text-[28vw] leading-[0.85] tracking-tight text-fg md:text-[14vw]">
            404
          </h1>
          <p className="mt-2 max-w-sm font-mono text-xs uppercase tracking-widest text-fg-muted md:text-sm">
            Lost between concept and cut.
          </p>
          <Link
            href="/"
            className="group relative mt-10 inline-flex items-center gap-2 overflow-hidden rounded-full border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest"
          >
            <span className="relative z-10 transition-colors duration-300 group-hover:text-bg">
              Go back home
            </span>
            <span className="absolute inset-0 origin-left scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}
