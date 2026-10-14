import type { Metadata } from "next";
import { mediaUrl, type Section } from "./media";
import { getProject, getProjects, type Project } from "./portfolio";

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

/**
 * A section listing page's metadata. While the section has no published projects the page
 * is just an "on the way" message, so it's kept out of search; that switches off by itself
 * once something is published there.
 */
export async function listingMetadata(
  section: Section,
  meta: { title: string; description: string; path: string },
): Promise<Metadata> {
  const base = pageMetadata(meta);
  const hasProjects = (await getProjects(section, 1)).length > 0;
  return hasProjects ? base : { ...base, robots: { index: false, follow: true } };
}

/**
 * The project's cover as a 1200px-wide image URL, or undefined when the cover can't make
 * a good card (a video, an animated GIF, or a small thumbnail would preview badly or be
 * rejected). Routed through the image optimizer so a huge upload still arrives at a sane size.
 */
export function projectImageUrl(project: Project): string | undefined {
  const cover = project.cover;
  const usable =
    cover?.kind === "image" && !/\.gif$/i.test(cover.path) && (cover.width ?? Infinity) >= 600;
  return usable
    ? `${SITE_URL}/_next/image?url=${encodeURIComponent(mediaUrl(cover.path))}&w=1200&q=75`
    : undefined;
}

// ---- Structured data (schema.org JSON-LD) ----

const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** Where each section's listing page lives, for breadcrumbs. */
const SECTION_CRUMB: Record<Section, string> = {
  work: "Work",
  ads: "Ads",
  art: "Art",
  artificial: "AI",
  generative: "Generative",
};

export function personJsonLd(): Record<string, unknown> {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Adam Kahn",
    alternateName: "Kahncept",
    url: SITE_URL,
    image: `${SITE_URL}/about/headshot.webp`,
    jobTitle: "Creative Director",
    description: HOME_DESCRIPTION,
    sameAs: ["https://instagram.com/kahncept", "https://linkedin.com/in/kahncept"],
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": PERSON_ID },
  };
}

/** Homepage: who the site belongs to, and the site itself. */
export function homeJsonLd(): Record<string, unknown> {
  return { "@context": "https://schema.org", "@graph": [personJsonLd(), websiteJsonLd()] };
}

/** About page: a profile page whose subject is the person. */
export function aboutJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${SITE_URL}/about#page`,
    url: `${SITE_URL}/about`,
    name: `About | ${SITE_NAME}`,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: personJsonLd(),
  };
}

/** A project page: the work itself, plus where it sits in the site. */
export function projectJsonLd(project: Project): Record<string, unknown> {
  const url = `${SITE_URL}/${project.section}/${project.slug}`;
  const description =
    trimDescription(project.summary) ?? trimDescription(project.description);
  const year = project.year && /^\d{4}$/.test(project.year) ? project.year : undefined;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${url}#work`,
        name: project.title,
        url,
        ...(description && { description }),
        image: projectImageUrl(project) ?? `${SITE_URL}${DEFAULT_OG_IMAGE}`,
        creator: { "@id": PERSON_ID },
        isPartOf: { "@id": WEBSITE_ID },
        ...(year && { dateCreated: year }),
        ...(project.category && { genre: project.category }),
        ...(project.services.length > 0 && { keywords: project.services.join(", ") }),
        ...(project.client && { mentions: { "@type": "Organization", name: project.client } }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: SECTION_CRUMB[project.section],
            item: `${SITE_URL}/${project.section}`,
          },
          { "@type": "ListItem", position: 3, name: project.title, item: url },
        ],
      },
      personJsonLd(),
    ],
  };
}

/** A project page's metadata, from the same fields that fill the page. */
export async function projectMetadata(section: Section, slug: string): Promise<Metadata> {
  const project = await getProject(slug);
  if (!project || project.section !== section) return {};

  const image = projectImageUrl(project);

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
