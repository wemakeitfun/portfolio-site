"use client";

import { useEffect, useRef } from "react";
import { Anton } from "next/font/google";
import { createInkSmear, type InkSmear } from "@/lib/ink-smear";

const anton = Anton({ subsets: ["latin"], weight: "400" });

/**
 * Full-screen name that smears under the cursor and settles back.
 * The <h1> is the real text: it's what screen readers get, and what everyone sees
 * if WebGL is unavailable or the user prefers reduced motion.
 */
export default function NameSmear({
  text = "Adam Kahn",
  ink,
  paper,
  treatments,
}: {
  text?: string;
  /** CSS colors. Default to the site's --accent and --bg. */
  ink?: string;
  paper?: string;
  /** If given, the settled form cycles to the next one each time you start a new smear. */
  treatments?: { ink: string; mode?: "fill" | "outline" }[];
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
      text: text.toUpperCase(),
      font: anton.style.fontFamily,
      ink: ink ?? (theme.getPropertyValue("--accent").trim() || "#d7ff3f"),
      paper: paper ?? (theme.getPropertyValue("--bg").trim() || "#0a0a0b"),
      treatments,
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
  }, [text, ink, paper, treatments]);

  return (
    <section
      ref={rootRef}
      className="group relative h-svh min-h-[480px] w-full overflow-hidden bg-bg"
    >
      {/* pan-y: vertical swipes still scroll the page on touch; horizontal drags smear */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full touch-pan-y"
      />
      <h1
        className={`${anton.className} absolute inset-0 grid place-items-center text-center text-[19vw] uppercase leading-none text-accent group-data-[ready=true]:sr-only`}
      >
        {text}
      </h1>
    </section>
  );
}
