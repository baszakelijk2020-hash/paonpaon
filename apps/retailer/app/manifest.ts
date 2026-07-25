import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PAON Retailer Portal",
    short_name: "PAON Retail",
    description: "Operations console for PAON retailer staff.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
