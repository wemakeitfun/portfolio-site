import { requireAdmin } from "@/lib/admin";
import type { AboutContent } from "@/lib/about";
import AboutForm from "./AboutForm";

export default async function AdminAboutPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("about_page").select("*").eq("id", true).maybeSingle();

  const about: AboutContent = {
    eyebrow: data?.eyebrow ?? "About",
    headline: data?.headline ?? "",
    intro: data?.intro ?? "",
    marquee_items: data?.marquee_items ?? [],
    principles: data?.principles ?? [],
    timeline: data?.timeline ?? [],
    show_marquee: data?.show_marquee ?? true,
    show_principles: data?.show_principles ?? true,
    show_timeline: data?.show_timeline ?? true,
  };

  return <AboutForm initial={about} />;
}
