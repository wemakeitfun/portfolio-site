import RevealHeading from "@/components/RevealHeading";
import WorkGrid from "@/components/WorkGrid";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export default function WorkPage() {
  return (
    <div className="pt-32">
      <section className="px-page pb-(--space-2)">
        <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
          Work
        </p>
        <RevealHeading
          as="h1"
          className="font-display text-[13vw] md:text-[7vw] leading-[0.92] tracking-tight"
        >
          Selected projects
        </RevealHeading>
        <p className="mt-6 max-w-md text-fg-muted">
          A handful of the products, brands, and interfaces we&apos;ve shipped
          over the last few years.
        </p>
      </section>

      <section className="px-page pb-(--space-3)">
        <WorkGrid />
      </section>
    </div>
  );
}
