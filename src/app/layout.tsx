import type { Metadata } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CustomCursor from "@/components/CustomCursor";
import KonamiGlitch from "@/components/KonamiGlitch";
import RouteTheme from "@/components/RouteTheme";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

// Runs before hydration so a direct load of an /art page paints light-themed
// immediately, instead of flashing dark first. Kept in sync after that by
// RouteTheme (needed for client-side navigation, which this script doesn't see).
const THEME_INIT_SCRIPT = `
try {
  var p = location.pathname;
  if (p === "/art" || p.indexOf("/art/") === 0) {
    document.documentElement.classList.add("theme-light");
  }
} catch (e) {}
`;

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s | ${SITE_NAME}` },
  description: HOME_DESCRIPTION,
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: SITE_NAME }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${inter.variable} ${jetbrains.variable} antialiased`}
      // The inline script below adds "theme-light" to this element before React
      // hydrates (to avoid a flash of the dark theme on a direct /art load), which
      // React would otherwise flag as a hydration mismatch on this exact attribute.
      suppressHydrationWarning
    >
      <body className="bg-bg text-fg font-sans min-h-screen flex flex-col overflow-x-hidden">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <noscript>
          <style>{".reveal{opacity:1;transform:none}"}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-full focus:bg-[#d7ff3f] focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:tracking-widest focus:text-[#0a0a0b]"
        >
          Skip to content
        </a>
        <RouteTheme />
        <CustomCursor />
        <KonamiGlitch />
        <Nav />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
