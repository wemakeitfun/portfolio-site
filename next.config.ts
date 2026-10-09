import type { NextConfig } from "next";

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  images: {
    // Lets next/image resize and optimize files uploaded through the admin.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/portfolio-media/**",
      },
    ],
  },
  // Run Kitty Run (static web game in public/RKR) lives at /RKR; /rkr works too.
  async rewrites() {
    return [
      { source: "/RKR", destination: "/RKR/index.html" },
      { source: "/rkr", destination: "/RKR/index.html" },
    ];
  },
};

export default nextConfig;
