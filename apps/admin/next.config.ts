import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
