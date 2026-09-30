"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ProjectSummary } from "@/lib/portfolio";
import ProjectMedia from "./ProjectMedia";
import ArrowUpRightIcon from "./ArrowUpRightIcon";

export default function ProjectCard({
  project,
  index,
}: {
  project: ProjectSummary;
  index: number;
}) {
  const accent = project.accent ?? "#d7ff3f";

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/${project.section}/${project.slug}`}
        data-cursor-hover
        className="group block"
      >
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-[#1c2b4a] via-[#101826] to-[#05070c] border border-border">
          {project.cover ? (
            <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105">
              <ProjectMedia
                media={project.cover}
                sizes="(min-width: 768px) 50vw, 100vw"
                priority={index < 2}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-display text-[22%] tracking-wide opacity-70 transition-transform duration-500 ease-out group-hover:scale-110"
                style={{ color: accent }}
              >
                {project.title}
              </span>
            </div>
          )}

          <div className="absolute top-5 left-5 font-mono text-[11px] uppercase tracking-widest text-fg-muted mix-blend-difference">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div className="absolute top-5 right-5 h-9 w-9 rounded-full border border-accent-badge bg-accent-badge text-accent-badge-fg flex items-center justify-center transition-transform duration-300 group-hover:rotate-45">
            <ArrowUpRightIcon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <h3 className="font-display text-2xl md:text-3xl tracking-wide">
            {project.title}
          </h3>
          <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">
            {[project.category, project.year].filter(Boolean).join(" — ")}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
