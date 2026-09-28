"use client";

import { motion } from "framer-motion";
import RevealHeading from "./RevealHeading";

export default function Hero() {
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
        <RevealHeading
          as="h1"
          className="font-display text-[10vw] md:text-[4vw] leading-[1.05] tracking-tight"
        >
          20 years making ads.
          <br />
          A lifetime making art.
          <br />
          Now I&apos;m rebuilding
          <br />
          how both get made.
        </RevealHeading>

        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-bg-elevated md:aspect-auto md:h-[58svh]"
        >
          <video
            src="/hero/reel.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
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
