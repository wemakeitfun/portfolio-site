import { galleryColsClass, mediaUrl, type MediaRow } from "@/lib/media";
import type { MediaSection } from "@/lib/portfolio";
import ProjectMedia from "./ProjectMedia";
import MediaSlideshow from "./MediaSlideshow";
import Reveal from "./Reveal";
import DeckRack, { type DeckItem } from "./deck-rack/DeckRack";
import MojoCarousel from "./mojo-carousel/MojoCarousel";

/**
 * Renders every one of a project's sections, in order — each as its own
 * independent grid or slideshow, skipping the cover image (it's already shown
 * as this project's card thumbnail, so it doesn't repeat here) and skipping any
 * section left empty once that's excluded.
 *
 * "3D Deck Rack" sections are different: all of them together form ONE long rack,
 * rendered where the first one sits, and they keep the cover image (it's one of the
 * decks, not just a card thumbnail).
 *
 * A "3D Mojo Carousel" section renders the Mojo tin carousel. Its packs are built in,
 * so it shows even with no media, and only the first such section is used.
 */
export default function ProjectGallery({
  sections,
  coverId,
  title,
}: {
  sections: MediaSection[];
  coverId: string | null;
  /** The page's name, used to describe images that have no title of their own. */
  title?: string;
}) {
  const isDecks = (s: MediaSection) => s.type === "media" && s.style === "decks";
  const decks: DeckItem[] = sections.filter(isDecks).flatMap((s) =>
    s.media
      .filter((m) => m.kind === "image")
      .map((m) => ({ src: mediaUrl(m.path), name: m.alt ?? "", section: s.label })),
  );
  const firstDecksId = sections.find(isDecks)?.id;
  const isMojo = (s: MediaSection) => s.type === "media" && s.style === "mojo";
  const firstMojoId = sections.find(isMojo)?.id;

  const visible = sections
    .filter((s) => (!isDecks(s) || s.id === firstDecksId) && (!isMojo(s) || s.id === firstMojoId))
    .map((s) => (isDecks(s) ? s : { ...s, media: s.media.filter((m) => m.id !== coverId) }))
    .filter((s) =>
      s.type === "text"
        ? s.text_blocks.length > 0
        : isMojo(s) || (isDecks(s) ? decks.length > 0 : s.media.length > 0),
    );

  return (
    <>
      {visible.map((section, i) => {
        const isLast = i === visible.length - 1;
        const pad = isLast ? "pb-(--space-3)" : "pb-(--space-1)";

        const label = section.label && (
          <p
            style={{ maxWidth: `${section.width_percent}%` }}
            className="mx-auto mb-4 font-mono text-xs uppercase tracking-widest text-fg-muted"
          >
            {section.label}
          </p>
        );

        if (section.type === "text") {
          return (
            <section key={section.id} className={`px-page-capped ${pad}`}>
              {label}
              <div
                style={{ maxWidth: `${section.width_percent}%` }}
                className={`mx-auto grid grid-cols-1 gap-(--space-1) ${galleryColsClass(section.columns)}`}
              >
                {section.text_blocks.map((t, k) => (
                  <Reveal
                    key={t.id}
                    delay={(k % section.columns) * 80}
                    className="rounded-2xl bg-bg-elevated p-6 md:p-8"
                  >
                    {t.label && (
                      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-fg-muted">
                        {t.label}
                      </p>
                    )}
                    <p className="whitespace-pre-line text-lg leading-relaxed">{t.body}</p>
                  </Reveal>
                ))}
              </div>
            </section>
          );
        }

        if (isDecks(section)) {
          return (
            <div key={section.id} className={pad}>
              <DeckRack items={decks} />
            </div>
          );
        }

        if (isMojo(section)) {
          return (
            <div key={section.id} className={pad}>
              <MojoCarousel />
            </div>
          );
        }

        if (section.style === "slideshow") {
          return (
            <section key={section.id} className={`px-page-capped ${pad}`}>
              {label}
              {(() => {
                const slideshow = (
                  <MediaSlideshow
                    items={section.media}
                    sizes="(min-width: 768px) 90vw, 100vw"
                    widthPercent={section.width_percent}
                    title={title}
                  />
                );
                return i === 0 ? slideshow : <Reveal>{slideshow}</Reveal>;
              })()}
            </section>
          );
        }

        return (
          <section key={section.id} className={`px-page-capped ${pad}`}>
            {label}
            <div
              style={{ maxWidth: `${section.width_percent}%` }}
              className={`mx-auto grid grid-cols-1 gap-(--space-1) ${galleryColsClass(section.columns)}`}
            >
              {section.media.map((m: MediaRow, j: number) => {
                const figure = (
                <figure key={m.id}>
                  <div
                    className="relative w-full rounded-2xl overflow-hidden bg-bg-elevated border border-border"
                    style={{
                      aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "16 / 9",
                    }}
                  >
                    <ProjectMedia
                      media={m}
                      sizes={`(min-width: 768px) ${Math.round((90 * section.width_percent) / 100 / section.columns)}vw, 100vw`}
                      priority={i === 0 && j === 0}
                      label={
                        title
                          ? `${title} — ${m.kind === "video" ? "video" : "image"} ${j + 1}${section.media.length > 1 ? ` of ${section.media.length}` : ""}`
                          : undefined
                      }
                      fit="contain"
                    />
                  </div>
                  {m.alt && (
                    <figcaption className="mt-3 font-mono text-xs uppercase tracking-widest text-fg-muted">
                      {m.alt}
                    </figcaption>
                  )}
                </figure>
                );
                // The page's first image is its largest paint; don't hold it back.
                return i === 0 && j === 0 ? (
                  figure
                ) : (
                  <Reveal key={m.id} delay={(j % section.columns) * 80}>
                    {figure}
                  </Reveal>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
