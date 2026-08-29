import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env["PAON_NEXT_DIST_DIR"] ?? ".next",
  reactStrictMode: true,
  experimental: {
    // Domain limit is 10 MB; leave room for multipart field overhead.
    serverActions: { bodySizeLimit: "11mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nebelspiegel.com",
        pathname: "/images/**",
      },
    ],
  },
  transpilePackages: [
    "@paon/ui",
    "@paon/domain",
    "@paon/database",
    "@paon/auth",
    "@paon/utils",
  ],
};

export default nextConfig;
