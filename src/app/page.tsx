import Hero from "@/components/Hero";
import PortraitReveal from "@/components/PortraitReveal";
import WorkGrid from "@/components/WorkGrid";
import Marquee from "@/components/Marquee";
import Link from "next/link";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

const services = [
  "Conceptual",
  "Artist",
  "Designer",
  "Game Designer",
  "AI Builder",
  "Systems Thinker",
  "Creative Director",
  "Strategic",
  "Storyteller",
  "World Builder",
  "Director",
  "Leader",
  "Team Builder",
  "Dreamer",
  "Early Adopter",
];

export default function Home() {
  return (
    <>
      <PortraitReveal
        base="/about/headshot.webp"
        reveal="/about/xray.webp"
        alt="Adam Kahn"
        overlayText={{ value: "Hi I'm Adam" }}
      />

      <Hero />

      <Marquee items={services} />

      <section className="px-6 md:px-10 py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14 md:mb-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">
              Selected AI
            </p>
            <h2 className="font-display text-5xl md:text-6xl tracking-wide">
              Recent AI work
            </h2>
          </div>
          <Link
            href="/artificial"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest border-b border-fg pb-1 self-start"
          >
            View all AI
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <WorkGrid section="artificial" limit={4} />
      </section>

      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-border">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14 md:mb-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">
              Selected Art
            </p>
            <h2 className="font-display text-5xl md:text-6xl tracking-wide">
              Recent art
            </h2>
          </div>
          <Link
            href="/art"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest border-b border-fg pb-1 self-start"
          >
            View all art
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <WorkGrid section="art" limit={4} />
      </section>

      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-border">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14 md:mb-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">
              Selected Ads
            </p>
            <h2 className="font-display text-5xl md:text-6xl tracking-wide">
              Recent projects
            </h2>
          </div>
          <Link
            href="/ads"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest border-b border-fg pb-1 self-start"
          >
            View all ads
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <WorkGrid section="ads" limit={4} />
      </section>

      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-border">
        <div className="grid md:grid-cols-3 gap-10">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
            About Adam
          </p>
          <p className="md:col-span-2 font-display text-3xl md:text-4xl leading-[1.15] tracking-wide">
            I sit at the intersection of creativity and innovation, and
            lately that intersection has gotten very busy.
          </p>
        </div>
        <div className="mt-10">
          <Link
            href="/about"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest border-b border-fg pb-1"
          >
            More about us
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
