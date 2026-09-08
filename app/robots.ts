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
      // OAI-SearchBot is the crawler behind ChatGPT search results and
      // citations; GPTBot is the training crawler. Both are allowed so a
      // ChatGPT answer can link here, but they are separate tokens.
      { userAgent: "GPTBot", allow: "/", disallow: privateRoutes },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: privateRoutes },
      { userAgent: "ChatGPT-User", allow: "/", disallow: privateRoutes },
      { userAgent: "PerplexityBot", allow: "/", disallow: privateRoutes },
      { userAgent: "Perplexity-User", allow: "/", disallow: privateRoutes },
      // Claude-SearchBot indexes for Claude's search; Claude-User fetches
      // on a user's behalf; ClaudeBot is the training crawler.
      { userAgent: "ClaudeBot", allow: "/", disallow: privateRoutes },
      { userAgent: "Claude-SearchBot", allow: "/", disallow: privateRoutes },
      { userAgent: "Claude-User", allow: "/", disallow: privateRoutes },
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
