"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import RevealHeading from "./RevealHeading";
import { HERO_WORDS, type HeroWord } from "@/lib/hero-words";

function WordMedia({ word, priority }: { word: HeroWord; priority: boolean }) {
  const { media, placeholder } = word;

  if (media?.kind === "image") {
    return (
      <Image
        src={media.src}
        alt={media.alt ?? ""}
        fill
        sizes="(min-width: 768px) 58vw, 100vw"
        priority={priority}
        className="object-cover"
      />
    );
  }
  if (media?.kind === "video") {
    return (
      <video
        src={media.src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  // Placeholder until real media is set in lib/hero-words.ts
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br ${placeholder.gradient}`}
    >
      <span
        className="font-display text-7xl tracking-wide opacity-80 md:text-8xl"
        style={{ color: placeholder.accent }}
      >
        {word.text.replace(/^[&\s]+|[,\s]+$/g, "")}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-widest text-fg-muted">
        Placeholder
      </span>
    </div>
  );
}

export default function Hero() {
  const [active, setActive] = useState(0);

  return (
    <section className="relative min-h-svh flex flex-col justify-between px-6 md:px-10 pt-32 pb-10 overflow-hidden">
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.05 }}
        transition={{ duration: 1.5 }}
        className="pointer-events-none absolute -top-24 -right-24 h-[60vw] w-[60vw] rounded-full blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div className="relative z-10 grid gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] md:items-center">
        <div>
          {HERO_WORDS.map((word, i) => (
            <RevealHeading
              key={word.text}
              as="h1"
              delay={i * 0.08}
              className="font-display text-[18vw] md:text-[9vw] leading-[0.92] tracking-tight"
            >
              {/* hover on desktop, tap on touch, focus for keyboard */}
              <button
                type="button"
                data-cursor-hover
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className={`inline-block text-left transition-colors duration-300 ${
                  active === i ? "text-fg" : "text-fg-muted"
                }`}
              >
                {word.text}
              </button>
            </RevealHeading>
          ))}

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-8 max-w-md text-fg-muted"
          >
            20 years making ads. A lifetime making art. Now I&apos;m rebuilding how both
            get made.
          </motion.p>
        </div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-bg-elevated md:aspect-auto md:h-[58svh]"
        >
          {HERO_WORDS.map((word, i) => (
            <div
              key={word.text}
              className={`absolute inset-0 transition-all duration-700 ease-out ${
                active === i ? "scale-100 opacity-100" : "scale-105 opacity-0"
              }`}
            >
              <WordMedia word={word} priority={i === 0} />
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="relative z-10 mt-16 flex items-end justify-end font-mono text-xs uppercase tracking-widest text-fg-muted"
      >
        <span>Scroll to explore ↓</span>
      </motion.div>
    </section>
  );
}
