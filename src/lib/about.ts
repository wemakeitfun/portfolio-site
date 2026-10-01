import { createClient } from "@supabase/supabase-js";
import type { AboutMediaRow, MediaRow, TextBlockRow } from "./media";
import type { MediaSection } from "./portfolio";

export type Principle = { title: string; detail: string };
export type TimelineEntry = { year: string; label: string; detail: string };

/** The four flexible content blocks below the headline, in the order they render. */
export type ContentBlockKey = "marquee" | "principles" | "timeline" | "sections";
export const DEFAULT_CONTENT_ORDER: ContentBlockKey[] = [
  "marquee",
  "principles",
  "timeline",
  "sections",
];

/**
 * One of the About page's flexible image/video sections, media included.
 * Shaped exactly like a project's MediaSection (ProjectGallery renders both
 * the same way) — `project_id` is padded with a placeholder since About has
 * no project, and nothing in ProjectGallery/ProjectMedia/MediaSlideshow reads it.
 */
export type AboutMediaSection = MediaSection;

export type AboutContent = {
  eyebrow: string;
  headline: string;
  intro: string;
  marquee_items: string[];
  principles: Principle[];
  timeline: TimelineEntry[];
  sections: AboutMediaSection[];
  show_marquee: boolean;
  show_principles: boolean;
  show_timeline: boolean;
  content_order: ContentBlockKey[];
};

// Public, cookie-less client: matches the one in lib/portfolio.ts.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const FALLBACK: AboutContent = {
  eyebrow: "About",
  headline: "About",
  intro: "",
  marquee_items: [],
  principles: [],
  timeline: [],
  sections: [],
  show_marquee: true,
  show_principles: true,
  show_timeline: true,
  content_order: DEFAULT_CONTENT_ORDER,
};

/** ProjectGallery/ProjectMedia/MediaSlideshow are shared with project pages and
 * type their media as MediaRow (which carries project_id/is_cover) — About
 * sections have neither concept, so those two fields are padded with unused
 * placeholders rather than loosening the shared type for every consumer. */
function toMediaRow(m: AboutMediaRow): MediaRow {
  return {
    id: m.id,
    project_id: "",
    section_id: m.section_id,
    kind: m.kind,
    path: m.path,
    poster_path: m.poster_path,
    alt: m.alt,
    width: m.width,
    height: m.height,
    sort_order: m.sort_order,
    is_cover: false,
    autoplay: m.autoplay,
    created_at: m.created_at,
  };
}

export async function getAboutPage(): Promise<AboutContent> {
  const [{ data, error }, { data: sectionRows, error: sectionsError }] = await Promise.all([
    supabase.from("about_page").select("*").eq("id", true).maybeSingle(),
    supabase
      .from("about_sections")
      .select("*, about_media(*), about_text_blocks(*)")
      .order("sort_order", { ascending: true }),
  ]);
  if (error || !data) {
    if (error) console.error("[about] getAboutPage failed:", error.message);
    return FALLBACK;
  }
  if (sectionsError) console.error("[about] fetching sections failed:", sectionsError.message);

  const sections: AboutMediaSection[] = (sectionRows ?? []).map((s) => ({
    id: s.id,
    project_id: "",
    type: s.type,
    style: s.style,
    columns: s.columns,
    width_percent: s.width_percent,
    label: s.label,
    sort_order: s.sort_order,
    created_at: s.created_at,
    media: ((s.about_media ?? []) as AboutMediaRow[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(toMediaRow),
    text_blocks: ((s.about_text_blocks ?? []) as TextBlockRow[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  // Defensive against a stored order that's missing a key (e.g. an older row
  // saved before a block type existed) — append anything missing at the end
  // rather than silently dropping that block from the page.
  const storedOrder = (data.content_order ?? []) as ContentBlockKey[];
  const contentOrder = [
    ...storedOrder.filter((k) => DEFAULT_CONTENT_ORDER.includes(k)),
    ...DEFAULT_CONTENT_ORDER.filter((k) => !storedOrder.includes(k)),
  ];

  return {
    eyebrow: data.eyebrow,
    headline: data.headline,
    intro: data.intro,
    marquee_items: data.marquee_items ?? [],
    principles: (data.principles ?? []) as Principle[],
    timeline: (data.timeline ?? []) as TimelineEntry[],
    sections,
    show_marquee: data.show_marquee ?? true,
    show_principles: data.show_principles ?? true,
    show_timeline: data.show_timeline ?? true,
    content_order: contentOrder,
  };
}
