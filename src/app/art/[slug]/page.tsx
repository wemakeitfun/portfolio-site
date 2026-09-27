import Link from "next/link";
import { notFound } from "next/navigation";
import { getNextProject, getProject, getSlugs } from "@/lib/portfolio";
import RevealHeading from "@/components/RevealHeading";
import ProjectGallery from "@/components/ProjectGallery";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export async function generateStaticParams() {
  return (await getSlugs("art")).map((slug) => ({ slug }));
}

export default async function ArtProjectPage(props: PageProps<"/art/[slug]">) {
  const { slug } = await props.params;
  const project = await getProject(slug);
  if (!project || project.section !== "art") notFound();

  const next = await getNextProject(project);

  return (
    <div className="pt-32">
      <section className="px-6 md:px-10 pb-10">
        <Link
          href="/art"
          className="font-mono text-xs uppercase tracking-widest text-fg-muted hover:text-fg transition-colors"
        >
          ← Back to art
        </Link>

        <div className="mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <RevealHeading
            as="h1"
            className="font-display text-[12vw] md:text-[6vw] leading-[0.92] tracking-tight max-w-4xl"
          >
            {project.title}
          </RevealHeading>
          <div className="flex gap-8 font-mono text-xs uppercase tracking-widest text-fg-muted shrink-0">
            {project.client && (
              <div>
                <p className="text-fg-muted mb-1">Client</p>
                <p className="text-fg">{project.client}</p>
              </div>
            )}
            {project.year && (
              <div>
                <p className="text-fg-muted mb-1">Year</p>
                <p className="text-fg">{project.year}</p>
              </div>
            )}
            {project.services.length > 0 && (
              <div>
                <p className="text-fg-muted mb-1">Services</p>
                <p className="text-fg">{project.services.join(" · ")}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {(project.summary || project.description) && (
        <section className="px-6 md:px-10 pb-16 pt-6 grid md:grid-cols-2 gap-x-12 gap-y-10">
          {project.summary && (
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-4">
                Summary
              </p>
              <p className="text-lg md:text-xl leading-relaxed">{project.summary}</p>
            </div>
          )}
          {project.description && (
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-4">
                Description
              </p>
              <p className="text-lg md:text-xl leading-relaxed whitespace-pre-line">
                {project.description}
              </p>
            </div>
          )}
        </section>
      )}

      <ProjectGallery sections={project.sections} coverId={project.cover?.id ?? null} />

      {next && (
        <section className="border-t border-border px-6 md:px-10 py-16 md:py-20">
          <Link href={`/art/${next.slug}`} className="group block">
            <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-3">
              Next project
            </p>
            <div className="flex items-center justify-between gap-6">
              <h3 className="font-display text-4xl md:text-6xl tracking-wide transition-colors group-hover:text-accent">
                {next.title}
              </h3>
              <span className="h-12 w-12 md:h-16 md:w-16 shrink-0 rounded-full border border-accent bg-accent text-bg flex items-center justify-center transition-transform duration-300 group-hover:rotate-45">
                ↗
              </span>
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}
