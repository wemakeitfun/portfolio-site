import { requireAdmin } from "@/lib/admin";
import { DEFAULT_CONTENT_ORDER, type AboutContent, type ContentBlockKey } from "@/lib/about";
import type { AboutMediaRow, AboutSectionRow } from "@/lib/media";
import AboutForm from "./AboutForm";

export default async function AdminAboutPage() {
  const { supabase } = await requireAdmin();
  const [{ data }, { data: sectionRows }, { data: mediaRows }] = await Promise.all([
    supabase.from("about_page").select("*").eq("id", true).maybeSingle(),
    supabase.from("about_sections").select("*").order("sort_order", { ascending: true }),
    supabase.from("about_media").select("*").order("sort_order", { ascending: true }),
  ]);

  const about: AboutContent = {
    eyebrow: data?.eyebrow ?? "About",
    headline: data?.headline ?? "",
    intro: data?.intro ?? "",
    marquee_items: data?.marquee_items ?? [],
    principles: data?.principles ?? [],
    timeline: data?.timeline ?? [],
    sections: [], // AboutForm builds its own section+media state from the two arrays below
    show_marquee: data?.show_marquee ?? true,
    show_principles: data?.show_principles ?? true,
    show_timeline: data?.show_timeline ?? true,
    content_order: (data?.content_order as ContentBlockKey[] | undefined) ?? DEFAULT_CONTENT_ORDER,
  };

  return (
    <AboutForm
      initial={about}
      initialSections={(sectionRows ?? []) as AboutSectionRow[]}
      initialMedia={(mediaRows ?? []) as AboutMediaRow[]}
    />
  );
}
