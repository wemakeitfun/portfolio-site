import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";

// New projects should reach Google without a redeploy.
export const revalidate = 3600;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Anonymous access only returns published projects (row-level security).
  const { data } = await supabase.from("projects").select("slug, section, updated_at");
  const projects = (data ?? []) as { slug: string; section: string; updated_at: string }[];

  // A section's listing page is only worth indexing once it has something in it.
  const sections = [...new Set(projects.map((p) => p.section))];
  const latest = (rows: typeof projects) =>
    new Date(Math.max(...rows.map((p) => Date.parse(p.updated_at))));

  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.6 },
    ...sections.map((s) => ({
      url: `${SITE_URL}/${s}`,
      lastModified: latest(projects.filter((p) => p.section === s)),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...projects.map((p) => ({
      url: `${SITE_URL}/${p.section}/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
