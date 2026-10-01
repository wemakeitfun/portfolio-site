"use client";

import { useEffect } from "react";

/**
 * Nav and Footer live outside a project page's own tree (they're siblings of
 * <main> in the root layout), so a project with a light custom background
 * can't just recolor its own content — Nav would still render its default
 * white-on-dark style over that light background. This reuses the exact
 * mechanism RouteTheme already uses for /art (toggling globals.css's
 * `.theme-light` on <html>, which Nav's `text-fg` responds to), scoped to
 * whichever project page is currently mounted.
 *
 * Runs after RouteTheme's own effect on the same navigation (it's mounted
 * deeper in the tree, inside the page itself), so it correctly overrides
 * RouteTheme's path-based default when a project calls for the opposite.
 * No cleanup needed: every navigation re-resolves this unconditionally, via
 * either RouteTheme (for routes with no override) or the next page's own
 * ProjectThemeOverride (for routes that have one).
 */
export default function ProjectThemeOverride({ isLight }: { isLight: boolean | null }) {
  useEffect(() => {
    if (isLight === null) return;
    document.documentElement.classList.toggle("theme-light", isLight);
  }, [isLight]);

  return null;
}
