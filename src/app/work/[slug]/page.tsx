import Link from "next/link";
import { notFound } from "next/navigation";
import { getNextProject, getProject, getSlugs } from "@/lib/portfolio";
import { isLightColor, projectBackgroundStyle } from "@/lib/media";
import { projectJsonLd, projectMetadata } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import ProjectThemeOverride from "@/components/ProjectThemeOverride";
import RevealHeading from "@/components/RevealHeading";
import ProjectGallery from "@/components/ProjectGallery";
import ArrowUpRightIcon from "@/components/ArrowUpRightIcon";

// New uploads show up within a minute of publishing.
export const revalidate = 60;

export async function generateMetadata(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  return projectMetadata("work", slug);
}

export async function generateStaticParams() {
  return (await getSlugs("work")).map((slug) => ({ slug }));
}

export default async function ProjectPage(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  const project = await getProject(slug);
  if (!project || project.section !== "work") notFound();

  const next = await getNextProject(project);

  return (
    <div className="pt-32" style={projectBackgroundStyle(project.background_color)}>
      <JsonLd data={projectJsonLd(project)} />
      <ProjectThemeOverride isLight={project.background_color ? isLightColor(project.background_color) : null} />
      <section className="px-page-capped pb-(--space-2)">
        <Link
          href="/work"
          className="inline-block -my-3 py-3 font-mono text-xs uppercase tracking-widest text-fg-muted hover:text-fg transition-colors"
        >
          ← Back to work
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
        <section className="px-page-capped pb-(--space-2) pt-0 grid md:grid-cols-2 gap-x-12 gap-y-10">
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

      <ProjectGallery
        sections={project.sections}
        coverId={project.cover?.id ?? null}
        title={project.title}
      />

      {next && (
        <section className="border-t border-border px-page-capped py-(--space-2)">
          <Link href={`/work/${next.slug}`} className="group block">
            <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-3">
              Next project
            </p>
            <div className="flex items-center justify-between gap-6">
              <h2 className="font-display text-4xl md:text-6xl tracking-wide transition-colors group-hover:text-accent">
                {next.title}
              </h2>
              <span className="h-12 w-12 md:h-16 md:w-16 shrink-0 rounded-full border border-accent-badge bg-accent-badge text-accent-badge-fg flex items-center justify-center transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRightIcon className="h-5 w-5 md:h-6 md:w-6" />
              </span>
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}
