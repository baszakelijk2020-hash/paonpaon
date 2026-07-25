import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAON Admin",
    short_name: "PAON Admin",
    description: "Platform administration console for PAON staff.",
    start_url: "/retailers",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
