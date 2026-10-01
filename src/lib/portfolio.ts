import { createClient } from "@supabase/supabase-js";
import type { MediaRow, ProjectRow, Section, SectionRow, TextBlockRow } from "./media";

/** A gallery section with its media and text cards attached and sorted, ready to render. */
export type MediaSection = SectionRow & { media: MediaRow[]; text_blocks: TextBlockRow[] };

/** For card listings — cheap, no section/media detail beyond the cover. */
export type ProjectSummary = ProjectRow & { cover: MediaRow | null };

/** For a project's own page — every section, in order, each with its own media. */
export type Project = ProjectRow & { sections: MediaSection[]; cover: MediaRow | null };

// Public, cookie-less client: it only sees what row-level security allows anonymous
// visitors to see (published projects, and the sections/media of published projects).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ---- Listings (cards) ----

type SummaryRow = ProjectRow & { project_media: MediaRow[] };

function shapeSummary({ project_media, ...project }: SummaryRow): ProjectSummary {
  const media = [...project_media].sort((a, b) => a.sort_order - b.sort_order);
  return { ...project, cover: media.find((m) => m.is_cover) ?? media[0] ?? null };
}

/** Published projects in a section, in the order set in the admin. */
export async function getProjects(section: Section = "work", limit?: number): Promise<ProjectSummary[]> {
  let query = supabase
    .from("projects")
    .select("*, project_media(*)")
    .eq("section", section)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error("[portfolio] getProjects failed:", error.message);
    return [];
  }
  return (data as unknown as SummaryRow[]).map(shapeSummary);
}

// ---- A single project's own page ----

type DetailRow = ProjectRow & {
  project_sections: (SectionRow & { project_media: MediaRow[]; project_text_blocks: TextBlockRow[] })[];
};

export async function getProject(slug: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_sections(*, project_media(*), project_text_blocks(*))")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[portfolio] getProject failed:", error.message);
    return null;
  }
  if (!data) return null;

  const { project_sections, ...project } = data as unknown as DetailRow;
  const sections: MediaSection[] = [...project_sections]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ project_media, project_text_blocks, ...section }) => ({
      ...section,
      media: [...project_media].sort((a, b) => a.sort_order - b.sort_order),
      text_blocks: [...project_text_blocks].sort((a, b) => a.sort_order - b.sort_order),
    }));
  const allMedia = sections.flatMap((s) => s.media);

  return { ...project, sections, cover: allMedia.find((m) => m.is_cover) ?? allMedia[0] ?? null };
}

/** The project after this one in the same section (wraps around), or null if it's the only one. */
export async function getNextProject(project: Project): Promise<ProjectSummary | null> {
  const list = await getProjects(project.section);
  if (list.length < 2) return null;
  const i = list.findIndex((p) => p.id === project.id);
  return list[(i + 1) % list.length];
}

export async function getSlugs(section: Section): Promise<string[]> {
  const { data, error } = await supabase.from("projects").select("slug").eq("section", section);
  if (error) {
    console.error("[portfolio] getSlugs failed:", error.message);
    return [];
  }
  return (data ?? []).map((p: { slug: string }) => p.slug);
}
