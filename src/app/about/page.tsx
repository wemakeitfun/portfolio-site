import Marquee from "@/components/Marquee";
import RevealHeading from "@/components/RevealHeading";

const timeline = [
  { year: "2019", label: "Studio founded", detail: "Started as a two-person freelance team." },
  { year: "2021", label: "First retained client", detail: "Began working with recurring product teams." },
  { year: "2023", label: "Grew to five", detail: "Added dedicated engineering and motion roles." },
  { year: "2026", label: "40+ projects shipped", detail: "Across product, brand, and web." },
];

const values = [
  {
    title: "Design in code",
    detail: "We prototype and often ship in the real medium, not just static comps — decisions hold up under real content and real interaction.",
  },
  {
    title: "Small, senior team",
    detail: "No account layers. The people who scope the project are the people building it.",
  },
  {
    title: "Systems over one-offs",
    detail: "Every deliverable is built to extend — a component, a token, a pattern the team can keep using after we're gone.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-32">
      <section className="px-6 md:px-10 pb-16 md:pb-24">
        <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
          About
        </p>
        <RevealHeading
          as="h1"
          className="font-display text-[12vw] md:text-[6vw] leading-[0.95] tracking-tight max-w-5xl"
        >
          A small studio, built for teams who care about the details.
        </RevealHeading>
        <p className="mt-8 max-w-xl text-fg-muted">
          Arc Studio is an independent design and development team. We work
          with founders and product teams who need a partner across the
          whole lifecycle — strategy, interface, identity, and the code that
          ships it.
        </p>
      </section>

      <Marquee items={["Strategy", "Design", "Development", "Motion", "Brand"]} />

      <section className="px-6 md:px-10 py-24 md:py-32 grid md:grid-cols-3 gap-10">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
          How we work
        </p>
        <div className="md:col-span-2 flex flex-col gap-14">
          {values.map((v) => (
            <div key={v.title}>
              <h3 className="font-display text-3xl md:text-4xl tracking-wide mb-3">
                {v.title}
              </h3>
              <p className="text-fg-muted max-w-lg">{v.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-border">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-14">
          Timeline
        </p>
        <div className="flex flex-col">
          {timeline.map((t, i) => (
            <div
              key={t.year}
              className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-10 py-8 ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="font-mono text-sm text-accent w-24 shrink-0">
                {t.year}
              </span>
              <span className="font-display text-2xl md:text-3xl tracking-wide md:w-80 shrink-0">
                {t.label}
              </span>
              <span className="text-fg-muted">{t.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
