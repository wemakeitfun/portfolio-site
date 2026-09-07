import Hero from "@/components/Hero";
import WorkGrid from "@/components/WorkGrid";
import Marquee from "@/components/Marquee";
import Link from "next/link";

const services = [
  "Product Design",
  "Brand Identity",
  "Web Development",
  "Design Systems",
  "Motion Design",
];

export default function Home() {
  return (
    <>
      <Hero />

      <Marquee items={services} />

      <section className="px-6 md:px-10 py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14 md:mb-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-accent mb-3">
              Selected Work
            </p>
            <h2 className="font-display text-5xl md:text-6xl tracking-wide">
              Recent projects
            </h2>
          </div>
          <Link
            href="/work"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest border-b border-fg pb-1 self-start"
          >
            View all work
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <WorkGrid limit={4} />
      </section>

      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-border">
        <div className="grid md:grid-cols-3 gap-10">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
            About the studio
          </p>
          <p className="md:col-span-2 font-display text-3xl md:text-4xl leading-[1.15] tracking-wide">
            We&apos;re a small studio that treats design and engineering as one
            discipline — every project ships as working code, not just a
            handoff file.
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
