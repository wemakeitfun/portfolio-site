export type HeroMedia = { kind: "image" | "video"; src: string; alt?: string };

export type HeroWord = {
  text: string;
  /** null = show the placeholder below until you have real media. */
  media: HeroMedia | null;
  placeholder: { gradient: string; accent: string };
};

/**
 * The three words in the hero. Hovering (or tapping) a word shows its media on the right.
 *
 * To use real media: drop the file into /public/hero/ and set `media` on that word, e.g.
 *   media: { kind: "image", src: "/hero/creative.jpg", alt: "Describe the image" }
 *   media: { kind: "video", src: "/hero/artist.mp4" }   // plays silent and looping
 */
export const HERO_WORDS: HeroWord[] = [
  {
    text: "Creative,",
    media: {
      kind: "image",
      src: "/hero/creative.jpg",
      alt: "Adam speaking in a panel discussion on stage",
    },
    placeholder: { gradient: "from-[#3a2b1c] via-[#1c140c] to-[#050403]", accent: "#ffb26f" },
  },
  {
    text: "Artist",
    media: {
      kind: "image",
      src: "/hero/artist.webp",
      alt: "Adam painting a large mural of blue figures on a yellow background",
    },
    placeholder: { gradient: "from-[#2a1c4a] via-[#150e26] to-[#07050c]", accent: "#b18cff" },
  },
  {
    text: "& AI Builder",
    media: {
      kind: "image",
      src: "/hero/ai-builder.webp",
      alt: "An AI-rendered robot examining a ladybug in a lush greenhouse",
    },
    placeholder: { gradient: "from-[#243a12] via-[#121c0a] to-[#050603]", accent: "#d7ff3f" },
  },
];
