"use client";

import { useEffect, useRef, useState } from "react";
import DeckDetail from "./DeckDetail";

export type DeckItem = {
  /** Public URL of the deck's bottom graphic. */
  src: string;
  /** Shown under the centre deck (from the image's caption in the admin). */
  name: string;
  /** The admin section label this deck came from, shown as an eyebrow. */
  section: string | null;
};

/**
 * One long, scroll-pinned 3D deck rack. The page pins while you scroll through it,
 * moving one deck per scroll step; the deck in the middle turns to face you.
 * three.js is loaded only on pages that use this component.
 */
export default function DeckRack({ items }: { items: DeckItem[] }) {
  const pin = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLParagraphElement>(null);
  const name = useRef<HTMLHeadingElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const progress = useRef<HTMLElement>(null);
  const rack = useRef<{ goTo: (i: number, smooth?: boolean) => void; pauseKeys: (p: boolean) => void; destroy: () => void } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  // Remount only when the decks themselves change.
  const key = items.map((i) => `${i.src}|${i.name}|${i.section}`).join("\n");

  useEffect(() => {
    let cancelled = false;
    import("./engine/mountRack.js").then(({ mountRack }) => {
      if (cancelled) return;
      rack.current = mountRack(
        {
          pin: pin.current!,
          sticky: sticky.current!,
          stage: stage.current!,
          caption: caption.current!,
          section: section.current!,
          name: name.current!,
          count: count.current!,
          progress: progress.current!,
        },
        items.map((i) => ({ name: i.name, graphic: i.src, section: i.section })),
        { onSelect: setOpen },
      );
    });
    return () => {
      cancelled = true;
      rack.current?.destroy();
      rack.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => rack.current?.pauseKeys(open !== null), [open]);

  if (items.length === 0) return null;

  return (
    <section ref={pin} className="relative">
      <div ref={sticky} className="sticky top-0 h-screen overflow-hidden">
        {/* soft spotlight: the wall darkens gently away from the centre deck, fading out
            at the top and bottom so the rack blends into the page */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 46% 58% at 50% var(--spot-y, 42%), transparent 45%, rgba(0,0,0,var(--spot, 0.07)) 100%)",
            maskImage: "linear-gradient(transparent, black 18%, black 82%, transparent)",
            WebkitMaskImage: "linear-gradient(transparent, black 18%, black 82%, transparent)",
          }}
        />
        <div ref={stage} className="absolute inset-0 touch-pan-y [&>canvas]:block" />
        <div
          ref={caption}
          className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-2 px-6 text-center"
        >
          <p ref={section} className="font-mono text-xs uppercase tracking-widest text-fg-muted" />
          <h2 ref={name} className="font-display text-4xl md:text-5xl tracking-wide leading-none" />
          <p className="font-mono text-[11px] md:text-xs uppercase tracking-widest text-fg-muted">
            <span ref={count} />
            <span className="hidden sm:inline"> · Scroll or drag</span> · Click to explore
          </p>
        </div>
        <div className="absolute bottom-7 left-1/2 h-0.5 w-[min(320px,60vw)] -translate-x-1/2 overflow-hidden rounded-full bg-border">
          <i ref={progress} className="absolute inset-0 origin-left scale-x-0 bg-fg" />
        </div>
      </div>
      {open !== null && (
        <DeckDetail
          items={items}
          index={open}
          onIndex={(i) => {
            setOpen(i);
            rack.current?.goTo(i, false); // keep the rack in step, so closing returns to this deck
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
