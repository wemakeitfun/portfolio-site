import Marquee from "@/components/Marquee";
import TreatmentSmear from "@/components/TreatmentSmear";
import RevealHeading from "@/components/RevealHeading";
import { getAboutPage } from "@/lib/about";

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

      {about.show_marquee && about.marquee_items.length > 0 && <Marquee items={about.marquee_items} />}

      {about.show_principles && about.principles.length > 0 && (
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
      )}

      {about.show_timeline && about.timeline.length > 0 && (
        <section className="px-6 md:px-10 py-24 md:py-32 border-t border-border">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-14">
            Timeline
          </p>
          <div className="flex flex-col">
            {about.timeline.map((t, i) => (
              <div
                key={`${t.year}-${i}`}
                className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-10 py-8 ${
                  i !== 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="font-mono text-sm text-accent w-24 shrink-0">{t.year}</span>
                <span className="font-display text-2xl md:text-3xl tracking-wide md:w-80 shrink-0">
                  {t.label}
                </span>
                <span className="text-fg-muted">{t.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
