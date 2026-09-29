"use client";

import { useEffect, useRef, useState } from "react";
import { createInkSmear, type InkSmear } from "@/lib/ink-smear";

function pickTwo(images: string[]): [string, string] {
  const i = Math.floor(Math.random() * images.length);
  let j = Math.floor(Math.random() * (images.length - 1));
  if (j >= i) j++;
  return [images[i], images[j]];
}

/**
 * Full-width hero image that smears under the cursor to reveal a second one
 * underneath. Which two of `images` play that role is picked at random each
 * time the page loads. The plain <img> is what everyone sees if WebGL is
 * unavailable or the user prefers reduced motion.
 */
export default function TreatmentSmear({
  images,
  alt,
}: {
  /** Pass a stable, module-level array — a new array identity each render repicks the pair. */
  images: string[];
  alt: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [[base, reveal]] = useState(() => pickTwo(images));

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const abort = new AbortController();
    let smear: InkSmear | null = null;

    createInkSmear(canvas, {
      image: { base, reveal, focusY: 0.5 },
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
  }, [base, reveal]);

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
