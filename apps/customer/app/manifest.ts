import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAON",
    short_name: "PAON",
    description:
      "The digital customer and operating platform for premium retail houses.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
