import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-h-[80svh] w-full max-w-5xl px-6 pb-24 pt-28 md:px-10">{children}</div>;
}
