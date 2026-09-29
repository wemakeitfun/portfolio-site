"use client";

import { useEffect, useRef } from "react";
import { createInkSmear, type InkSmear } from "@/lib/ink-smear";

/**
 * Full-width hero image that smears under the cursor to reveal the next one
 * in `pool` (shuffle-bag: every image shown once before any repeat). Always
 * starts on `base`. The plain <img> is what everyone sees if WebGL is
 * unavailable or the user prefers reduced motion.
 */
export default function TreatmentSmear({
  base,
  pool,
  alt,
}: {
  base: string;
  /** Cycled through in random order (no immediate repeat) as the image keeps getting smeared. Pass a stable, module-level array — a new array identity each render restarts the effect. */
  pool: string[];
  alt: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const abort = new AbortController();
    let smear: InkSmear | null = null;

    createInkSmear(canvas, {
      image: {
        base,
        reveal: pool[0],
        pool: pool.slice(1),
        focusY: 0.5,
      },
      signal: abort.signal,
    }).then((s) => {
      if (abort.signal.aborted) return s?.destroy();
      smear = s;
      if (s) root.dataset.ready = "true";
    });

    return () => {
      abort.abort();
      smear?.destroy();
      delete root.dataset.ready;
    };
  }, [base, pool]);

  return (
    <section
      ref={rootRef}
      className="group relative aspect-[16/9] w-full overflow-hidden bg-bg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={base}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover group-data-[ready=true]:sr-only"
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="invisible absolute inset-0 h-full w-full touch-pan-y group-data-[ready=true]:visible"
      />
    </section>
  );
}
