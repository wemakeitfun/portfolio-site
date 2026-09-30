"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VideoPlaybackControl from "../VideoPlaybackControl";
import {
  MEDIA_BUCKET,
  mediaUrl,
  type GalleryColumns,
  type GalleryStyle,
  type HoverEffect,
  type MediaRow,
  type ProjectRow,
  type Section,
  type SectionRow,
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

/** A section as edited in the form. `isNew` sections have a temporary id until Save creates the real row. */
type ClientSection = {
  id: string;
  isNew: boolean;
  style: GalleryStyle;
  columns: GalleryColumns;
  width_percent: SectionWidth;
  /** Optional eyebrow label shown above this section on the project page (e.g. "Behind the Scenes"). */
  label: string;
  sort_order: number;
};

type Staged = { id: string; file: File; preview: string; sectionId: string; autoplay: boolean };

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function errMsg(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong.";
}

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

export default function ProjectForm({
  project,
  initialMedia = [],
  initialSections = [],
}: {
  project?: ProjectRow;
  initialMedia?: MediaRow[];
  initialSections?: SectionRow[];
}) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [projectId, setProjectId] = useState(project?.id);
  const [title, setTitle] = useState(project?.title ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!project);
  const [section, setSection] = useState<Section>(project?.section ?? "work");
  const [year, setYear] = useState(project?.year ?? String(new Date().getFullYear()));
  const [category, setCategory] = useState(project?.category ?? "");
  const [client, setClient] = useState(project?.client ?? "");
  const [summary, setSummary] = useState(project?.summary ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [services, setServices] = useState((project?.services ?? []).join(", "));
  const [accent, setAccent] = useState(project?.accent ?? "#d7ff3f");
  const [hoverEffect, setHoverEffect] = useState<HoverEffect>(project?.hover_effect ?? "none");
  const [sortOrder, setSortOrder] = useState(project?.sort_order ?? 0);
  const [published, setPublished] = useState(project?.published ?? false);

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
  const [media, setMedia] = useState<MediaRow[]>(initialMedia);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragKey, setDragKey] = useState<{ sectionId: string; index: number } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<{ sectionId: string; index: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  const [bulkBusy, setBulkBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Free preview blobs if the form is left with files still staged.
  const stagedRef = useRef(staged);
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);
  useEffect(
    () => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.preview)),
    [],
  );
  useEffect(() => () => {
    if (armTimeout.current) clearTimeout(armTimeout.current);
  }, []);

  function onTitle(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

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

  // ---- Save: project row, then sections (create/update/delete), then uploads ----

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus("Saving…");
    try {
      if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        throw new Error("The URL slug can only use lowercase letters, numbers and dashes.");
      }

      const row = {
        slug,
        title,
        section,
        year: year || null,
        category: category || null,
        client: client || null,
        summary: summary || null,
        description: description || null,
        services: services
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        accent: accent || null,
        hover_effect: hoverEffect,
        sort_order: sortOrder,
        published,
      };

      let id = projectId;
      if (id) {
        const { error } = await supabase.from("projects").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("projects").insert(row).select("id").single();
        if (error) throw error;
        id = data.id as string;
        setProjectId(id); // if a later step fails, a retry updates instead of inserting a duplicate
      }

      // Sections that existed on load but are gone from state now were deleted locally — remove them for real.
      const originalSectionIds = new Set(initialSections.map((s) => s.id));
      const keptRealIds = new Set(sections.filter((s) => !s.isNew).map((s) => s.id));
      const removedSectionIds = [...originalSectionIds].filter((sid) => !keptRealIds.has(sid));
      if (removedSectionIds.length) {
        const { error } = await supabase.from("project_sections").delete().in("id", removedSectionIds);
        if (error) throw error;
      }

      // Create any new sections and remember their real ids; update the rest.
      const tempIdMap: Record<string, string> = {};
      for (const s of sections) {
        if (s.isNew) {
          const { data, error } = await supabase
            .from("project_sections")
            .insert({
              project_id: id,
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
            .from("project_sections")
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
        const resolved = resolveSection(m.section_id ?? "");
        if (originalSectionOf.get(m.id) !== resolved) {
          const { error } = await supabase.from("project_media").update({ section_id: resolved }).eq("id", m.id);
          if (error) throw error;
        }
      }

      setSections((prev) => prev.map((s) => (s.isNew ? { ...s, id: tempIdMap[s.id] ?? s.id, isNew: false } : s)));
      setMedia((prev) => prev.map((m) => ({ ...m, section_id: resolveSection(m.section_id ?? "") })));

      // Upload every staged file into its (now-real) section.
      const orderBySection = new Map<string, number>();
      for (const m of media) {
        const key = m.section_id ?? "";
        orderBySection.set(key, Math.max(orderBySection.get(key) ?? -1, m.sort_order));
      }
      let hasCover = media.some((m) => m.is_cover);
      const added: MediaRow[] = [];
      const failed: Staged[] = [];

      for (const [i, s] of staged.entries()) {
        setStatus(`Uploading ${i + 1} of ${staged.length}…`);
        const targetSectionId = resolveSection(s.sectionId);
        try {
          const ext = s.file.name.split(".").pop()?.toLowerCase() || "bin";
          const path = `${id}/${crypto.randomUUID()}.${ext}`;
          const up = await supabase.storage
            .from(MEDIA_BUCKET)
            .upload(path, s.file, { cacheControl: "31536000", contentType: s.file.type });
          if (up.error) throw up.error;

          const { width, height } = await measure(s.file);
          const nextOrder = (orderBySection.get(targetSectionId) ?? -1) + 1;
          orderBySection.set(targetSectionId, nextOrder);

          const { data, error } = await supabase
            .from("project_media")
            .insert({
              project_id: id,
              section_id: targetSectionId,
              kind: s.file.type.startsWith("video/") ? "video" : "image",
              path,
              width,
              height,
              sort_order: nextOrder,
              is_cover: !hasCover,
              autoplay: s.autoplay,
            })
            .select("*")
            .single();
          if (error) {
            await supabase.storage.from(MEDIA_BUCKET).remove([path]);
            throw error;
          }
          hasCover = true;
          added.push(data as MediaRow);
          URL.revokeObjectURL(s.preview);
        } catch (err) {
          failed.push(s);
          setError(`Couldn't upload "${s.file.name}": ${errMsg(err)}`);
        }
      }

      setMedia((prev) => [...prev, ...added]);
      setStaged(failed);

      if (failed.length === 0 && !project) {
        router.replace(`/admin/projects/${id}`);
      } else {
        setStatus(failed.length ? "Saved, but some files didn't upload." : "Saved.");
      }
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  // ---- Media management (existing, already-uploaded files) ----

  async function persistOrder(orderedIds: string[]) {
    const byId = new Map(orderedIds.map((mid, i) => [mid, i]));
    setMedia((prev) =>
      prev.map((m) => (byId.has(m.id) ? { ...m, sort_order: byId.get(m.id)! } : m)),
    );
    const results = await Promise.all(
      orderedIds.map((mid, i) => supabase.from("project_media").update({ sort_order: i }).eq("id", mid)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) setError(errMsg(failed.error));
    router.refresh();
  }

  function reorderWithinSection(sectionId: string, from: number, to: number) {
    const items = media.filter((m) => m.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order);
    if (to < 0 || to >= items.length || from === to) return;
    const ids = items.map((m) => m.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    void persistOrder(ids);
  }

  function moveMediaToSection(mediaId: string, sectionId: string) {
    setMedia((prev) => prev.map((m) => (m.id === mediaId ? { ...m, section_id: sectionId } : m)));
  }

  async function makeCover(id: string) {
    setError(null);
    // only one cover per project is allowed, so clear the old one first
    const clear = await supabase
      .from("project_media")
      .update({ is_cover: false })
      .eq("project_id", projectId!)
      .eq("is_cover", true);
    if (clear.error) return setError(errMsg(clear.error));
    const set = await supabase.from("project_media").update({ is_cover: true }).eq("id", id);
    if (set.error) return setError(errMsg(set.error));
    setMedia((prev) => prev.map((m) => ({ ...m, is_cover: m.id === id })));
    router.refresh();
  }

  async function saveAlt(id: string, alt: string) {
    const current = media.find((m) => m.id === id);
    if (!current || (current.alt ?? "") === alt) return;
    const { error } = await supabase.from("project_media").update({ alt: alt || null }).eq("id", id);
    if (error) return setError(errMsg(error));
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, alt: alt || null } : m)));
  }

  async function saveAutoplay(id: string, autoplay: boolean) {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, autoplay } : m)));
    const { error } = await supabase.from("project_media").update({ autoplay }).eq("id", id);
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

  async function removeMedia(m: MediaRow) {
    setError(null);
    const paths = [m.path, m.poster_path].filter((p): p is string => !!p);
    const rm = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    if (rm.error) return setError(errMsg(rm.error));
    const { error } = await supabase.from("project_media").delete().eq("id", m.id);
    if (error) return setError(errMsg(error));
    const rest = media.filter((x) => x.id !== m.id);
    // promote another file to cover if the cover was just deleted
    if (m.is_cover && rest.length) {
      await supabase.from("project_media").update({ is_cover: true }).eq("id", rest[0].id);
      rest[0] = { ...rest[0], is_cover: true };
    }
    setMedia(rest);
    setSelected((prev) => {
      if (!prev.has(m.id)) return prev;
      const next = new Set(prev);
      next.delete(m.id);
      return next;
    });
    router.refresh();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllInSection(sectionId: string) {
    const ids = media.filter((m) => m.section_id === sectionId).map((m) => m.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async function removeManyMedia(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    setBulkBusy(true);
    try {
      const idSet = new Set(ids);
      const toDelete = media.filter((m) => idSet.has(m.id));
      const paths = toDelete.flatMap((m) => [m.path, m.poster_path].filter((p): p is string => !!p));

      // Chunked so a very large selection doesn't hit a request-size limit in one call.
      for (const batch of chunk(paths, 100)) {
        if (batch.length === 0) continue;
        const rm = await supabase.storage.from(MEDIA_BUCKET).remove(batch);
        if (rm.error) return setError(errMsg(rm.error));
      }
      for (const batch of chunk(ids, 100)) {
        const { error } = await supabase.from("project_media").delete().in("id", batch);
        if (error) return setError(errMsg(error));
      }

      let rest = media.filter((m) => !idSet.has(m.id));
      // promote another file to cover if the cover was among those just deleted
      if (toDelete.some((m) => m.is_cover) && rest.length && !rest.some((m) => m.is_cover)) {
        await supabase.from("project_media").update({ is_cover: true }).eq("id", rest[0].id);
        rest = rest.map((m, i) => (i === 0 ? { ...m, is_cover: true } : m));
      }
      setMedia(rest);
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteProject() {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    const paths = media.flatMap((m) => [m.path, m.poster_path].filter((p): p is string => !!p));
    if (paths.length) {
      const rm = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
      if (rm.error) {
        setError(errMsg(rm.error));
        setBusy(false);
        return;
      }
    }
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      setError(errMsg(error));
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Link href="/admin" className={`${labelCls} hover:text-fg`}>
            ← All projects
          </Link>
          <h1 className="mt-3 font-display text-5xl tracking-wide md:text-6xl">
            {project ? "Edit project" : "New project"}
          </h1>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-[#d7ff3f]"
          />
          <span className={labelCls}>Published</span>
        </label>
      </div>

      {/* ---- Details ---- */}
      <section className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className={labelCls}>Title</span>
          <input required value={title} onChange={(e) => onTitle(e.target.value)} className={inputCls} />
        </label>

        <label className="space-y-2">
          <span className={labelCls}>URL slug</span>
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className={inputCls}
          />
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Section</span>
          <select value={section} onChange={(e) => setSection(e.target.value as Section)} className={inputCls}>
            <option value="work">Work</option>
            <option value="ads">Ads</option>
            <option value="artificial">Artificial</option>
            <option value="art">Art</option>
            <option value="generative">Generative</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Year</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} />
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} />
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Client</span>
          <input value={client} onChange={(e) => setClient(e.target.value)} className={inputCls} />
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Services (comma separated)</span>
          <input value={services} onChange={(e) => setServices(e.target.value)} className={inputCls} />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className={labelCls}>Summary (one line, shown on cards)</span>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} className={inputCls} />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className={labelCls}>Description</span>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Hover effect</span>
          <select
            value={hoverEffect}
            onChange={(e) => setHoverEffect(e.target.value as HoverEffect)}
            className={inputCls}
          >
            <option value="none">None</option>
            <option value="smear">Smear (effect not built yet)</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Accent</span>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-[42px] w-full cursor-pointer rounded-md border border-border bg-bg-elevated p-1"
          />
        </label>

        <label className="space-y-2">
          <span className={labelCls}>Sort order</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className={inputCls}
          />
        </label>
      </section>

      {/* ---- Sections: independent galleries, each with its own media and style ---- */}
      <section className="space-y-6">
        <div>
          <h2 className="font-display text-3xl tracking-wide">Sections</h2>
          <p className="mt-1 text-sm text-fg-muted">
            The project page renders these top to bottom. Each one is its own gallery — put a
            single video in one section for a large featured player, then a grid or slideshow of
            images in another. JPG, PNG, WebP, AVIF, GIF, MP4 or WebM, up to 50 MB each. Files
            upload when you press Save.
          </p>
        </div>

        {projectId && media.some((m) => m.kind === "video") && (
          <VideoPlaybackControl
            projectId={projectId}
            onApplied={(autoplay) =>
              setMedia((prev) => prev.map((m) => (m.kind === "video" ? { ...m, autoplay } : m)))
            }
          />
        )}

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
                        updateSection(sec.id, { columns: Number(e.target.value) as GalleryColumns })
                      }
                      className={inputCls}
                    >
                      <option value={1}>1 across</option>
                      <option value={2}>2 across</option>
                      <option value={3}>3 across</option>
                      <option value={4}>4 across</option>
                      <option value={5}>5 across</option>
                      <option value={6}>6 across</option>
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
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-fg-muted">
                      Drag a card by its ⠿ handle to reorder within this section, or use the arrows.
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => toggleSelectAllInSection(sec.id)}
                        className={smallBtn}
                      >
                        {items.every((m) => selected.has(m.id)) ? "Deselect all" : "Select all"}
                      </button>
                      {items.some((m) => selected.has(m.id)) && (
                        <button
                          type="button"
                          disabled={bulkBusy}
                          onClick={() => {
                            const ids = items.filter((m) => selected.has(m.id)).map((m) => m.id);
                            const key = `bulk:${sec.id}`;
                            if (armedDelete === key) {
                              disarm();
                              void removeManyMedia(ids);
                            } else {
                              arm(key);
                            }
                          }}
                          className={`${smallBtn} hover:!text-red-400`}
                        >
                          {bulkBusy
                            ? "Deleting…"
                            : armedDelete === `bulk:${sec.id}`
                              ? "Click again to confirm"
                              : `Delete ${items.filter((m) => selected.has(m.id)).length} selected`}
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((m, i) => (
                      <li
                        key={m.id}
                        draggable
                        onDragStart={(e) => {
                          setDragKey({ sectionId: sec.id, index: i });
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          if (!dragKey || dragKey.sectionId !== sec.id) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverKey?.index !== i) setDragOverKey({ sectionId: sec.id, index: i });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragKey && dragKey.sectionId === sec.id) {
                            reorderWithinSection(sec.id, dragKey.index, i);
                          }
                          setDragKey(null);
                          setDragOverKey(null);
                        }}
                        onDragEnd={() => {
                          setDragKey(null);
                          setDragOverKey(null);
                        }}
                        className={`space-y-3 rounded-md border border-border p-3 transition-colors ${
                          dragKey?.sectionId === sec.id && dragKey.index === i ? "opacity-40" : ""
                        } ${
                          dragKey?.sectionId === sec.id &&
                          dragKey.index !== i &&
                          dragOverKey?.sectionId === sec.id &&
                          dragOverKey.index === i
                            ? "border-accent"
                            : ""
                        }`}
                      >
                        <div className="relative aspect-video overflow-hidden rounded bg-bg-elevated">
                          {m.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaUrl(m.path)}
                              alt={m.alt ?? ""}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video
                              src={`${mediaUrl(m.path)}#t=0.1`}
                              controls
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                          )}
                          <label
                            className="absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-bg/80 backdrop-blur-sm"
                            title="Select for bulk delete"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(m.id)}
                              onChange={() => toggleSelect(m.id)}
                              className="h-4 w-4 accent-[#d7ff3f]"
                            />
                          </label>
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
                          <span className="flex items-center gap-2">
                            <span
                              className="cursor-grab select-none px-1 text-fg-muted transition-colors hover:text-fg active:cursor-grabbing"
                              title="Drag to reorder"
                              aria-hidden
                            >
                              ⠿
                            </span>
                            <span
                              className={m.is_cover ? "font-mono text-xs uppercase tracking-widest text-accent" : ""}
                            >
                              {m.is_cover ? (
                                "Cover"
                              ) : (
                                <button type="button" onClick={() => makeCover(m.id)} className={smallBtn}>
                                  Make cover
                                </button>
                              )}
                            </span>
                          </span>
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
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
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
        {projectId && (
          <button
            type="button"
            onClick={() => {
              if (armedDelete === "project") {
                disarm();
                void deleteProject();
              } else {
                arm("project");
              }
            }}
            disabled={busy}
            className={`${smallBtn} ml-auto hover:!text-red-400`}
          >
            {armedDelete === "project" ? "Click again to permanently delete" : "Delete project"}
          </button>
        )}
      </div>
    </form>
  );
}
