"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Project } from "@/lib/projects";

export default function ProjectCard({
  project,
  index,
}: {
  project: Project;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/work/${project.slug}`}
        data-cursor-hover
        className="group block"
      >
        <div
          className={`relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br ${project.gradient} border border-border`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-display text-[22%] tracking-wide opacity-70 transition-transform duration-500 ease-out group-hover:scale-110"
              style={{ color: project.accent }}
            >
              {project.title}
            </span>
          </div>

          <div className="absolute top-5 left-5 font-mono text-[11px] uppercase tracking-widest text-fg-muted">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div className="absolute top-5 right-5 h-9 w-9 rounded-full border border-border flex items-center justify-center transition-all duration-300 group-hover:bg-accent group-hover:border-accent group-hover:text-bg group-hover:rotate-45">
            ↗
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <h3 className="font-display text-2xl md:text-3xl tracking-wide">
            {project.title}
          </h3>
          <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">
            {project.category} — {project.year}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
