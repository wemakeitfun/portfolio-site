import type { Metadata } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CustomCursor from "@/components/CustomCursor";
import RouteTheme from "@/components/RouteTheme";
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
  title: "Adam Kahn / Kahncept",
  description:
    "Adam Kahn / Kahncept — 20 years making ads, a lifetime making art, now rebuilding how both get made.",
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
        <RouteTheme />
        <CustomCursor />
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
