"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DeckItem } from "./DeckRack";

type Engine = { show: (i: number, direction?: number) => void; setFace: (f: "graphic" | "grip") => void; destroy: () => void };

const FADE_MS = 320;

/**
 * Full-screen detail view for one deck: blurred page behind, the deck large in the
 * middle, Graphic/Grip flip, drag to spin, prev/next, and Esc / ✕ / click outside to close.
 */
export default function DeckDetail({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: DeckItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const shownIndex = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [face, setFace] = useState<"graphic" | "grip">("graphic");
  const closing = useRef(false);
  const N = items.length;

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setVisible(false);
    setTimeout(onClose, FADE_MS);
  };
  // read the latest index from a ref so rapid clicks each advance one deck
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);
  const step = (d: number) => {
    indexRef.current = (indexRef.current + d + N) % N;
    onIndex(indexRef.current);
  };

  // mount the 3D view once
  useEffect(() => {
    let cancelled = false;
    import("./engine/detail.js").then(({ mountDetail }) => {
      if (cancelled || !stage.current) return;
      engine.current = mountDetail(
        stage.current,
        items.map((i) => ({ name: i.name, graphic: i.src })),
        { onFace: setFace, onBackgroundClick: close },
      );
      engine.current.show(index);
      shownIndex.current = index;
    });
    requestAnimationFrame(() => setVisible(true));
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      cancelled = true;
      engine.current?.destroy();
      engine.current = null;
      root.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // switch decks, swinging in from the direction of travel
  useEffect(() => {
    const prev = shownIndex.current;
    if (!engine.current || prev === null || prev === index) return;
    const forward = (index - prev + N) % N <= N / 2; // shortest way round, so wrapping 12 → 1 counts as forward
    engine.current.show(index, forward ? 1 : -1);
    shownIndex.current = index;
  }, [index, N]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const item = items[index];
  const pickFace = (f: "graphic" | "grip") => {
    setFace(f);
    engine.current?.setFace(f);
  };

  const btn =
    "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg/70 text-fg backdrop-blur transition-colors hover:bg-fg hover:text-bg";

  // portal to <body>: the page-transition wrapper's transform would otherwise trap position: fixed
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      className="fixed inset-0 z-[100] transition-opacity ease-out motion-reduce:transition-none"
      style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
    >
      {/* the page (and rack) behind blurs and fades back */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-xl" />
      <div ref={stage} className="absolute inset-0 touch-none [&>canvas]:block" />

      <p className="pointer-events-none absolute left-6 top-6 font-mono text-xs uppercase tracking-widest text-fg-muted md:left-10 md:top-8">
        {String(index + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
      </p>
      <button type="button" onClick={close} aria-label="Close" className={`${btn} absolute right-5 top-5 md:right-8 md:top-6`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {N > 1 && (
        <>
          <button type="button" onClick={() => step(-1)} aria-label="Previous deck" className={`${btn} absolute left-4 top-1/2 -translate-y-1/2 md:left-10`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next deck" className={`${btn} absolute right-4 top-1/2 -translate-y-1/2 md:right-10`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-6 text-center md:bottom-8">
        {item.section && <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">{item.section}</p>}
        <h2 key={index} className="deck-swap font-display text-4xl leading-none tracking-wide md:text-6xl">
          {item.name}
        </h2>
        <div className="pointer-events-auto mt-1 flex rounded-full border border-border bg-bg/70 p-1 font-mono text-xs uppercase tracking-widest backdrop-blur">
          {(["graphic", "grip"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => pickFace(f)}
              aria-pressed={face === f}
              className={`rounded-full px-4 py-2 transition-colors ${face === f ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
            >
              {f === "graphic" ? "Graphic" : "Grip"}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-fg-muted">Drag to spin</p>
      </div>
    </div>,
    document.body,
  );
}
