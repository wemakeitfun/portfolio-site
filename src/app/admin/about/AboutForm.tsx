"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AboutContent, Principle, TimelineEntry } from "@/lib/about";

const inputCls =
  "w-full rounded-md border border-border bg-bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelCls = "font-mono text-xs uppercase tracking-widest text-fg-muted";
const smallBtn =
  "font-mono text-xs uppercase tracking-widest text-fg-muted transition-colors hover:text-fg disabled:opacity-40";

function errMsg(err: unknown) {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong.";
}

/** Move an item within an array, returning a new array. */
function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function AboutForm({ initial }: { initial: AboutContent }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [eyebrow, setEyebrow] = useState(initial.eyebrow);
  const [headline, setHeadline] = useState(initial.headline);
  const [intro, setIntro] = useState(initial.intro);
  const [marquee, setMarquee] = useState(initial.marquee_items.join(", "));
  const [principles, setPrinciples] = useState<Principle[]>(initial.principles);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(initial.timeline);
  const [showMarquee, setShowMarquee] = useState(initial.show_marquee);
  const [showPrinciples, setShowPrinciples] = useState(initial.show_principles);
  const [showTimeline, setShowTimeline] = useState(initial.show_timeline);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { error } = await supabase
        .from("about_page")
        .update({
          eyebrow,
          headline,
          intro,
          marquee_items: marquee
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          principles: principles.filter((p) => p.title.trim() || p.detail.trim()),
          timeline: timeline.filter((t) => t.year.trim() || t.label.trim() || t.detail.trim()),
          show_marquee: showMarquee,
          show_principles: showPrinciples,
          show_timeline: showTimeline,
        })
        .eq("id", true);
      if (error) throw error;
      setStatus("Saved.");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      <div>
        <Link href="/admin" className={`${labelCls} hover:text-fg`}>
          ← All projects
        </Link>
        <h1 className="mt-3 font-display text-5xl tracking-wide md:text-6xl">About page</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Edits go live on <code>/about</code> within a minute of saving.
        </p>
      </div>

      {/* ---- Intro ---- */}
      <section className="space-y-6">
        <label className="block space-y-2">
          <span className={labelCls}>Eyebrow (small label above the headline)</span>
          <input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} className={inputCls} />
        </label>

        <label className="block space-y-2">
          <span className={labelCls}>Headline</span>
          <textarea
            rows={2}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="block space-y-2">
          <span className={labelCls}>Intro paragraph</span>
          <textarea rows={4} value={intro} onChange={(e) => setIntro(e.target.value)} className={inputCls} />
        </label>

        <label className="block space-y-2">
          <span className={labelCls}>Scrolling marquee words (comma separated)</span>
          <input value={marquee} onChange={(e) => setMarquee(e.target.value)} className={inputCls} />
        </label>
        <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={showMarquee}
              onChange={(e) => setShowMarquee(e.target.checked)}
              className="h-4 w-4 accent-[#d7ff3f]"
            />
            <span className={labelCls}>Show on page</span>
          </label>
      </section>

      {/* ---- Principles ("How we work") ---- */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl tracking-wide">How we work</h2>
            <p className="mt-1 text-sm text-fg-muted">A short list of title + detail pairs.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={showPrinciples}
              onChange={(e) => setShowPrinciples(e.target.checked)}
              className="h-4 w-4 accent-[#d7ff3f]"
            />
            <span className={labelCls}>Show on page</span>
          </label>
        </div>

        <ul className="space-y-4">
          {principles.map((p, i) => (
            <li key={i} className="space-y-3 rounded-md border border-border p-4">
              <input
                placeholder="Title"
                value={p.title}
                onChange={(e) =>
                  setPrinciples((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
                className={inputCls}
              />
              <textarea
                placeholder="Detail"
                rows={2}
                value={p.detail}
                onChange={(e) =>
                  setPrinciples((prev) => prev.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))
                }
                className={inputCls}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPrinciples((prev) => moved(prev, i, i - 1))}
                  disabled={i === 0}
                  className={smallBtn}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => setPrinciples((prev) => moved(prev, i, i + 1))}
                  disabled={i === principles.length - 1}
                  className={smallBtn}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setPrinciples((prev) => prev.filter((_, j) => j !== i))}
                  className={`${smallBtn} hover:!text-red-400`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setPrinciples((prev) => [...prev, { title: "", detail: "" }])}
          className="w-full rounded-md border border-dashed border-border py-3 font-mono text-xs uppercase tracking-widest transition-colors hover:border-accent"
        >
          Add item
        </button>
      </section>

      {/* ---- Timeline ---- */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl tracking-wide">Timeline</h2>
            <p className="mt-1 text-sm text-fg-muted">Year, label, and a short detail — shown oldest first.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={showTimeline}
              onChange={(e) => setShowTimeline(e.target.checked)}
              className="h-4 w-4 accent-[#d7ff3f]"
            />
            <span className={labelCls}>Show on page</span>
          </label>
        </div>

        <ul className="space-y-4">
          {timeline.map((t, i) => (
            <li key={i} className="space-y-3 rounded-md border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
                <input
                  placeholder="Year"
                  value={t.year}
                  onChange={(e) =>
                    setTimeline((prev) => prev.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))
                  }
                  className={inputCls}
                />
                <input
                  placeholder="Label"
                  value={t.label}
                  onChange={(e) =>
                    setTimeline((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                  className={inputCls}
                />
              </div>
              <textarea
                placeholder="Detail"
                rows={2}
                value={t.detail}
                onChange={(e) =>
                  setTimeline((prev) => prev.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))
                }
                className={inputCls}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTimeline((prev) => moved(prev, i, i - 1))}
                  disabled={i === 0}
                  className={smallBtn}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => setTimeline((prev) => moved(prev, i, i + 1))}
                  disabled={i === timeline.length - 1}
                  className={smallBtn}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setTimeline((prev) => prev.filter((_, j) => j !== i))}
                  className={`${smallBtn} hover:!text-red-400`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setTimeline((prev) => [...prev, { year: "", label: "", detail: "" }])}
          className="w-full rounded-md border border-dashed border-border py-3 font-mono text-xs uppercase tracking-widest transition-colors hover:border-accent"
        >
          Add entry
        </button>
      </section>

      {/* ---- Actions ---- */}
      <div className="flex flex-wrap items-center gap-6 border-t border-border pt-8">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-8 py-3 font-mono text-xs font-medium uppercase tracking-widest text-[#0a0a0b] transition-opacity disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {!busy && status && <span className="text-sm text-fg-muted">{status}</span>}
        {error && (
          <span role="alert" className="text-sm text-red-400">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
