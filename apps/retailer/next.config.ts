import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env["PAON_NEXT_DIST_DIR"] ?? ".next",
  reactStrictMode: true,
  transpilePackages: [
    "@paon/ui",
    "@paon/domain",
    "@paon/database",
    "@paon/auth",
    "@paon/utils",
  ],
};

export default nextConfig;
