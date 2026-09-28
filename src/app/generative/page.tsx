import RevealHeading from "@/components/RevealHeading";
import WorkGrid from "@/components/WorkGrid";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export default function GenerativePage() {
  return (
    <div className="pt-32">
      <section className="px-6 md:px-10 pb-16 md:pb-24">
        <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
          Generative
        </p>
        <RevealHeading
          as="h1"
          className="font-display text-[13vw] md:text-[7vw] leading-[0.92] tracking-tight"
        >
          Generative experiments
        </RevealHeading>
        <p className="mt-6 max-w-md text-fg-muted">
          Systems and prompts that make the work themselves.
        </p>
      </section>

      <section className="px-6 md:px-10 pb-24 md:pb-32">
        <WorkGrid section="generative" />
      </section>
    </div>
  );
}
