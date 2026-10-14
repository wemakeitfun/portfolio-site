"use client";

import { useEffect, useRef, useState } from "react";

const CODE = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
const DURATION_MS = 10000;
const BAR_COLORS = ["#00ffff", "#ff004e", "#d7ff3f", "#ffffff"];

type Bar = { id: number; top: number; height: number; shift: number; color: string };

/**
 * Konami code (↑ ↑ ↓ ↓ ← → ← → B A) flips the site into an alternate art direction for a
 * few seconds: hot-pink ground, scanlines, split-colour headings, a pixel trail on the
 * cursor, and a glitch burst at each end. The recolour is just the site's colour tokens
 * swapped by a class on <html> (see globals.css), so every page picks it up. Reduced-motion
 * visitors get the recolour only — no flashing bars, jitter, or trail.
 */
export default function KonamiGlitch() {
  const [on, setOn] = useState(false);
  const [bars, setBars] = useState<Bar[]>([]);
  const trail = useRef<HTMLDivElement>(null);
  const typed = useRef<string[]>([]);
  const active = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let burstTimer: ReturnType<typeof setInterval> | undefined;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    let burstStop: ReturnType<typeof setTimeout> | undefined;

    const burst = (ms: number) => {
      if (reduced) return;
      clearInterval(burstTimer);
      clearTimeout(burstStop);
      let n = 0;
      const frame = () =>
        setBars(
          Array.from({ length: 7 }, () => ({
            id: n++,
            top: Math.random() * 100,
            height: 1 + Math.random() * 9,
            shift: (Math.random() - 0.5) * 12,
            color: BAR_COLORS[Math.floor(Math.random() * BAR_COLORS.length)],
          })),
        );
      frame();
      // Three changes a second at most: faster flashing over this much of the screen is a
      // photosensitivity risk (WCAG 2.3.1), reduced-motion setting or not.
      burstTimer = setInterval(frame, 340);
      burstStop = setTimeout(() => {
        clearInterval(burstTimer);
        setBars([]);
      }, ms);
    };

    const start = () => {
      active.current = true;
      document.documentElement.classList.add("konami");
      setOn(true);
      burst(600);
      endTimer = setTimeout(stop, DURATION_MS);
    };

    const stop = () => {
      active.current = false;
      burst(500);
      document.documentElement.classList.remove("konami");
      setOn(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || active.current) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.repeat) return;
      // Compare the last 10 keys, so a stray extra ↑ before the code doesn't break it.
      typed.current = [...typed.current, e.key.toLowerCase()].slice(-CODE.length);
      if (typed.current.join() === CODE.join()) {
        typed.current = [];
        start();
      }
    };

    let last = 0;
    const onMove = (e: PointerEvent) => {
      if (!active.current || reduced || !trail.current) return;
      const now = performance.now();
      if (now - last < 35) return;
      last = now;
      const dot = document.createElement("div");
      dot.className = "konami-dot";
      dot.style.left = `${Math.round(e.clientX / 8) * 8}px`;
      dot.style.top = `${Math.round(e.clientY / 8) * 8}px`;
      dot.style.background = BAR_COLORS[Math.floor(Math.random() * BAR_COLORS.length)];
      dot.addEventListener("animationend", () => dot.remove());
      trail.current.appendChild(dot);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      clearInterval(burstTimer);
      clearTimeout(burstStop);
      clearTimeout(endTimer);
      document.documentElement.classList.remove("konami");
    };
  }, []);

  return (
    <>
      <div ref={trail} aria-hidden className="pointer-events-none fixed inset-0 z-[9997]" />
      {on && <div aria-hidden className="konami-scan pointer-events-none fixed inset-0 z-[9998]" />}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
        {bars.map((b) => (
          <div
            key={b.id}
            className="absolute inset-x-0"
            style={{
              top: `${b.top}%`,
              height: `${b.height}%`,
              background: b.color,
              transform: `translateX(${b.shift}%)`,
              mixBlendMode: "difference",
            }}
          />
        ))}
      </div>
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-[#0a0a0b] px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-[#d7ff3f] transition-opacity duration-300 ${
          on ? "opacity-100" : "opacity-0"
        }`}
      >
        {on ? "↑↑↓↓←→←→BA — you found it" : ""}
      </div>
    </>
  );
}
