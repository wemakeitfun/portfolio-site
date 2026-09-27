"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const btn =
  "font-mono text-xs uppercase tracking-widest text-fg-muted transition-colors hover:text-fg disabled:opacity-40";

/**
 * Sets every video (site-wide, or just one project's) to autoplay or click-to-play in one go.
 * Individual videos can still be changed afterwards. Two clicks to confirm — no window.confirm().
 */
export default function VideoPlaybackControl({
  projectId,
  onApplied,
}: {
  projectId?: string;
  onApplied?: (autoplay: boolean) => void;
}) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [armed, setArmed] = useState<"click" | "auto" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function apply(mode: "click" | "auto") {
    if (armed !== mode) {
      setArmed(mode);
      setMessage(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(null), 4000);
      return;
    }
    setArmed(null);
    setBusy(true);
    let q = supabase.from("project_media").update({ autoplay: mode === "auto" }).eq("kind", "video");
    if (projectId) q = q.eq("project_id", projectId);
    const { error } = await q;
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(mode === "auto" ? "All videos set to autoplay." : "All videos set to click to play.");
    onApplied?.(mode === "auto");
    router.refresh();
  }

  const label = (mode: "click" | "auto", text: string) => (armed === mode ? "Click again to confirm" : text);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">
        {projectId ? "All videos in this project" : "All videos, every project"}:
      </span>
      <button type="button" disabled={busy} onClick={() => apply("click")} className={btn}>
        {label("click", "Click to play")}
      </button>
      <button type="button" disabled={busy} onClick={() => apply("auto")} className={btn}>
        {label("auto", "Autoplay")}
      </button>
      {message && <span className="text-sm text-fg-muted">{message}</span>}
    </div>
  );
}
