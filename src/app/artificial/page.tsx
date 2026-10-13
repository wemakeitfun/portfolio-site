import RevealHeading from "@/components/RevealHeading";
import WorkGrid from "@/components/WorkGrid";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export default function ArtificialPage() {
  return (
    <div className="pt-32">
      <section className="px-page pb-(--space-2)">
        <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
          Artificial
        </p>
        <RevealHeading
          as="h1"
          className="font-display text-[13vw] md:text-[7vw] leading-[0.92] tracking-tight"
        >
          AI-assisted work
        </RevealHeading>
        <p className="mt-6 max-w-md text-fg-muted">
          Pieces made with AI tools in the loop.
        </p>
      </section>

      <section className="px-page pb-(--space-3)">
        <WorkGrid section="artificial" />
      </section>
    </div>
  );
}
