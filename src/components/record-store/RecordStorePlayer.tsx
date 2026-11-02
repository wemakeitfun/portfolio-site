"use client";

import { useEffect, useRef, useState } from "react";

export type StoreTrack = { id: string; src: string; title: string };

type Clip = "browse" | "walk" | "needle" | "listen" | "flip-up" | "flip-down";

const CLIPS: { name: Clip; loop: boolean; speed: number }[] = [
  { name: "browse", loop: true, speed: 1 },
  { name: "walk", loop: false, speed: 1.75 },
  { name: "needle", loop: false, speed: 1.75 },
  { name: "listen", loop: true, speed: 1 },
  { name: "flip-up", loop: false, speed: 3 },
  { name: "flip-down", loop: false, speed: 3 },
];

// How far into each clip the needle reaches the record, which is when the sound starts.
// These are positions in the clip itself, so they hold at any playback speed.
const NEEDLE_SECONDS: Partial<Record<Clip, number>> = { needle: 2.3, "flip-down": 3 };
// The record turns over in the first moments of flip-down, too fast to read at full speed.
const FLIP_TURN_SECONDS = 0.9;
const FLIP_TURN_SPEED = 1.5;
// Clips join on the same pose but not the same pixels, so a short fade hides the difference.
const FADE_MS = 150;

function trackNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function formatTime(seconds: number) {
  const whole = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M6 5v14l10-7zM17 5h2.5v14H17z" />
    </svg>
  );
}

function VolumeIcon({ silent }: { silent: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {silent ? (
        <path d="m16 9 5 6M21 9l-5 6" />
      ) : (
        <path d="M15.3 8.5a5 5 0 0 1 0 7M18 6a9 9 0 0 1 0 12" />
      )}
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
    </svg>
  );
}

/**
 * The record store scene as a small state machine: a click only ever sets which track is
 * wanted, and the clips decide when it starts. Every clip begins and ends on the shelf pose or
 * the turntable pose, so any clip can follow any other. The ad's own video supplies the sound
 * and sits beside the scene as its artwork. Nothing loads until the visitor scrolls near.
 */
export default function RecordStorePlayer({ tracks }: { tracks: StoreTrack[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clipsRef = useRef<Partial<Record<Clip, HTMLVideoElement>>>({});
  const adRef = useRef<HTMLVideoElement>(null);
  const clipRef = useRef<Clip>("browse");
  const layerRef = useRef(1);
  const wantedRef = useRef<number | null>(null);
  const needleDownRef = useRef(false);
  const restartRef = useRef(false);
  const onScreenRef = useRef(false);
  const stillRef = useRef(false);
  const mutedRef = useRef(false);
  const [isNear, setIsNear] = useState(false);
  const [wanted, setWanted] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    stillRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsNear(true);
      },
      { rootMargin: "400px" },
    );
    // The scene only runs while it's on screen, unless an ad is playing.
    const visible = new IntersectionObserver(([entry]) => {
      onScreenRef.current = entry.isIntersecting;
      const clip = clipsRef.current[clipRef.current];
      if (!clip || stillRef.current) return;
      if (entry.isIntersecting) void clip.play().catch(() => undefined);
      else if (adRef.current?.paused !== false) clip.pause();
    });
    near.observe(root);
    visible.observe(root);
    return () => {
      near.disconnect();
      visible.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isNear && onScreenRef.current && !stillRef.current) {
      void clipsRef.current.browse?.play().catch(() => undefined);
    }
  }, [isNear]);

  // The first ad's length can arrive before React hydrates, which would miss the event.
  useEffect(() => {
    const ad = adRef.current;
    if (ad && ad.readyState >= 1) setDuration(ad.duration || 0);
  }, []);

  // Browsers can stop muted video in a hidden tab and leave it stopped on return. An ad that
  // was paused on purpose stays paused, so the listening loop waits for it.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible" || !onScreenRef.current || stillRef.current) return;
      if (clipRef.current === "listen" && adRef.current?.paused) return;
      void clipsRef.current[clipRef.current]?.play().catch(() => undefined);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Only one thing with sound at a time. "play" doesn't bubble, hence the capture phase.
  useEffect(() => {
    function onAnyPlay(event: Event) {
      const media = event.target;
      const ad = adRef.current;
      if (!ad || !(media instanceof HTMLMediaElement) || media.muted || media === ad) return;
      ad.pause();
      clipsRef.current[clipRef.current]?.pause();
      setIsPaused(true);
    }
    document.addEventListener("play", onAnyPlay, true);
    return () => document.removeEventListener("play", onAnyPlay, true);
  }, []);

  function playClip(name: Clip) {
    const previous = clipsRef.current[clipRef.current];
    const next = clipsRef.current[name];
    if (!next) return;
    needleDownRef.current = false;
    restartRef.current = false;
    next.currentTime = 0;
    const speed = CLIPS.find((clip) => clip.name === name)?.speed ?? 1;
    next.playbackRate = name === "flip-down" ? FLIP_TURN_SPEED : speed;
    layerRef.current += 1;
    next.style.zIndex = String(layerRef.current);
    next.style.opacity = "1";
    void next.play().catch(() => undefined);
    // The video's own time event is too coarse to land the sound on the needle at this speed.
    if (NEEDLE_SECONDS[name] !== undefined) {
      const watch = () => {
        if (clipRef.current !== name || needleDownRef.current || restartRef.current) return;
        if (next.currentTime >= FLIP_TURN_SECONDS) next.playbackRate = speed;
        clipTime(name, next.currentTime);
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    }
    if (previous && previous !== next) {
      setTimeout(() => {
        previous.pause();
        previous.style.opacity = "0";
      }, FADE_MS);
    }
    clipRef.current = name;
  }

  function pauseOtherMedia() {
    document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((media) => {
      if (media !== adRef.current && !media.muted) media.pause();
    });
  }

  function dropNeedle() {
    const ad = adRef.current;
    const index = wantedRef.current;
    needleDownRef.current = true;
    if (!ad || index === null) return;
    pauseOtherMedia();
    ad.muted = mutedRef.current;
    ad.currentTime = 0;
    void ad.play().catch(() => undefined);
    setPlaying(index);
    setIsPaused(false);
  }

  function togglePause() {
    const ad = adRef.current;
    const clip = clipsRef.current[clipRef.current];
    if (!ad) return;
    if (ad.paused) {
      pauseOtherMedia();
      void ad.play().catch(() => undefined);
      if (!stillRef.current) void clip?.play().catch(() => undefined);
      setIsPaused(false);
    } else {
      ad.pause();
      clip?.pause();
      setIsPaused(true);
    }
  }

  function chooseTrack(index: number) {
    const ad = adRef.current;
    if (!ad) return;
    if (index === playing) {
      togglePause();
      return;
    }
    wantedRef.current = index;
    setWanted(index);
    setPlaying(null);
    setIsPaused(false);
    setPosition(0);
    setDuration(0);

    // Phones only allow sound that began inside a tap, so start it silently here.
    ad.pause();
    ad.src = tracks[index].src;
    ad.muted = true;
    void ad
      .play()
      .then(() => {
        if (!needleDownRef.current || restartRef.current) ad.pause();
      })
      .catch(() => undefined);

    if (stillRef.current) {
      dropNeedle();
    } else if (clipRef.current === "browse") {
      playClip("walk");
    } else if (clipRef.current === "listen") {
      playClip("flip-up");
    } else if (needleDownRef.current) {
      // The needle is already down on the previous pick, so this one needs its own flip.
      needleDownRef.current = false;
      restartRef.current = true;
    }
  }

  function clipEnded(name: Clip) {
    if (name === "walk") playClip("needle");
    else if (name === "flip-up") playClip("flip-down");
    else if (restartRef.current) playClip("flip-up");
    else playClip("listen");
  }

  function clipTime(name: Clip, time: number) {
    const needleTime = NEEDLE_SECONDS[name];
    if (needleTime === undefined || clipRef.current !== name) return;
    if (time >= needleTime && !needleDownRef.current && !restartRef.current) dropNeedle();
  }

  function adEnded() {
    const current = wantedRef.current;
    if (current !== null && current + 1 < tracks.length) {
      chooseTrack(current + 1);
    } else {
      setPlaying(null);
      setWanted(null);
    }
  }

  function artworkClicked() {
    if (playing !== null) togglePause();
    else if (wanted === null) chooseTrack(0);
  }

  function nextTrack() {
    chooseTrack(wanted === null ? 0 : (wanted + 1) % tracks.length);
  }

  function seek(time: number) {
    const ad = adRef.current;
    if (!ad) return;
    ad.currentTime = time;
    setPosition(time);
  }

  function applyMuted(muted: boolean) {
    const ad = adRef.current;
    mutedRef.current = muted;
    setIsMuted(muted);
    // Before the needle drops the ad stays silent anyway; dropNeedle picks this up.
    if (ad && playing !== null) ad.muted = muted;
  }

  function changeVolume(value: number) {
    if (adRef.current) adRef.current.volume = value;
    setVolume(value);
    applyMuted(value === 0);
  }

  function toggleMute() {
    if (isMuted && volume === 0) changeVolume(0.5);
    else applyMuted(!isMuted);
  }

  const iconButton =
    "grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-fg transition-colors hover:text-accent disabled:cursor-default disabled:opacity-45";

  const shown = wanted ?? 0;

  return (
    <div
      ref={rootRef}
      className="grid items-center gap-(--space-1) md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
    >
      {/* Lighten drops the clips' pure black into whatever background the page has. */}
      <div
        className="relative aspect-square overflow-hidden bg-cover mix-blend-lighten"
        style={{ backgroundImage: "url(/record-store/poster.jpg)" }}
      >
        {isNear &&
          CLIPS.map(({ name, loop }) => (
            <video
              key={name}
              aria-hidden
              className="absolute inset-0 h-full w-full transition-opacity"
              loop={loop}
              muted
              onEnded={() => clipEnded(name)}
              onTimeUpdate={(event) => clipTime(name, event.currentTarget.currentTime)}
              playsInline
              poster={name === "browse" ? "/record-store/poster.jpg" : undefined}
              preload="auto"
              ref={(element) => {
                if (element) clipsRef.current[name] = element;
              }}
              src={`/record-store/${name}.mp4`}
              style={{ opacity: name === "browse" ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
            />
          ))}
      </div>

      <div className="min-w-0">
        <div className="relative mb-4 aspect-video overflow-hidden rounded-2xl border border-border bg-bg-elevated">
          <video
            ref={adRef}
            aria-label={`Artwork for ${tracks[shown].title}`}
            className="absolute inset-0 h-full w-full cursor-pointer object-contain"
            onClick={artworkClicked}
            onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
            onEnded={adEnded}
            onTimeUpdate={(event) => {
              if (playing !== null) setPosition(event.currentTarget.currentTime);
            }}
            playsInline
            preload="metadata"
            src={tracks[0].src}
          />
          {(wanted === null || isPaused || playing !== null) && (
            <button
              type="button"
              aria-label={`${playing !== null && !isPaused ? "Pause" : "Play"} ${tracks[shown].title}`}
              onClick={artworkClicked}
              className={`group absolute inset-0 flex cursor-pointer items-center justify-center bg-black/10 transition hover:bg-black/20 focus-visible:opacity-100 ${playing !== null && !isPaused ? "opacity-0 hover:opacity-100" : ""}`}
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-bg/80 text-fg backdrop-blur-sm transition-transform group-hover:scale-105">
                {playing !== null && !isPaused ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                    <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 translate-x-0.5" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </span>
            </button>
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-6">
            <button
              type="button"
              aria-label={playing !== null && !isPaused ? "Pause" : "Play"}
              disabled={wanted !== null && playing === null}
              onClick={artworkClicked}
              className={iconButton}
            >
              {playing !== null && !isPaused ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              aria-label="Next track"
              disabled={tracks.length < 2}
              onClick={nextTrack}
              className={iconButton}
            >
              <NextIcon />
            </button>
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-fg">
              {formatTime(position)}
            </span>
            <input
              type="range"
              aria-label={`Seek through ${tracks[shown].title}`}
              aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
              disabled={playing === null || duration <= 0}
              max={Math.max(duration, 0.01)}
              min={0}
              onChange={(event) => seek(Number(event.target.value))}
              step={0.01}
              value={Math.min(position, Math.max(duration, 0.01))}
              className="h-7 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-default"
            />
            <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-fg">
              {formatTime(duration)}
            </span>
            <button
              type="button"
              aria-label={isMuted ? "Unmute" : "Mute"}
              onClick={toggleMute}
              className={iconButton}
            >
              <VolumeIcon silent={isMuted} />
            </button>
            <input
              type="range"
              aria-label="Volume"
              max={1}
              min={0}
              onChange={(event) => changeVolume(Number(event.target.value))}
              step={0.01}
              value={isMuted ? 0 : volume}
              className="hidden h-7 w-16 shrink-0 cursor-pointer accent-accent sm:block"
            />
          </div>
        </div>

        <ol className="border-t border-border">
          {tracks.map((track, index) => {
            const isPlaying = playing === index;
            const isWanted = wanted === index;
            return (
              <li key={track.id} className="border-b border-border">
                <button
                  type="button"
                  aria-current={isWanted ? "true" : undefined}
                  aria-label={`${isPlaying && !isPaused ? "Pause" : "Play"} ${track.title}`}
                  onClick={() => chooseTrack(index)}
                  className={`grid min-h-11 w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-1.5 text-left transition-colors hover:text-accent ${isWanted ? "text-accent" : "text-fg"}`}
                >
                  <span className="grid place-items-center font-mono text-xs text-fg-muted">
                    {isPlaying ? isPaused ? <PlayIcon /> : <PauseIcon /> : trackNumber(index)}
                  </span>
                  <span className="truncate font-display text-xl tracking-wide md:text-2xl">
                    {track.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                    {isWanted && !isPlaying ? "Up next" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
