export const MEDIA_BUCKET = "portfolio-media";

export type Section = "work" | "ads" | "art" | "artificial" | "generative";
export type HoverEffect = "none" | "smear";
/** "decks" renders a project section as the 3D skateboard deck rack (projects only, not About). */
export type GalleryStyle = "grid" | "slideshow" | "decks";
export type SectionWidth = 25 | 50 | 75 | 100;
export type GalleryColumns = 1 | 2 | 3 | 4 | 5 | 6;
/** "media" is the original image/video gallery; "text" is a row of label+body cards. */
export type SectionKind = "media" | "text";

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
  /** Overrides the page's default background for this project's own page only. */
  background_color: string | null;
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
  type: SectionKind;
  style: GalleryStyle;
  columns: GalleryColumns;
  /** How wide the section renders, as a percentage of the page's content width. */
  width_percent: SectionWidth;
  /** Optional eyebrow label shown above this section on the project page. */
  label: string | null;
  sort_order: number;
  created_at: string;
};

/** One card within a "text" section — a small eyebrow label plus a body paragraph. */
export type TextBlockRow = {
  id: string;
  section_id: string;
  label: string | null;
  body: string;
  sort_order: number;
  created_at: string;
};

/**
 * About page's own sections — same idea as SectionRow, but there's only ever
 * one About page, so no project_id.
 */
export type AboutSectionRow = {
  id: string;
  type: SectionKind;
  style: GalleryStyle;
  columns: GalleryColumns;
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

/** Relative luminance (WCAG) of a hex color, 0 (black) to 1 (white). */
function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const parts =
    c.length === 3
      ? c.split("").map((ch) => parseInt(ch + ch, 16))
      : [c.slice(0, 2), c.slice(2, 4), c.slice(4, 6)].map((h) => parseInt(h, 16));
  const [r, g, b] = parts.map((v) => {
    const s = (v || 0) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whether a hex color reads as "light" (needs dark text/nav for contrast). */
export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.5;
}

/**
 * Inline style for a project page with a custom background color: besides
 * the color itself, it rescopes the fg/accent/border tokens to whichever of
 * the site's two existing readable pairings (dark text on light, or light
 * text on dark) matches that color's lightness — the default white text is
 * otherwise unreadable against a light custom background. Values here must
 * stay in sync with the dark/light theme blocks in globals.css.
 *
 * Overrides `--fg`/`--fg-muted`/etc. directly — the compiled utilities (e.g.
 * `.text-fg-muted { color: var(--fg-muted) }`) reference these tokens
 * themselves, not the `--color-fg` alias `@theme inline` derives from them,
 * which Tailwind only uses for its own build-time resolution.
 *
 * Also sets the plain `color` property: most headings here have no explicit
 * text-color class of their own and just inherit `color` from <body> (which
 * already resolved it to the site's default before reaching this element),
 * so overriding `--fg` alone would never reach them.
 */
export function projectBackgroundStyle(backgroundColor: string | null): Record<string, string> | undefined {
  if (!backgroundColor) return undefined;
  const isLight = isLightColor(backgroundColor);
  const fg = isLight ? "#0a0a0b" : "#f3f2ec";
  return {
    backgroundColor,
    color: fg,
    "--bg-elevated": isLight ? "#f2f1ec" : "#111113",
    "--fg": fg,
    "--fg-muted": isLight ? "#5f5e58" : "#8c8b87",
    "--accent": isLight ? "#6b8500" : "#d7ff3f",
    "--border": isLight ? "rgba(10, 10, 11, 0.12)" : "rgba(243, 242, 236, 0.12)",
  };
}

// Written out as literal classes (not built from a template) so Tailwind's
// scanner can find them — a computed `md:grid-cols-${n}` wouldn't be picked up.
const GALLERY_COLS_CLASS: Record<GalleryColumns, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

/** Tailwind class for a project's gallery grid, at the column count set in the admin. */
export function galleryColsClass(columns: GalleryColumns) {
  return GALLERY_COLS_CLASS[columns] ?? GALLERY_COLS_CLASS[1];
}
