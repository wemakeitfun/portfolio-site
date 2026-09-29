import type { ReactNode } from "react";
import Marquee from "@/components/Marquee";
import ProjectGallery from "@/components/ProjectGallery";
import Timeline from "@/components/Timeline";
import TreatmentSmear from "@/components/TreatmentSmear";
import RevealHeading from "@/components/RevealHeading";
import { getAboutPage, type ContentBlockKey } from "@/lib/about";

// Edits from the admin show up within a minute.
export const revalidate = 60;

// A random two of these play base/reveal each time the page loads.
const ABOUT_TREATMENT_IMAGES = [
  "/about/treatments/blank.webp",
  "/about/treatments/soap.webp",
  "/about/treatments/silver.webp",
  "/about/treatments/pink.webp",
  "/about/treatments/puffer.webp",
];

export default async function AboutPage() {
  const about = await getAboutPage();

  const blocks: Partial<Record<ContentBlockKey, ReactNode>> = {};

  if (about.show_marquee && about.marquee_items.length > 0) {
    blocks.marquee = <Marquee items={about.marquee_items} />;
  }

  if (about.show_principles && about.principles.length > 0) {
    blocks.principles = (
      <section className="px-6 md:px-10 py-24 md:py-32 grid md:grid-cols-3 gap-10">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
          How we work
        </p>
        <div className="md:col-span-2 flex flex-col gap-14">
          {about.principles.map((p) => (
            <div key={p.title}>
              <h3 className="font-display text-3xl md:text-4xl tracking-wide mb-3">
                {p.title}
              </h3>
              <p className="text-fg-muted max-w-lg">{p.detail}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (about.show_timeline && about.timeline.length > 0) {
    blocks.timeline = (
      <section className="px-6 md:px-10 py-24 md:py-32">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-14">
          Timeline
        </p>
        <Timeline entries={about.timeline} />
      </section>
    );
  }

  if (about.sections.length > 0) {
    blocks.sections = (
      <div className="pt-24 md:pt-32">
        <ProjectGallery sections={about.sections} coverId={null} />
      </div>
    );
  }

  const ordered = about.content_order
    .map((key) => ({ key, node: blocks[key] }))
    .filter((b): b is { key: ContentBlockKey; node: ReactNode } => !!b.node);

  return (
    <div>
      <TreatmentSmear images={ABOUT_TREATMENT_IMAGES} alt="About Me" />

      <section className="px-6 md:px-10 pt-16 pb-16 md:pb-24">
        <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
          {about.eyebrow}
        </p>
        <RevealHeading
          as="h1"
          className="font-display text-[12vw] md:text-[6vw] leading-[0.95] tracking-tight max-w-5xl whitespace-pre-line"
        >
          {about.headline}
        </RevealHeading>
        {about.intro && <p className="mt-8 max-w-xl text-fg-muted">{about.intro}</p>}
      </section>

      {ordered.map(({ key, node }, i) => (
        <div key={key} className={i > 0 ? "border-t border-border" : ""}>
          {node}
        </div>
      ))}
    </div>
  );
}
