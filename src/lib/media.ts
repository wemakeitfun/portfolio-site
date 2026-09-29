export const MEDIA_BUCKET = "portfolio-media";

export type Section = "work" | "ads" | "art" | "artificial" | "generative";
export type HoverEffect = "none" | "smear";
export type GalleryStyle = "grid" | "slideshow";
export type SectionWidth = 25 | 50 | 75 | 100;

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  section: Section;
  year: string | null;
  category: string | null;
  client: string | null;
  summary: string | null;
  description: string | null;
  services: string[];
  accent: string | null;
  gradient: string | null;
  hover_effect: HoverEffect;
  /**
   * Legacy single-gallery settings — superseded by project_sections (see
   * SectionRow below), which let a project have any number of independent
   * galleries. Kept only so old rows still type-check; no longer read anywhere.
   */
  gallery_columns: 1 | 2 | 3 | 4;
  gallery_style: GalleryStyle;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MediaRow = {
  id: string;
  project_id: string;
  section_id: string | null;
  kind: "image" | "video";
  path: string;
  poster_path: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_cover: boolean;
  /** Videos only: start muted and looping on their own when scrolled into view. */
  autoplay: boolean;
  created_at: string;
};

/** One independent gallery within a project's page — its own media, in its own style. */
export type SectionRow = {
  id: string;
  project_id: string;
  style: GalleryStyle;
  columns: 1 | 2 | 3 | 4;
  /** How wide the section renders, as a percentage of the page's content width. */
  width_percent: SectionWidth;
  /** Optional eyebrow label shown above this section on the project page. */
  label: string | null;
  sort_order: number;
  created_at: string;
};

/**
 * About page's own sections — same idea as SectionRow, but there's only ever
 * one About page, so no project_id.
 */
export type AboutSectionRow = {
  id: string;
  style: GalleryStyle;
  columns: 1 | 2 | 3 | 4;
  width_percent: SectionWidth;
  label: string | null;
  sort_order: number;
  created_at: string;
};

export type AboutMediaRow = {
  id: string;
  section_id: string;
  kind: "image" | "video";
  path: string;
  poster_path: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  autoplay: boolean;
  created_at: string;
};

/** Public URL of a file in the portfolio-media bucket. */
export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

// Written out as literal classes (not built from a template) so Tailwind's
// scanner can find them — a computed `md:grid-cols-${n}` wouldn't be picked up.
const GALLERY_COLS_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/** Tailwind class for a project's gallery grid, at the column count set in the admin. */
export function galleryColsClass(columns: 1 | 2 | 3 | 4) {
  return GALLERY_COLS_CLASS[columns] ?? GALLERY_COLS_CLASS[1];
}
