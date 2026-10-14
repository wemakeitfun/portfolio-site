"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The homepage's looping background reel. It's decorative, so the video itself is hidden
 * from assistive tech, but moving content that runs for more than a few seconds needs a way
 * to stop it (WCAG 2.2.2) — hence the pause button — and it doesn't start for visitors who
 * ask their system to reduce motion.
 */
export default function HeroReel() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause();
  }, []);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  return (
    <>
      <video
        ref={ref}
        src="/hero/reel.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        // A paused video may not have painted a frame yet; nudge it so the box isn't blank.
        onLoadedData={(e) => {
          if (e.currentTarget.paused) e.currentTarget.currentTime = 0.01;
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause background video" : "Play background video"}
        className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg/70 text-fg backdrop-blur-sm transition-colors hover:text-accent"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
          {playing ? (
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          ) : (
            <path d="M8 5.5v13l11-6.5z" />
          )}
        </svg>
      </button>
    </>
  );
}
