import type { Metadata } from "next";
import { mediaUrl, type Section } from "./media";
import { getProject } from "./portfolio";

export const SITE_URL = "https://kahncept.com";
export const SITE_NAME = "Adam Kahn / Kahncept";
export const HOME_TITLE = "Adam Kahn / Kahncept — Creative Director, Artist & AI Builder";
export const HOME_DESCRIPTION =
  "Adam Kahn / Kahncept — 20 years making ads, a lifetime making art, now rebuilding how both get made.";
const DEFAULT_OG_IMAGE = "/og-image.jpg";

/** One line of plain text, cut at a word boundary so it fits a search snippet. */
export function trimDescription(text: string | null | undefined, max = 157): string | undefined {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return undefined;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length).replace(/[.,;:—-]+$/, "")}…`;
}

/**
 * Title, description, canonical, and share-card tags for one page. Next replaces a
 * page's whole `openGraph`/`twitter` object rather than merging it with the layout's,
 * so every field is spelled out here.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
}: {
  title: string;
  description?: string;
  path: string;
  image?: string;
  imageAlt?: string;
}): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const images = [{ url: image ?? DEFAULT_OG_IMAGE, alt: imageAlt ?? title }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      images,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images },
  };
}

/** A project page's metadata, from the same fields that fill the page. */
export async function projectMetadata(section: Section, slug: string): Promise<Metadata> {
  const project = await getProject(slug);
  if (!project || project.section !== section) return {};

  // A share card needs a decent static image: a video, an animated GIF, or a small
  // thumbnail would preview badly (or be rejected), so those fall back to the site's.
  // Routed through the image optimizer so a huge upload still arrives at a sane size.
  const cover = project.cover;
  const usableCover =
    cover?.kind === "image" && !/\.gif$/i.test(cover.path) && (cover.width ?? Infinity) >= 600;
  const image = usableCover
    ? `${SITE_URL}/_next/image?url=${encodeURIComponent(mediaUrl(cover.path))}&w=1200&q=75`
    : undefined;

  // A one-word summary or "coming soon" makes a poor search snippet; write a plain
  // sentence from the project's own fields instead.
  const MIN_USEFUL = 40;
  const KIND: Record<Section, string> = {
    work: "a project",
    ads: "an ad campaign",
    art: "personal art",
    artificial: "AI-assisted work",
    generative: "a generative experiment",
  };
  const fromFields = `${project.title}${project.client && !project.title.toLowerCase().includes(project.client.toLowerCase()) ? ` for ${project.client}` : ""} — ${KIND[section]} by ${SITE_NAME}${project.year ? `, ${project.year}` : ""}.`;
  const written = [project.summary, project.description]
    .map((s) => trimDescription(s))
    .find((s) => s && s.length >= MIN_USEFUL);
  const description = written ?? trimDescription(fromFields);

  return pageMetadata({
    title: project.title,
    description,
    path: `/${section}/${slug}`,
    image,
    imageAlt: project.cover?.alt ?? project.title,
  });
}
