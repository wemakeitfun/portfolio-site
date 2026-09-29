"use client";

import { useState } from "react";
import type { TimelineEntry } from "@/lib/about";

const PAGE_SIZE = 5;

export default function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = entries.slice(0, visible);
  const hasMore = visible < entries.length;

  return (
    <>
      <div className="flex flex-col">
        {shown.map((t, i) => (
          <div
            key={`${t.year}-${i}`}
            className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-10 py-8 ${
              i !== 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="font-mono text-sm text-accent w-24 shrink-0">{t.year}</span>
            <span className="font-display text-2xl md:text-3xl tracking-wide md:flex-1">
              {t.label}
            </span>
            <span className="text-fg-muted md:w-40 md:shrink-0">{t.detail}</span>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="group relative mt-10 inline-flex items-center gap-2 overflow-hidden rounded-full border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest"
        >
          <span className="relative z-10 transition-colors duration-300 group-hover:text-bg">
            Load more
          </span>
          <span className="absolute inset-0 origin-left scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100" />
        </button>
      )}
    </>
  );
}
