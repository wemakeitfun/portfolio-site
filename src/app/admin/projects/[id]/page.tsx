import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import type { MediaRow, ProjectRow, SectionRow } from "@/lib/media";
import ProjectForm from "../ProjectForm";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  // A malformed id would make Postgres throw on the uuid cast; treat it as "not found".
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: project }, { data: media }, { data: sections }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("project_media").select("*").eq("project_id", id).order("sort_order"),
    supabase.from("project_sections").select("*").eq("project_id", id).order("sort_order"),
  ]);
  if (!project) notFound();

  return (
    <ProjectForm
      // remount when navigating between projects so form state resets
      key={id}
      project={project as ProjectRow}
      initialMedia={(media ?? []) as MediaRow[]}
      initialSections={(sections ?? []) as SectionRow[]}
    />
  );
}
