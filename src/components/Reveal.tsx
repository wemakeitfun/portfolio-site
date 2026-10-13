"use client";

import { useEffect, useRef } from "react";

/**
 * Fades its children up into place the first time they scroll into view. The hidden
 * state is plain CSS (.reveal in globals.css), so it's in the server-rendered HTML and
 * there's no flash of visible-then-hidden; the observer only flips a data attribute.
 * Reduced-motion users and no-JS visitors see everything immediately (see globals.css
 * and the <noscript> in the root layout).
 */
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Extra ms before this one fades in, to stagger items that enter together. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.shown = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        // Already scrolled past (e.g. a reload restored a mid-page position): nothing to animate.
        if (entries.some((e) => e.isIntersecting || e.boundingClientRect.top < 0)) {
          el.dataset.shown = "true";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
