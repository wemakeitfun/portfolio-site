"use client";

import { useMemo, useState } from "react";
import { mediaUrl, type MediaRow } from "@/lib/media";
import ProjectMedia from "./ProjectMedia";

/**
 * A single stable frame that click-advances through `items` (images and/or
 * videos), looping back to the first after the last. The frame's shape is
 * locked to the first item's aspect ratio and never changes size — later items
 * with different proportions letterbox inside it (via `object-contain`) instead
 * of resizing the frame, which is what keeps switching between them feeling
 * seamless rather than jumpy.
 *
 * The neighboring image on each side is preloaded (a hidden <img> with the same
 * URL forces the browser to fetch and cache it) so a click usually just swaps in
 * an already-loaded image instead of visibly waiting on a network fetch. Images
 * here bypass next/image and use the raw file directly — next/image would
 * request a differently-shaped optimizer URL than the plain one being
 * preloaded, so the preload would warm the wrong cache entry and do nothing.
 * Videos aren't preloaded this way — that would mean fetching the whole file.
 */
export default function MediaSlideshow({
  items,
  sizes,
  widthPercent = 100,
}: {
  items: MediaRow[];
  sizes: string;
  widthPercent?: 25 | 50 | 75 | 100;
}) {
  const [index, setIndex] = useState(0);

  const preload = useMemo(() => {
    if (items.length < 2) return [];
    const next = items[(index + 1) % items.length];
    const prev = items[(index - 1 + items.length) % items.length];
    const seen = new Set<string>();
    return [next, prev].filter((m) => {
      if (m.kind !== "image" || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [items, index]);

  if (items.length === 0) return null;
  const current = items[index];
  const frame = items[0];

  function advance() {
    setIndex((i) => (i + 1) % items.length);
  }
  function back() {
    setIndex((i) => (i - 1 + items.length) % items.length);
  }

  return (
    <div style={{ maxWidth: `${widthPercent}%` }} className="mx-auto">
      {/* Fetches + caches the two neighboring images ahead of time; never shown. */}
      {preload.map((m) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.id} src={mediaUrl(m.path)} alt="" aria-hidden className="hidden" />
      ))}

      <div
        role="button"
        tabIndex={0}
        aria-label={`Showing ${index + 1} of ${items.length}. Click, or press Enter, for the next one.`}
        onClick={advance}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            advance();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            advance();
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            back();
          }
        }}
        className="relative w-full max-h-[75vh] cursor-pointer select-none overflow-hidden rounded-2xl border border-border bg-bg-elevated"
        style={{ aspectRatio: frame.width && frame.height ? `${frame.width} / ${frame.height}` : "16 / 9" }}
      >
        {/* key remounts this on every index change, retriggering the fade-in */}
        <div key={current.id} className="animate-fade-in absolute inset-0">
          {current.kind === "image" ? (
            // Same raw URL the preloader above fetches — that's what makes the
            // preload actually pay off as a cache hit when this swaps in.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(current.path)}
              alt={current.alt ?? ""}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <ProjectMedia media={current} sizes={sizes} fit="contain" />
          )}
        </div>

        {items.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-bg/70 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-fg backdrop-blur-sm">
            {index + 1} / {items.length}
          </div>
        )}
      </div>
      {current.alt && (
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-fg-muted">{current.alt}</p>
      )}
    </div>
  );
}
