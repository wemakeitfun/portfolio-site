import { createClient } from "@supabase/supabase-js";

export type Principle = { title: string; detail: string };
export type TimelineEntry = { year: string; label: string; detail: string };

export type AboutContent = {
  eyebrow: string;
  headline: string;
  intro: string;
  marquee_items: string[];
  principles: Principle[];
  timeline: TimelineEntry[];
  show_marquee: boolean;
  show_principles: boolean;
  show_timeline: boolean;
};

// Public, cookie-less client: matches the one in lib/portfolio.ts.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const FALLBACK: AboutContent = {
  eyebrow: "About",
  headline: "About",
  intro: "",
  marquee_items: [],
  principles: [],
  timeline: [],
  show_marquee: true,
  show_principles: true,
  show_timeline: true,
};

export async function getAboutPage(): Promise<AboutContent> {
  const { data, error } = await supabase.from("about_page").select("*").eq("id", true).maybeSingle();
  if (error || !data) {
    if (error) console.error("[about] getAboutPage failed:", error.message);
    return FALLBACK;
  }
  return {
    eyebrow: data.eyebrow,
    headline: data.headline,
    intro: data.intro,
    marquee_items: data.marquee_items ?? [],
    principles: (data.principles ?? []) as Principle[],
    timeline: (data.timeline ?? []) as TimelineEntry[],
    show_marquee: data.show_marquee ?? true,
    show_principles: data.show_principles ?? true,
    show_timeline: data.show_timeline ?? true,
  };
}
