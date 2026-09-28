import Link from "next/link";
import ArrowUpRightIcon from "./ArrowUpRightIcon";

const nav = [
  { href: "/", label: "Home" },
  { href: "/artificial", label: "AI" },
  { href: "/art", label: "Art" },
  { href: "/ads", label: "Ads" },
];

const socials = [
  { href: "https://instagram.com/kahncept", label: "Instagram" },
  { href: "https://linkedin.com/in/kahncept", label: "LinkedIn" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border px-6 md:px-10 pt-16 md:pt-24 pb-10">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
          Got something worth making?
        </p>
        <a
          href="mailto:kahncept@me.com"
          className="group font-display text-[15vw] md:text-[9vw] leading-[0.9] tracking-tight hover:text-accent transition-colors"
        >
          Let&apos;s talk
          <span className="inline-block ml-4 md:ml-6 align-middle transition-transform duration-300 group-hover:translate-x-3 group-hover:-translate-y-3">
            <ArrowUpRightIcon className="inline-block h-10 w-10 md:h-16 md:w-16" />
          </span>
        </a>
      </div>

      <div className="mt-16 md:mt-24 grid max-w-md grid-cols-2 gap-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-4">
            Navigation
          </p>
          <ul className="flex flex-col gap-2">
            {nav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-accent transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-fg-muted mb-4">
            Socials
          </p>
          <ul className="flex flex-col gap-2">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-16 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-8 border-t border-border font-mono text-xs uppercase tracking-widest text-fg-muted">
        <span>© {year} Adam Kahn / Kahncept</span>
        <span>Built with Claude Code</span>
      </div>
    </footer>
  );
}
