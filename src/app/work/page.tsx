import RevealHeading from "@/components/RevealHeading";
import WorkGrid from "@/components/WorkGrid";
import { listingMetadata } from "@/lib/seo";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export const generateMetadata = () =>
  listingMetadata("work", {
    title: "Work",
    description: "Selected products, brands, and interfaces by Adam Kahn / Kahncept.",
    path: "/work",
  });

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
          Selected products, brands, and interfaces.
        </p>
      </section>

      <section className="px-page pb-(--space-3)">
        <WorkGrid />
      </section>
    </div>
  );
}
