import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Picsum (keep if still used)
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },

      // ✅ Supabase storage (your project)
      {
        protocol: "https",
        hostname: "zqitmzasejtjhjxjnukt.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },

      // Optional: allow any Supabase project (future-proof)
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
