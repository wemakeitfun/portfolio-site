"use client";

import { useEffect, useRef, useState } from "react";

// Some callers nest this inside a <Link> (card thumbnails). stopPropagation alone
// keeps Next's router from intercepting the click, but the browser still runs the
// anchor's own native "follow this href" behavior unless preventDefault is called
// too — so every click handler here calls both.
const stopClick = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};
// Pointerdown only needs stopPropagation — preventDefault here would block the
// browser's native drag-tracking on the volume slider's thumb.
const stopPointerDown = (e: React.SyntheticEvent) => e.stopPropagation();

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
    </svg>
  );
}

/**
 * A plain div-based slider rather than <input type="range">. A native range
 * input's own "jump to click position" behavior is itself a default action tied
 * to the same click event as the anchor's navigation — preventDefault() cancels
 * both together, so there's no way to keep one and block the other. Building the
 * drag/click math ourselves sidesteps that: nothing here depends on a browser
 * default action, so it's safe to fully stop every event.
 */
function VolumeSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function valueAt(clientX: number) {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    onChange(valueAt(e.clientX));
    // Capture so dragging outside the track still tracks; if the browser refuses
    // (no real active pointer behind this id), the click-to-set above still stands.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // no-op
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    onChange(valueAt(e.clientX));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, value - 0.1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(1, value + 0.1));
    }
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopPointerDown}
      onClick={stopClick}
      onKeyDown={onKeyDown}
      className="flex h-7 w-14 shrink-0 cursor-pointer items-center sm:w-20"
    >
      <div className="relative h-1 w-full rounded-full bg-fg/25">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value * 100}%` }} />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `calc(${value * 100}% - 5px)` }}
        />
      </div>
    </div>
  );
}

function VolumeIcon({ muted, level, className }: { muted: boolean; level: number; className?: string }) {
  const silent = muted || level === 0;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {silent ? (
        <path d="m16 9 5 6M21 9l-5 6" />
      ) : (
        <>
          <path d="M15.3 8.5a5 5 0 0 1 0 7" opacity={level > 0.1 ? 1 : 0} />
          <path d="M18 6a9 9 0 0 1 0 12" opacity={level > 0.6 ? 1 : 0} />
        </>
      )}
    </svg>
  );
}

export default function VideoPlayer({
  src,
  className = "",
  fit = "cover",
  autoplay = false,
}: {
  src: string;
  className?: string;
  fit?: "cover" | "contain";
  /** Plays muted and looping while at least ~40% on screen; pauses when scrolled away. */
  autoplay?: boolean;
}) {
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(autoplay);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolumeChange = () => {
      setMuted(v.muted);
      setVolume(v.volume);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolumeChange);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolumeChange);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoplay) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [autoplay]);

  function togglePlay(e: React.SyntheticEvent) {
    stopClick(e);
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function toggleMute(e: React.SyntheticEvent) {
    stopClick(e);
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
  }

  function setVolumeLevel(value: number) {
    const v = videoRef.current;
    if (!v) return;
    v.volume = value;
    v.muted = value === 0;
  }

  const iconBtn = "grid h-7 w-7 shrink-0 place-items-center rounded-full text-fg transition-colors hover:text-accent";

  return (
    <div className={`absolute inset-0 ${className}`} onClick={stopClick} onPointerDown={stopPointerDown}>
      <video
        ref={videoRef}
        src={src}
        loop
        muted={autoplay}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        className={`absolute inset-0 h-full w-full cursor-pointer ${fitClass}`}
      />

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="group absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-bg/80 text-fg backdrop-blur-sm transition-transform group-hover:scale-105">
            <PlayIcon className="h-5 w-5 translate-x-0.5" />
          </span>
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-6">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className={iconBtn}
        >
          {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4 translate-x-0.5" />}
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          className={iconBtn}
        >
          <VolumeIcon muted={muted} level={volume} className="h-4 w-4" />
        </button>
        <VolumeSlider value={muted ? 0 : volume} onChange={setVolumeLevel} />
      </div>
    </div>
  );
}
