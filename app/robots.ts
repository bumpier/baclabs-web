import type { MetadataRoute } from "next";
import { canonicalOrigin } from "@/lib/site-url";

const privateRoutes = [
  "/admin/",
  "/api/",
  "/cart",
  "/checkout",
  "/dashboard",
  "/order-confirmation/",
  "/auth/",
  "/dev/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Allow AI search-and-cite bots explicitly (ChatGPT, Perplexity, Claude, Google AI, Copilot)
      { userAgent: "GPTBot", allow: "/", disallow: privateRoutes },
      { userAgent: "ChatGPT-User", allow: "/", disallow: privateRoutes },
      { userAgent: "PerplexityBot", allow: "/", disallow: privateRoutes },
      { userAgent: "ClaudeBot", allow: "/", disallow: privateRoutes },
      { userAgent: "anthropic-ai", allow: "/", disallow: privateRoutes },
      { userAgent: "Google-Extended", allow: "/", disallow: privateRoutes },
      { userAgent: "Bingbot", allow: "/", disallow: privateRoutes },
      // Block training-only crawlers that don't provide citation value
      { userAgent: "CCBot", disallow: "/" },
      // Default rule for all other crawlers
      {
        userAgent: "*",
        allow: "/",
        disallow: privateRoutes,
      },
    ],
    sitemap: `${canonicalOrigin()}/sitemap.xml`,
  };
}
