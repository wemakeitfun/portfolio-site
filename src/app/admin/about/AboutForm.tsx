"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AboutContent, Principle, TimelineEntry } from "@/lib/about";
import {
  MEDIA_BUCKET,
  mediaUrl,
  type AboutMediaRow,
  type AboutSectionRow,
  type GalleryStyle,
  type SectionWidth,
} from "@/lib/media";

const MAX_BYTES = 50 * 1024 * 1024; // matches the bucket's limit
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "video/mp4",
  "video/webm",
];

const inputCls =
  "w-full rounded-md border border-border bg-bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const labelCls = "font-mono text-xs uppercase tracking-widest text-fg-muted";
const smallBtn =
  "font-mono text-xs uppercase tracking-widest text-fg-muted transition-colors hover:text-fg disabled:opacity-40";

function errMsg(err: unknown) {
  if (err instanceof Error) return err.message;
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

/** A section as edited in the form. `isNew` sections have a temporary id until Save creates the real row. */
type ClientSection = {
  id: string;
  isNew: boolean;
  style: GalleryStyle;
  columns: 1 | 2 | 3 | 4;
  width_percent: SectionWidth;
  label: string;
  sort_order: number;
};

type Staged = { id: string; file: File; preview: string; sectionId: string; autoplay: boolean };

async function measure(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    if (file.type.startsWith("image/")) {
      const bmp = await createImageBitmap(file);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close();
      return size;
    }
    const url = URL.createObjectURL(file);
    return await new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        resolve({ width: v.videoWidth, height: v.videoHeight });
        URL.revokeObjectURL(url);
      };
      v.onerror = () => {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(url);
      };
      v.src = url;
    });
  } catch {
    return { width: null, height: null };
  }
}

export default function AboutForm({
  initial,
  initialSections = [],
  initialMedia = [],
}: {
  initial: AboutContent;
  initialSections?: AboutSectionRow[];
  initialMedia?: AboutMediaRow[];
}) {
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

  const [sections, setSections] = useState<ClientSection[]>(() =>
    initialSections.map((s) => ({
      id: s.id,
      isNew: false,
      style: s.style,
      columns: s.columns,
      width_percent: s.width_percent,
      label: s.label ?? "",
      sort_order: s.sort_order,
    })),
  );
  const [media, setMedia] = useState<AboutMediaRow[]>(initialMedia);
  const [staged, setStaged] = useState<Staged[]>([]);

  // Confirmation without window.confirm(): some browsers silently suppress repeated
  // native dialogs on a page (Chrome does this after several in a row), which makes
  // confirm() just return false with no visible error — indistinguishable from the
  // button doing nothing. A key here "arms" a delete button; clicking it again
  // within a few seconds is the confirmation.
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const armTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function arm(key: string) {
    setArmedDelete(key);
    if (armTimeout.current) clearTimeout(armTimeout.current);
    armTimeout.current = setTimeout(() => setArmedDelete(null), 4000);
  }

  function disarm() {
    setArmedDelete(null);
    if (armTimeout.current) clearTimeout(armTimeout.current);
  }

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Free preview blobs if the form is left with files still staged.
  const stagedRef = useRef(staged);
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);
  useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.preview)), []);
  useEffect(
    () => () => {
      if (armTimeout.current) clearTimeout(armTimeout.current);
    },
    [],
  );

  // ---- Sections ----

  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  function addSection() {
    const nextOrder = sections.length ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 0;
    setSections((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        isNew: true,
        style: "grid",
        columns: 1,
        width_percent: 100,
        label: "",
        sort_order: nextOrder,
      },
    ]);
  }

  function updateSection(
    id: string,
    patch: Partial<Pick<ClientSection, "style" | "columns" | "width_percent" | "label">>,
  ) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveSection(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const ordered = [...prev].sort((a, b) => a.sort_order - b.sort_order);
      const i = ordered.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ordered.length) return prev;
      const a = ordered[i];
      const b = ordered[j];
      return prev.map((s) => {
        if (s.id === a.id) return { ...s, sort_order: b.sort_order };
        if (s.id === b.id) return { ...s, sort_order: a.sort_order };
        return s;
      });
    });
  }

  function deleteSection(id: string) {
    const hasExisting = media.some((m) => m.section_id === id);
    const hasStaged = staged.some((s) => s.sectionId === id);
    if (hasExisting || hasStaged) {
      setError("Move or delete this section's files before deleting the section itself.");
      return;
    }
    setError(null);
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  // ---- Staged (not-yet-uploaded) files ----

  function stageFiles(files: FileList | null, sectionId: string) {
    if (!files) return;
    setError(null);
    const next: Staged[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`"${file.name}" isn't a supported type (JPG, PNG, WebP, AVIF, GIF, MP4, WebM).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" is over 50 MB. Compress it or trim the video and try again.`);
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), sectionId, autoplay: false });
    }
    setStaged((prev) => [...prev, ...next]);
  }

  function unstage(id: string) {
    setStaged((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((s) => s.id !== id);
    });
  }

  function moveStagedToSection(id: string, sectionId: string) {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, sectionId } : s)));
  }

  // ---- Media management (existing, already-uploaded files) ----

  async function persistOrder(orderedIds: string[]) {
    const byId = new Map(orderedIds.map((mid, i) => [mid, i]));
    setMedia((prev) => prev.map((m) => (byId.has(m.id) ? { ...m, sort_order: byId.get(m.id)! } : m)));
    const results = await Promise.all(
      orderedIds.map((mid, i) => supabase.from("about_media").update({ sort_order: i }).eq("id", mid)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) setError(errMsg(failed.error));
    router.refresh();
  }

  function reorderWithinSection(sectionId: string, from: number, to: number) {
    const items = media.filter((m) => m.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order);
    if (to < 0 || to >= items.length || from === to) return;
    const ids = items.map((m) => m.id);
    const [item] = ids.splice(from, 1);
    ids.splice(to, 0, item);
    void persistOrder(ids);
  }

  function moveMediaToSection(mediaId: string, sectionId: string) {
    setMedia((prev) => prev.map((m) => (m.id === mediaId ? { ...m, section_id: sectionId } : m)));
  }

  async function saveAlt(id: string, alt: string) {
    const current = media.find((m) => m.id === id);
    if (!current || (current.alt ?? "") === alt) return;
    const { error } = await supabase.from("about_media").update({ alt: alt || null }).eq("id", id);
    if (error) return setError(errMsg(error));
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, alt: alt || null } : m)));
  }

  async function saveAutoplay(id: string, autoplay: boolean) {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, autoplay } : m)));
    const { error } = await supabase.from("about_media").update({ autoplay }).eq("id", id);
    if (error) {
      setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, autoplay: !autoplay } : m)));
      setError(errMsg(error));
      return;
    }
    router.refresh();
  }

  function setStagedAutoplay(id: string, autoplay: boolean) {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, autoplay } : s)));
  }

  async function removeMedia(m: AboutMediaRow) {
    setError(null);
    const paths = [m.path, m.poster_path].filter((p): p is string => !!p);
    const rm = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    if (rm.error) return setError(errMsg(rm.error));
    const { error } = await supabase.from("about_media").delete().eq("id", m.id);
    if (error) return setError(errMsg(error));
    setMedia((prev) => prev.filter((x) => x.id !== m.id));
    router.refresh();
  }

  // ---- Save: about_page row, then sections (create/update/delete), then uploads ----

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus("Saving…");
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

      // Sections that existed on load but are gone from state now were deleted locally — remove them for real.
      const originalSectionIds = new Set(initialSections.map((s) => s.id));
      const keptRealIds = new Set(sections.filter((s) => !s.isNew).map((s) => s.id));
      const removedSectionIds = [...originalSectionIds].filter((sid) => !keptRealIds.has(sid));
      if (removedSectionIds.length) {
        const { error } = await supabase.from("about_sections").delete().in("id", removedSectionIds);
        if (error) throw error;
      }

      // Create any new sections and remember their real ids; update the rest.
      const tempIdMap: Record<string, string> = {};
      for (const s of sections) {
        if (s.isNew) {
          const { data, error } = await supabase
            .from("about_sections")
            .insert({
              style: s.style,
              columns: s.columns,
              width_percent: s.width_percent,
              label: s.label.trim() || null,
              sort_order: s.sort_order,
            })
            .select("id")
            .single();
          if (error) throw error;
          tempIdMap[s.id] = data.id as string;
        } else {
          const { error } = await supabase
            .from("about_sections")
            .update({
              style: s.style,
              columns: s.columns,
              width_percent: s.width_percent,
              label: s.label.trim() || null,
              sort_order: s.sort_order,
            })
            .eq("id", s.id);
          if (error) throw error;
        }
      }
      const resolveSection = (sid: string) => tempIdMap[sid] ?? sid;

      // Existing media that was moved to a different section (possibly a brand-new one).
      const originalSectionOf = new Map(initialMedia.map((m) => [m.id, m.section_id]));
      for (const m of media) {
        const resolved = resolveSection(m.section_id);
        if (originalSectionOf.get(m.id) !== resolved) {
          const { error } = await supabase.from("about_media").update({ section_id: resolved }).eq("id", m.id);
          if (error) throw error;
        }
      }

      setSections((prev) => prev.map((s) => (s.isNew ? { ...s, id: tempIdMap[s.id] ?? s.id, isNew: false } : s)));
      setMedia((prev) => prev.map((m) => ({ ...m, section_id: resolveSection(m.section_id) })));

      // Upload every staged file into its (now-real) section.
      const orderBySection = new Map<string, number>();
      for (const m of media) {
        orderBySection.set(m.section_id, Math.max(orderBySection.get(m.section_id) ?? -1, m.sort_order));
      }
      const added: AboutMediaRow[] = [];
      const failed: Staged[] = [];

      for (const [i, s] of staged.entries()) {
        setStatus(`Uploading ${i + 1} of ${staged.length}…`);
        const targetSectionId = resolveSection(s.sectionId);
        try {
          const ext = s.file.name.split(".").pop()?.toLowerCase() || "bin";
          const path = `about/${crypto.randomUUID()}.${ext}`;
          const up = await supabase.storage
            .from(MEDIA_BUCKET)
            .upload(path, s.file, { cacheControl: "31536000", contentType: s.file.type });
          if (up.error) throw up.error;

          const { width, height } = await measure(s.file);
          const nextOrder = (orderBySection.get(targetSectionId) ?? -1) + 1;
          orderBySection.set(targetSectionId, nextOrder);

          const { data, error } = await supabase
            .from("about_media")
            .insert({
              section_id: targetSectionId,
              kind: s.file.type.startsWith("video/") ? "video" : "image",
              path,
              width,
              height,
              sort_order: nextOrder,
              autoplay: s.autoplay,
            })
            .select("*")
            .single();
          if (error) {
            await supabase.storage.from(MEDIA_BUCKET).remove([path]);
            throw error;
          }
          added.push(data as AboutMediaRow);
          URL.revokeObjectURL(s.preview);
        } catch (err) {
          failed.push(s);
          setError(`Couldn't upload "${s.file.name}": ${errMsg(err)}`);
        }
      }

      setMedia((prev) => [...prev, ...added]);
      setStaged(failed);
      setStatus(failed.length ? "Saved, but some files didn't upload." : "Saved.");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setStatus(null);
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
          <textarea rows={2} value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputCls} />
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

      {/* ---- Sections: independent galleries, each with its own media and style ---- */}
      <section className="space-y-6">
        <div>
          <h2 className="font-display text-3xl tracking-wide">Sections</h2>
          <p className="mt-1 text-sm text-fg-muted">
            The About page renders these top to bottom, after everything above. Each one is its
            own gallery — put a single video in one section for a large featured player, then a
            grid or slideshow of images in another. JPG, PNG, WebP, AVIF, GIF, MP4 or WebM, up to
            50 MB each. Files upload when you press Save.
          </p>
        </div>

        {sortedSections.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
            No sections yet. Add one to start uploading images or video.
          </p>
        )}

        {sortedSections.map((sec, secIndex) => {
          const items = media
            .filter((m) => m.section_id === sec.id)
            .sort((a, b) => a.sort_order - b.sort_order);
          const secStaged = staged.filter((s) => s.sectionId === sec.id);

          return (
            <div key={sec.id} className="space-y-4 rounded-lg border border-border p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className={labelCls}>Section {secIndex + 1}</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => moveSection(sec.id, -1)}
                    disabled={secIndex === 0}
                    className={smallBtn}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(sec.id, 1)}
                    disabled={secIndex === sortedSections.length - 1}
                    className={smallBtn}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSection(sec.id)}
                    className={`${smallBtn} hover:!text-red-400`}
                  >
                    Delete section
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelCls}>Style</span>
                  <select
                    value={sec.style}
                    onChange={(e) => updateSection(sec.id, { style: e.target.value as GalleryStyle })}
                    className={inputCls}
                  >
                    <option value="grid">Grid</option>
                    <option value="slideshow">Slideshow (click to advance)</option>
                  </select>
                </label>
                {sec.style === "grid" && (
                  <label className="space-y-2">
                    <span className={labelCls}>Columns</span>
                    <select
                      value={sec.columns}
                      onChange={(e) =>
                        updateSection(sec.id, { columns: Number(e.target.value) as 1 | 2 | 3 | 4 })
                      }
                      className={inputCls}
                    >
                      <option value={1}>1 across</option>
                      <option value={2}>2 across</option>
                      <option value={3}>3 across</option>
                      <option value={4}>4 across</option>
                    </select>
                  </label>
                )}
                <label className="space-y-2">
                  <span className={labelCls}>Size</span>
                  <select
                    value={sec.width_percent}
                    onChange={(e) =>
                      updateSection(sec.id, { width_percent: Number(e.target.value) as SectionWidth })
                    }
                    className={inputCls}
                  >
                    <option value={100}>100% — full width</option>
                    <option value={75}>75%</option>
                    <option value={50}>50%</option>
                    <option value={25}>25%</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelCls}>Type</span>
                <input
                  value={sec.label}
                  onChange={(e) => updateSection(sec.id, { label: e.target.value })}
                  placeholder="e.g. Behind the Scenes — shown as a heading above this section"
                  className={inputCls}
                />
              </label>

              {items.length > 0 && (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((m, i) => (
                    <li key={m.id} className="space-y-3 rounded-md border border-border p-3">
                      <div className="relative aspect-video overflow-hidden rounded bg-bg-elevated">
                        {m.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(m.path)} alt={m.alt ?? ""} className="h-full w-full object-cover" />
                        ) : (
                          <video
                            src={`${mediaUrl(m.path)}#t=0.1`}
                            controls
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <input
                        defaultValue={m.alt ?? ""}
                        placeholder="Title — shown under this piece on the page"
                        onBlur={(e) => saveAlt(m.id, e.target.value)}
                        className={inputCls}
                      />
                      {m.kind === "video" && (
                        <label className="block space-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                            Playback
                          </span>
                          <select
                            value={m.autoplay ? "auto" : "click"}
                            onChange={(e) => saveAutoplay(m.id, e.target.value === "auto")}
                            className={`${inputCls} py-1.5 text-xs`}
                          >
                            <option value="click">Click to play</option>
                            <option value="auto">Autoplay (muted, loops)</option>
                          </select>
                        </label>
                      )}
                      {sortedSections.length > 1 && (
                        <label className="block space-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                            Section
                          </span>
                          <select
                            value={sec.id}
                            onChange={(e) => moveMediaToSection(m.id, e.target.value)}
                            className={`${inputCls} py-1.5 text-xs`}
                          >
                            {sortedSections.map((opt, oi) => (
                              <option key={opt.id} value={opt.id}>
                                Section {oi + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => reorderWithinSection(sec.id, i, i - 1)}
                            disabled={i === 0}
                            className={smallBtn}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderWithinSection(sec.id, i, i + 1)}
                            disabled={i === items.length - 1}
                            className={smallBtn}
                          >
                            →
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const key = `media:${m.id}`;
                            if (armedDelete === key) {
                              disarm();
                              void removeMedia(m);
                            } else {
                              arm(key);
                            }
                          }}
                          className={`${smallBtn} hover:!text-red-400`}
                        >
                          {armedDelete === `media:${m.id}` ? "Confirm?" : "Delete"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {secStaged.length > 0 && (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {secStaged.map((s) => (
                    <li key={s.id} className="space-y-3 rounded-md border border-dashed border-accent/60 p-3">
                      <div className="aspect-video overflow-hidden rounded bg-bg-elevated">
                        {s.file.type.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.preview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <video src={s.preview} controls preload="metadata" className="h-full w-full object-cover" />
                        )}
                      </div>
                      {s.file.type.startsWith("video/") && (
                        <label className="block space-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                            Playback
                          </span>
                          <select
                            value={s.autoplay ? "auto" : "click"}
                            onChange={(e) => setStagedAutoplay(s.id, e.target.value === "auto")}
                            className={`${inputCls} py-1.5 text-xs`}
                          >
                            <option value="click">Click to play</option>
                            <option value="auto">Autoplay (muted, loops)</option>
                          </select>
                        </label>
                      )}
                      {sortedSections.length > 1 && (
                        <label className="block space-y-1">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                            Section
                          </span>
                          <select
                            value={s.sectionId}
                            onChange={(e) => moveStagedToSection(s.id, e.target.value)}
                            className={`${inputCls} py-1.5 text-xs`}
                          >
                            {sortedSections.map((opt, oi) => (
                              <option key={opt.id} value={opt.id}>
                                Section {oi + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs text-fg-muted">{s.file.name}</span>
                        <button type="button" onClick={() => unstage(s.id)} className={smallBtn}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center transition-colors hover:border-accent">
                <span className="font-mono text-xs uppercase tracking-widest">
                  Choose images or videos for this section
                </span>
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_TYPES.join(",")}
                  className="sr-only"
                  onChange={(e) => {
                    stageFiles(e.target.files, sec.id);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addSection}
          className="w-full rounded-md border border-dashed border-border py-4 font-mono text-xs uppercase tracking-widest transition-colors hover:border-accent"
        >
          + Add section
        </button>
      </section>

      {/* ---- Actions ---- */}
      <div className="flex flex-wrap items-center gap-6 border-t border-border pt-8">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-8 py-3 font-mono text-xs font-medium uppercase tracking-widest text-[#0a0a0b] transition-opacity disabled:opacity-50"
        >
          {busy ? (status ?? "Saving…") : "Save"}
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
