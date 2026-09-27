import NameSmear from "@/components/NameSmear";
import RevealHeading from "@/components/RevealHeading";
import WorkGrid from "@/components/WorkGrid";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export default function ArtPage() {
  return (
    <>
      {/* paper is given explicitly (not left to auto-detect --bg) so it's always
          white here regardless of exactly when the light theme class lands relative
          to this mounting — see RouteTheme.tsx for how that class gets set. */}
      <NameSmear text="Kahncept" ink="#ff004e" paper="#ffffff" />

      <div className="pt-32">
        <section className="px-6 md:px-10 pb-16 md:pb-24">
          <p className="font-mono text-xs uppercase tracking-widest text-accent mb-4">
            Art
          </p>
          <RevealHeading
            as="h1"
            className="font-display text-[13vw] md:text-[7vw] leading-[0.92] tracking-tight"
          >
            Personal work
          </RevealHeading>
          <p className="mt-6 max-w-md text-fg-muted">
            Independent pieces, made for their own sake.
          </p>
        </section>

        <section className="px-6 md:px-10 pb-24 md:pb-32">
          <WorkGrid section="art" />
        </section>
      </div>
    </>
  );
}
