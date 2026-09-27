"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const isLight = (path: string) => path === "/art" || path.startsWith("/art/");

/**
 * Flips the whole page to the light theme (globals.css `.theme-light`) while on
 * an /art route, and back to dark everywhere else. Nav and Footer live outside
 * this route's own layout (they're siblings of <main> in the root layout), so
 * the class has to go on <html> to reach them too — that's what this toggles.
 *
 * The class is also set synchronously by an inline script in layout.tsx, so the
 * very first paint of a direct /art load is already correct; this effect just
 * keeps it in sync on client-side navigations after that.
 */
export default function RouteTheme() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", isLight(pathname));
  }, [pathname]);

  return null;
}
