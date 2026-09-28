import { getProjects } from "@/lib/portfolio";
import type { Section } from "@/lib/media";
import ProjectCard from "./ProjectCard";

const EMPTY_LABEL: Record<Section, string> = {
  work: "New work is on the way.",
  ads: "New ads are on the way.",
  art: "New art is on the way.",
  artificial: "New work is on the way.",
  generative: "New work is on the way.",
};

export default async function WorkGrid({
  section = "work",
  limit,
}: {
  section?: Section;
  limit?: number;
}) {
  const list = await getProjects(section, limit);

  if (list.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-12 text-center text-fg-muted">
        {EMPTY_LABEL[section]}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-14">
      {list.map((project, i) => (
        <ProjectCard key={project.slug} project={project} index={i} />
      ))}
    </div>
  );
}
