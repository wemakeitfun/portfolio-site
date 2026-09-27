import { galleryColsClass, type MediaRow } from "@/lib/media";
import type { MediaSection } from "@/lib/portfolio";
import ProjectMedia from "./ProjectMedia";
import MediaSlideshow from "./MediaSlideshow";

/**
 * Renders every one of a project's sections, in order — each as its own
 * independent grid or slideshow, skipping the cover image (it's already shown
 * as this project's card thumbnail, so it doesn't repeat here) and skipping any
 * section left empty once that's excluded.
 */
export default function ProjectGallery({
  sections,
  coverId,
}: {
  sections: MediaSection[];
  coverId: string | null;
}) {
  const visible = sections
    .map((s) => ({ ...s, media: s.media.filter((m) => m.id !== coverId) }))
    .filter((s) => s.media.length > 0);

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
                    className="relative w-full max-h-[75vh] rounded-2xl overflow-hidden bg-bg-elevated border border-border"
                    style={{ aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "16 / 9" }}
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
