export type Project = {
  slug: string;
  title: string;
  year: string;
  category: string;
  client: string;
  summary: string;
  description: string;
  services: string[];
  gradient: string;
  accent: string;
};

export const projects: Project[] = [
  {
    slug: "polaris-atlas",
    title: "Polaris Atlas",
    year: "2026",
    category: "Product Design",
    client: "Polaris Atlas Inc.",
    summary: "A navigation-first redesign for a logistics platform used by 40,000 dispatchers daily.",
    description:
      "We rebuilt the core dispatch console from the ground up, replacing a decade of accumulated UI debt with a system built around real-time map state. The result cut average dispatch time by 31% and became the template for three other internal tools.",
    services: ["Product Strategy", "UI/UX Design", "Design System"],
    gradient: "from-[#1c2b4a] via-[#101826] to-[#05070c]",
    accent: "#6fb6ff",
  },
  {
    slug: "kindred-goods",
    title: "Kindred Goods",
    year: "2025",
    category: "Brand & Web",
    client: "Kindred Goods Co.",
    summary: "Full brand identity and e-commerce experience for a sustainable homeware label.",
    description:
      "Kindred came to us pre-launch with a name and nothing else. We built the identity, packaging language, and a headless storefront that loads under 900ms on mobile — a hard requirement given their launch was entirely word-of-mouth.",
    services: ["Brand Identity", "E-commerce", "Art Direction"],
    gradient: "from-[#3a2b1c] via-[#1c140c] to-[#050403]",
    accent: "#ffb26f",
  },
  {
    slug: "fielder",
    title: "Fielder",
    year: "2025",
    category: "Web App",
    client: "Fielder Analytics",
    summary: "A data-dense analytics dashboard made legible through motion and progressive disclosure.",
    description:
      "Fielder's early product buried every user in charts. We designed a layered dashboard where detail reveals itself through interaction rather than density, paired with a motion system that makes state changes traceable instead of jarring.",
    services: ["UI/UX Design", "Motion Design", "Frontend Build"],
    gradient: "from-[#1c3a2e] via-[#0c1c16] to-[#040a07]",
    accent: "#6fffb0",
  },
  {
    slug: "north-and-arrow",
    title: "North & Arrow",
    year: "2024",
    category: "Brand Identity",
    client: "North & Arrow Studio",
    summary: "Identity system for an architecture practice, built to work as well on-site as it does online.",
    description:
      "The brief was a mark that could live on a hard hat sticker and a monograph cover with equal confidence. We landed on a modular wordmark and a restrained two-color system that scales from a business card to a building wrap.",
    services: ["Brand Identity", "Print Systems", "Signage"],
    gradient: "from-[#2b2b2b] via-[#161616] to-[#050505]",
    accent: "#e8e4d8",
  },
  {
    slug: "loop-transit",
    title: "Loop Transit",
    year: "2024",
    category: "Product Design",
    client: "Loop Transit Authority",
    summary: "A rider-facing app redesign that made real-time transit data feel trustworthy.",
    description:
      "Riders didn't distrust the data — they distrusted the interface presenting it. We redesigned the information hierarchy around confidence: showing uncertainty explicitly instead of hiding it, which raised reported trust scores by 22 points.",
    services: ["Product Design", "Research", "Design System"],
    gradient: "from-[#3a1c2b] via-[#1c0c14] to-[#0a0407]",
    accent: "#ff6fa8",
  },
  {
    slug: "verge-audio",
    title: "Verge Audio",
    year: "2023",
    category: "Brand & Web",
    client: "Verge Audio",
    summary: "Launch identity and site for a boutique headphone brand built around a single hero product.",
    description:
      "One product, one story. We built a scroll-driven product site that mirrors the unboxing experience beat for beat, and an identity restrained enough to disappear behind the hardware photography.",
    services: ["Brand Identity", "Web Design", "Motion Design"],
    gradient: "from-[#2b1c3a] via-[#140c1c] to-[#05040a]",
    accent: "#b06fff",
  },
];

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}

export function getAdjacentProject(slug: string) {
  const index = projects.findIndex((p) => p.slug === slug);
  if (index === -1) return projects[0];
  return projects[(index + 1) % projects.length];
}
