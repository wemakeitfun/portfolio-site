import Link from "next/link";
import { notFound } from "next/navigation";
import { projects, getProject, getAdjacentProject } from "@/lib/projects";
import RevealHeading from "@/components/RevealHeading";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectPage(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  const next = getAdjacentProject(slug);

  return (
    <div className="pt-32">
      <section className="px-6 md:px-10 pb-10">
        <Link
          href="/work"
          className="font-mono text-xs uppercase tracking-widest text-fg-muted hover:text-fg transition-colors"
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
            <div>
              <p className="text-fg-muted mb-1">Client</p>
              <p className="text-fg">{project.client}</p>
            </div>
            <div>
              <p className="text-fg-muted mb-1">Year</p>
              <p className="text-fg">{project.year}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-16">
        <div
          className={`relative aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br ${project.gradient} border border-border flex items-center justify-center`}
        >
          <span
            className="font-display text-[10vw] tracking-wide opacity-70"
            style={{ color: project.accent }}
          >
            {project.title}
          </span>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-24 md:pb-32 grid md:grid-cols-3 gap-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-4">
            Services
          </p>
          <ul className="flex flex-col gap-2">
            {project.services.map((s) => (
              <li key={s} className="text-fg-muted">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-4">
            Overview
          </p>
          <p className="font-display text-2xl md:text-3xl leading-[1.2] tracking-wide mb-6">
            {project.summary}
          </p>
          <p className="text-fg-muted max-w-xl">{project.description}</p>
        </div>
      </section>

      <section className="border-t border-border px-6 md:px-10 py-16 md:py-20">
        <Link href={`/work/${next.slug}`} className="group block">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-3">
            Next project
          </p>
          <div className="flex items-center justify-between gap-6">
            <h3 className="font-display text-4xl md:text-6xl tracking-wide transition-colors group-hover:text-accent">
              {next.title}
            </h3>
            <span className="h-12 w-12 md:h-16 md:w-16 shrink-0 rounded-full border border-border flex items-center justify-center transition-all duration-300 group-hover:bg-accent group-hover:border-accent group-hover:text-bg group-hover:rotate-45">
              ↗
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}
