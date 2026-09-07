import RevealHeading from "@/components/RevealHeading";
import WorkGrid from "@/components/WorkGrid";

export default function WorkPage() {
  return (
    <div className="pt-32">
      <section className="px-6 md:px-10 pb-16 md:pb-24">
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

      <section className="px-6 md:px-10 pb-24 md:pb-32">
        <WorkGrid />
      </section>
    </div>
  );
}
