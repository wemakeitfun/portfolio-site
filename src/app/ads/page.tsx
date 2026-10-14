import { pageMetadata } from "@/lib/seo";
import RevealHeading from "@/components/RevealHeading";
import WorkGrid from "@/components/WorkGrid";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export const metadata = pageMetadata({
  title: "Ads",
  description:
    "Selected ad campaigns and commercial film work by Adam Kahn — spots, campaigns, and brand work.",
  path: "/ads",
});

export default function AdsPage() {
  return (
    <div className="pt-32">
      <section className="px-page pb-(--space-2)">
        <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
          Ads
        </p>
        <RevealHeading
          as="h1"
          className="font-display text-[13vw] md:text-[7vw] leading-[0.92] tracking-tight"
        >
          Selected campaigns
        </RevealHeading>
        <p className="mt-6 max-w-md text-fg-muted">
          Spots, campaigns, and commercial work.
        </p>
      </section>

      <section className="px-page pb-(--space-3)">
        <WorkGrid section="ads" />
      </section>
    </div>
  );
}
