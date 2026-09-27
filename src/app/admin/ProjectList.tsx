"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mediaUrl, type MediaRow, type ProjectRow, type Section } from "@/lib/media";

const SECTIONS: { value: Section; label: string }[] = [
  { value: "work", label: "Work" },
  { value: "ads", label: "Ads" },
  { value: "art", label: "Art" },
  { value: "artificial", label: "Artificial" },
];

type Row = ProjectRow & { cover: MediaRow | null };

function errMsg(err: unknown) {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Couldn't save the new order.";
}

function Thumb({ cover }: { cover: MediaRow | null }) {
  return (
    <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-bg-elevated">
      {cover?.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(cover.path)} alt="" draggable={false} className="h-full w-full object-cover" />
      )}
      {cover?.kind === "video" && (
        <video
          src={`${mediaUrl(cover.path)}#t=0.1`}
          muted
          preload="metadata"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function ProjectList({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [bySection, setBySection] = useState<Record<Section, Row[]>>(() => {
    const grouped: Record<Section, Row[]> = { work: [], ads: [], art: [], artificial: [] };
    for (const row of initial) grouped[row.section].push(row);
    return grouped;
  });
  const [drag, setDrag] = useState<{ section: Section; index: number } | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAny = useMemo(() => Object.values(bySection).some((l) => l.length > 0), [bySection]);

  async function persist(section: Section, list: Row[]) {
    setError(null);
    const ordered = list.map((row, i) => ({ ...row, sort_order: i }));
    setBySection((prev) => ({ ...prev, [section]: ordered }));
    const results = await Promise.all(
      ordered.map((row) =>
        supabase.from("projects").update({ sort_order: row.sort_order }).eq("id", row.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) setError(errMsg(failed.error));
    router.refresh();
  }

  function reorder(section: Section, from: number, to: number) {
    if (from === to) return;
    const list = [...bySection[section]];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    void persist(section, list);
  }

  function moveByKeyboard(section: Section, index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= bySection[section].length) return;
    reorder(section, index, to);
  }

  if (!hasAny) {
    return (
      <p className="rounded-md border border-dashed border-border p-10 text-center text-fg-muted">
        Nothing here yet. Create your first project to start uploading work.
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {SECTIONS.map(({ value: section, label }) => {
        const list = bySection[section];
        if (list.length === 0) return null;

        return (
          <div key={section}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-mono text-xs uppercase tracking-widest text-fg-muted">{label}</h2>
              {list.length > 1 && (
                <p className="font-mono text-[11px] uppercase tracking-widest text-fg-muted">
                  Drag to reorder
                </p>
              )}
            </div>

            <ul className="divide-y divide-border border-y border-border">
              {list.map((p, i) => (
                <li
                  key={p.id}
                  draggable
                  onDragStart={(e) => {
                    setDrag({ section, index: i });
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (drag?.section !== section) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overIndex !== i) setOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag?.section === section) reorder(section, drag.index, i);
                    setDrag(null);
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setOverIndex(null);
                  }}
                  className={`flex items-center gap-3 transition-colors ${
                    drag?.section === section && drag.index === i ? "opacity-40" : ""
                  } ${
                    drag && drag.section === section && drag.index !== i && overIndex === i
                      ? "border-t-2 border-t-accent"
                      : ""
                  }`}
                >
                  <div className="flex shrink-0 flex-col items-center gap-1 self-stretch justify-center pl-1">
                    <button
                      type="button"
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveByKeyboard(section, i, -1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveByKeyboard(section, i, 1);
                        }
                      }}
                      aria-label={`Reorder ${p.title}. Use arrow up or down to move it.`}
                      title="Drag to reorder, or use arrow keys"
                      className="cursor-grab select-none rounded px-1.5 py-3 text-fg-muted transition-colors hover:text-fg active:cursor-grabbing"
                    >
                      ⠿
                    </button>
                  </div>

                  <Link
                    href={`/admin/projects/${p.id}`}
                    draggable={false}
                    className="group flex flex-1 items-center gap-5 py-4 transition-colors hover:bg-bg-elevated"
                  >
                    <Thumb cover={p.cover} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-2xl tracking-wide">{p.title}</p>
                      <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
                        {label} · {p.year ?? "no year"}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs uppercase tracking-widest ${
                        p.published ? "text-accent" : "text-fg-muted"
                      }`}
                    >
                      {p.published ? "Published" : "Draft"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
