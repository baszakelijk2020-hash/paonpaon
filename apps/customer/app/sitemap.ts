import type { MetadataRoute } from "next";

const BASE = "https://paonpaon-customer.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/founder",
    "/pricing",
    "/demo-request",
    "/consultation",
    "/pilot",
    "/discover/platform",
    "/discover/engagement",
    "/discover/weddings-events",
    "/discover/roles",
    "/r/maison-dubois",
  ];
  const lastModified = new Date();
  return paths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency:
      path === "/" || path.startsWith("/r/") ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path.startsWith("/r/") ? 0.9 : 0.7,
  }));
}
