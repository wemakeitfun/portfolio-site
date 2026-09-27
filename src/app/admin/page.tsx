import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import type { MediaRow, ProjectRow } from "@/lib/media";
import SignOutButton from "./SignOutButton";
import ProjectList from "./ProjectList";
import VideoPlaybackControl from "./VideoPlaybackControl";

export default async function AdminHome() {
  const { supabase, user } = await requireAdmin();

  const [{ data: projects }, { data: media }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .order("section")
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase.from("project_media").select("*").order("sort_order"),
  ]);

  const rows = (projects ?? []) as ProjectRow[];
  const allMedia = (media ?? []) as MediaRow[];
  const coverOf = (id: string) => {
    const mine = allMedia.filter((m) => m.project_id === id);
    return mine.find((m) => m.is_cover) ?? mine[0] ?? null;
  };
  const withCovers = rows.map((p) => ({ ...p, cover: coverOf(p.id) }));

  return (
    <>
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-fg-muted">
            {user.email}
          </p>
          <h1 className="font-display text-5xl tracking-wide md:text-6xl">Projects</h1>
        </div>
        <div className="flex items-center gap-6">
          <SignOutButton />
          <Link
            href="/admin/about"
            className="font-mono text-xs uppercase tracking-widest text-fg-muted transition-colors hover:text-fg"
          >
            Edit about page
          </Link>
          <Link
            href="/admin/projects/new"
            className="rounded-full bg-accent px-6 py-3 font-mono text-xs font-medium uppercase tracking-widest text-[#0a0a0b]"
          >
            New project
          </Link>
        </div>
      </div>

      <div className="mb-10 rounded-lg border border-border p-4">
        <VideoPlaybackControl />
      </div>

      <ProjectList initial={withCovers} />
    </>
  );
}
