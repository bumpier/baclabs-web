import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

// Minimal web app manifest: a name, the brand colour and the two icons. It
// exists so a home-screen bookmark carries the mark rather than a screenshot,
// not because the storefront is an installable app. `theme_color` is the
// brand blue from lib/theme.ts / app/icon.svg.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.tagline,
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0047FF",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
