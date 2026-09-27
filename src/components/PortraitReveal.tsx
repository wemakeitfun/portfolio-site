"use client";

import { useEffect, useRef } from "react";
import { createInkSmear, type InkSmear } from "@/lib/ink-smear";

/**
 * Full-width portrait header. The cursor smears the photo, and wherever it has
 * been, the `reveal` image shows through before fading back. The plain <img> is
 * what everyone sees if WebGL is unavailable or the user prefers reduced motion.
 */
export default function PortraitReveal({
  base,
  reveal,
  alt,
  caption,
}: {
  base: string;
  reveal: string;
  alt: string;
  caption?: string;
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

    createInkSmear(canvas, { image: { base, reveal, focusY: 0.25 }, signal: abort.signal }).then((s) => {
      if (abort.signal.aborted) return s?.destroy();
      smear = s;
      if (s) root.dataset.ready = "true";
    });

    return () => {
      abort.abort();
      smear?.destroy();
      delete root.dataset.ready;
    };
  }, [base, reveal]);

  return (
    <section ref={rootRef} className="group relative h-[85svh] min-h-[420px] w-full overflow-hidden bg-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={base} alt={alt} className="absolute inset-0 h-full w-full object-cover object-[50%_25%]" />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="invisible absolute inset-0 h-full w-full touch-pan-y group-data-[ready=true]:visible"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      {caption && (
        <p className="pointer-events-none absolute bottom-8 left-6 font-mono text-xs uppercase tracking-widest text-fg md:left-10">
          {caption}
        </p>
      )}
    </section>
  );
}
