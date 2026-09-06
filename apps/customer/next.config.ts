import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env["PAON_NEXT_DIST_DIR"] ?? ".next",
  reactStrictMode: true,
  experimental: {
    // Domain limit is 10 MB; leave room for multipart field overhead.
    serverActions: { bodySizeLimit: "11mb" },
    /*
     * Keep visited and prefetched account pages in the client router cache.
     *
     * The customer environment is seven flat tabs the visitor moves between
     * constantly. Next's default holds a dynamic segment for 0 seconds, so
     * every return to a tab already seen went back to the server and streamed
     * itself again — the tabs were prefetched and still took a beat. Holding
     * them for five minutes makes going back and forth what it looks like:
     * nothing loading.
     */
    staleTimes: { dynamic: 300, static: 300 },
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
