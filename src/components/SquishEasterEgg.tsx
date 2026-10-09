"use client";

import { useEffect, useRef, useState } from "react";

// The PXL RUNNER character, standing (13×25 pixels). Drawn in currentColor so it
// follows the footer's text color on both the dark and the light (Art) theme.
const GUY = [
  "0011111111100",
  "0111111111110",
  "1111111111111",
  "1111111111111",
  "1111111111111",
  "1111100111001",
  "1111110111101",
  "1111100111001",
  "1111111111111",
  "1111111000111",
  "1111111111111",
  "0001111111110",
  "1110111111110",
  "1110111111101",
  "1110111111101",
  "1110111111101",
  "1110111111101",
  "1110111111101",
  "1110111111101",
  "0000111000000",
  "0011110011100",
  "0011110011100",
  "0011110011100",
  "0111100011110",
  "0111100011110",
];
const GUY_PATH = GUY.flatMap((row, y) =>
  [...row].map((px, x) => (px === "1" ? `M${x} ${y}h1v1h-1z` : "")),
).join("");

/** A tiny pixel guy in the footer that opens the PXL RUNNER game (public/squish-run). */
export default function SquishEasterEgg() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // The game asks to close itself when Escape is pressed inside it.
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "squish-run:close") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
      trigger?.focus();
    };
  }, [open]);

  // Hand keyboard focus to the game so Space, W and S work straight away.
  const focusGame = () => {
    const win = frameRef.current?.contentWindow;
    win?.focus();
    win?.document.getElementById("c")?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Play PXL RUNNER"
        title="Psst. Click me."
        className="group inline-flex items-end text-fg-muted hover:text-accent transition-colors"
      >
        <svg
          viewBox="0 0 13 25"
          aria-hidden="true"
          shapeRendering="crispEdges"
          className="h-7 w-auto transition-transform duration-200 group-hover:-translate-y-1"
        >
          <path d={GUY_PATH} fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="PXL RUNNER"
          className="fixed inset-0 z-[100] flex flex-col bg-[#0c0d0e]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 md:px-6 font-mono text-xs uppercase tracking-widest text-[#8a8d90]">
            <span>You found PXL RUNNER</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[#f1f1ec] hover:text-accent-badge transition-colors"
            >
              Close (Esc)
            </button>
          </div>
          <iframe
            ref={frameRef}
            src="/squish-run/index.html"
            title="PXL RUNNER"
            onLoad={focusGame}
            allow="autoplay"
            className="w-full flex-1 border-0"
          />
        </div>
      )}
    </>
  );
}
