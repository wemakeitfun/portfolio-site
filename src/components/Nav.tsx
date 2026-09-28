"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { href: "/", label: "Home" },
  { href: "/artificial", label: "AI" },
  { href: "/art", label: "Art" },
  { href: "/ads", label: "Ads" },
  { href: "/about", label: "About" },
];

function SwapText({ children }: { children: string }) {
  return (
    <span className="relative inline-block overflow-hidden h-[1em] leading-none align-top">
      <span className="block transition-transform duration-300 ease-out group-hover:-translate-y-full">
        {children}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 block translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0"
      >
        {children}
      </span>
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="flex items-center justify-between px-6 md:px-10 py-5 md:py-6">
        <Link
          href="/"
          className="font-display text-2xl tracking-wide leading-none"
          onClick={() => setOpen(false)}
        >
          AK<span className="text-accent">*</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-fg">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group relative hover:text-accent transition-colors"
              >
                <SwapText>{l.label}</SwapText>
                {active && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute -right-3 top-1/2 -translate-y-1/2 h-1 w-1 rounded-full bg-accent"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="mailto:kahncept@me.com"
            className="group relative hidden md:inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 font-mono text-xs uppercase tracking-widest overflow-hidden"
          >
            <span className="relative z-10 transition-colors duration-300 group-hover:text-bg">
              <SwapText>Let&apos;s Talk</SwapText>
            </span>
            <span className="absolute inset-0 bg-accent origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" />
          </a>

          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden relative z-50 h-9 w-9 flex flex-col items-center justify-center gap-1.5"
          >
            <span
              className={`h-px w-6 bg-fg transition-transform duration-300 ${open ? "translate-y-[3.5px] rotate-45" : ""}`}
            />
            <span
              className={`h-px w-6 bg-fg transition-transform duration-300 ${open ? "-translate-y-[3.5px] -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="md:hidden absolute inset-x-0 top-0 pt-24 pb-8 px-6 bg-bg border-b border-border"
          >
            <nav className="flex flex-col gap-6 font-display text-4xl">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="hover:text-accent transition-colors"
                >
                  {l.label}
                </Link>
              ))}
              <a href="mailto:kahncept@me.com" className="text-accent">
                Let&apos;s Talk
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
