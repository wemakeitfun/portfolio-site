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

      <div className="relative z-10 max-w-4xl">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-fg-muted mb-6"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Available for select projects — 2026
        </motion.div>

        <RevealHeading
          as="h1"
          className="font-display text-[13vw] md:text-[6.5vw] leading-[0.92] tracking-tight"
        >
          Design, development
        </RevealHeading>
        <RevealHeading
          as="h1"
          delay={0.08}
          className="font-display text-[13vw] md:text-[6.5vw] leading-[0.92] tracking-tight text-fg-muted"
        >
          &amp; brand systems
        </RevealHeading>
        <RevealHeading
          as="h1"
          delay={0.16}
          className="font-display text-[13vw] md:text-[6.5vw] leading-[0.92] tracking-tight"
        >
          for ambitious teams
        </RevealHeading>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8 max-w-md text-fg-muted"
        >
          Arc Studio is a small, independent team building interfaces,
          products, and identities — end to end, from the first sketch to
          shipped code.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="relative z-10 mt-16 flex flex-wrap items-end justify-between gap-6 font-mono text-xs uppercase tracking-widest text-fg-muted"
      >
        <span>Remote · Worldwide</span>
        <span className="flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-accent" />
          Est. 2019
        </span>
        <span>Scroll to explore ↓</span>
      </motion.div>
    </section>
  );
}
