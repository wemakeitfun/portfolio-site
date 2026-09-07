import { projects } from "@/lib/projects";
import ProjectCard from "./ProjectCard";

export default function WorkGrid({ limit }: { limit?: number }) {
  const list = limit ? projects.slice(0, limit) : projects;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-14">
      {list.map((project, i) => (
        <ProjectCard key={project.slug} project={project} index={i} />
      ))}
    </div>
  );
}
