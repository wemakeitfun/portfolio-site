/**
 * Plain SVG stand-in for the "↗" character. iOS Safari renders that glyph via
 * its color-emoji fallback font, which ignores the surrounding text color —
 * an SVG with currentColor can't fall back to emoji, so it always matches.
 */
export default function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
