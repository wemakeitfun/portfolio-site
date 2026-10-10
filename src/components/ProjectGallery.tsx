import { galleryColsClass, mediaUrl, type MediaRow } from "@/lib/media";
import type { MediaSection } from "@/lib/portfolio";
import ProjectMedia from "./ProjectMedia";
import MediaSlideshow from "./MediaSlideshow";
import DeckRack, { type DeckItem } from "./deck-rack/DeckRack";

/**
 * Renders every one of a project's sections, in order — each as its own
 * independent grid or slideshow, skipping the cover image (it's already shown
 * as this project's card thumbnail, so it doesn't repeat here) and skipping any
 * section left empty once that's excluded.
 *
 * "3D Deck Rack" sections are different: all of them together form ONE long rack,
 * rendered where the first one sits, and they keep the cover image (it's one of the
 * decks, not just a card thumbnail).
 */
export default function ProjectGallery({
  sections,
  coverId,
}: {
  sections: MediaSection[];
  coverId: string | null;
}) {
  const isDecks = (s: MediaSection) => s.type === "media" && s.style === "decks";
  const decks: DeckItem[] = sections.filter(isDecks).flatMap((s) =>
    s.media
      .filter((m) => m.kind === "image")
      .map((m) => ({ src: mediaUrl(m.path), name: m.alt ?? "", section: s.label })),
  );
  const firstDecksId = sections.find(isDecks)?.id;

  const visible = sections
    .filter((s) => !isDecks(s) || s.id === firstDecksId)
    .map((s) => (isDecks(s) ? s : { ...s, media: s.media.filter((m) => m.id !== coverId) }))
    .filter((s) => (s.type === "text" ? s.text_blocks.length > 0 : isDecks(s) ? decks.length > 0 : s.media.length > 0));

  return (
    <>
      {visible.map((section, i) => {
        const isLast = i === visible.length - 1;
        const pad = isLast ? "pb-24 md:pb-32" : "pb-6 md:pb-8";

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
            <section key={section.id} className={`px-6 md:px-10 ${pad}`}>
              {label}
              <div
                style={{ maxWidth: `${section.width_percent}%` }}
                className={`mx-auto grid grid-cols-1 gap-6 md:gap-8 ${galleryColsClass(section.columns)}`}
              >
                {section.text_blocks.map((t) => (
                  <div key={t.id} className="rounded-2xl bg-bg-elevated p-6 md:p-8">
                    {t.label && (
                      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-fg-muted">
                        {t.label}
                      </p>
                    )}
                    <p className="whitespace-pre-line text-lg leading-relaxed">{t.body}</p>
                  </div>
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

        if (section.style === "slideshow") {
          return (
            <section key={section.id} className={`px-6 md:px-10 ${pad}`}>
              {label}
              <MediaSlideshow
                items={section.media}
                sizes="(min-width: 768px) 90vw, 100vw"
                widthPercent={section.width_percent}
              />
            </section>
          );
        }

        return (
          <section key={section.id} className={`px-6 md:px-10 ${pad}`}>
            {label}
            <div
              style={{ maxWidth: `${section.width_percent}%` }}
              className={`mx-auto grid grid-cols-1 gap-6 md:gap-8 ${galleryColsClass(section.columns)}`}
            >
              {section.media.map((m: MediaRow, j: number) => (
                <figure key={m.id}>
                  <div
                    className="relative mx-auto max-h-[75vh] max-w-full rounded-2xl overflow-hidden bg-bg-elevated border border-border"
                    style={{
                      aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "16 / 9",
                      // A tall image (e.g. a full infographic) at full column width would blow
                      // past max-h-[75vh], get clamped there, and then sit letterboxed inside
                      // a now-too-wide box. Deriving the width from the height cap instead
                      // keeps the box itself the right shape, so the whole image stays legible.
                      width:
                        m.width && m.height
                          ? `min(100%, calc(75vh * ${m.width} / ${m.height}))`
                          : "100%",
                    }}
                  >
                    <ProjectMedia
                      media={m}
                      sizes={`(min-width: 768px) ${Math.round((90 * section.width_percent) / 100 / section.columns)}vw, 100vw`}
                      priority={i === 0 && j === 0}
                      fit="contain"
                    />
                  </div>
                  {m.alt && (
                    <figcaption className="mt-3 font-mono text-xs uppercase tracking-widest text-fg-muted">
                      {m.alt}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
