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
  captionClassName = "font-mono text-xs uppercase tracking-widest text-fg",
  overlayText,
}: {
  base: string;
  reveal: string;
  alt: string;
  caption?: string;
  captionClassName?: string;
  /** Baked into the photo itself (centered), so smearing it fades the text away to reveal the X-ray beneath. */
  overlayText?: { value: string; color?: string };
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
    const theme = getComputedStyle(document.documentElement);

    createInkSmear(canvas, {
      image: {
        base,
        reveal,
        focusY: 0.25,
        text: overlayText
          ? {
              value: overlayText.value,
              font: theme.getPropertyValue("--font-bebas").trim() || "sans-serif",
              color: overlayText.color || theme.getPropertyValue("--accent").trim() || "#d7ff3f",
            }
          : undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitives, not the object identity
  }, [base, reveal, overlayText?.value, overlayText?.color]);

  return (
    <section ref={rootRef} className="group relative h-[85svh] min-h-[420px] w-full overflow-hidden bg-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={base} alt={alt} className="absolute inset-0 h-full w-full object-cover object-[50%_25%]" />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="invisible absolute inset-0 h-full w-full touch-pan-y group-data-[ready=true]:visible"
      />
      {/* Real text for screen readers and the no-WebGL/reduced-motion fallback; hidden once the canvas takes over. */}
      {overlayText && (
        <p
          className="absolute inset-0 flex items-center justify-center px-6 text-center font-display text-[12vw] tracking-wide sm:text-6xl group-data-[ready=true]:sr-only"
          style={{ color: overlayText.color || "var(--accent)" }}
        >
          {overlayText.value}
        </p>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      {caption && (
        <p className={`pointer-events-none absolute bottom-8 left-6 md:left-10 ${captionClassName}`}>
          {caption}
        </p>
      )}
    </section>
  );
}
