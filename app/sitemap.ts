import type { MetadataRoute } from "next";
import { LEARN_LINKS, LEGAL_LINKS, SHOP_LINKS } from "@/components/Footer";
import { publishedGuides, publishedPosts } from "@/lib/articles";
import { canonicalOrigin } from "@/lib/site-url";
import { isBlogMigrated, isMigratedPath } from "@/lib/blog-migration";

/**
 * The funnel, its legal pages, and every published guide and post.
 *
 * This reads the database, because guides are published from /admin rather
 * than compiled in. There is no content database during `docker build`
 * (Dockerfile:65 builds against a placeholder file) — the real SQLite file
 * only arrives at runtime, via the bind-mounted volume — so this route
 * cannot be prerendered at build time. `dynamic = "force-dynamic"` makes it
 * render on every request instead: one cheap SQLite read, on a box serving
 * a single low-traffic storefront that Cloudflare passes straight through
 * to origin anyway (measured `cf-cache-status: DYNAMIC`).
 *
 * The legal pages come from the footer's LEGAL_LINKS so the sitemap cannot
 * list a page the site no longer links to, or miss one it does. Every URL
 * here must have a matching self-referencing `alternates.canonical` in its
 * page metadata, and nothing under app/robots.ts `privateRoutes` may appear.
 *
 * `lastModified` is only ever a real date - each article's hand-set
 * `updated`. It is never `new Date()`: a lastmod that re-stamps at every
 * build is one Google learns to ignore, which is worse than omitting it.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = canonicalOrigin();
  const [guides, posts] = await Promise.all([publishedGuides(), publishedPosts()]);

  // The hub pages last changed when their newest child did. A real date.
  const guidesHubUpdated = guides.map((g) => g.updated).sort().at(-1);
  const blogHubUpdated = posts.map((p) => p.updated).sort().at(-1);

  const paths: MetadataRoute.Sitemap = [
    // Commercial pages beside the product page. Higher priority than the
    // guides: these are buying-intent destinations, not reference reading.
    ...SHOP_LINKS.map((l) => ({
      url: l.href,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // Hub pages, from the footer's list so the two cannot disagree. /blog is
    // filtered out here because it is emitted explicitly below, gated on
    // posts.length - without this filter it would appear twice in
    // sitemap.xml.
    ...LEARN_LINKS.filter((l) => l.href !== "/blog").map((l) => ({
      url: l.href,
      ...(l.href === "/guides" && guidesHubUpdated ? { lastModified: guidesHubUpdated } : {}),
      changeFrequency: "monthly" as const,
      priority: l.href === "/guides" ? 0.7 : 0.6,
    })),
    ...(posts.length
      ? [
          {
            url: "/blog",
            ...(blogHubUpdated ? { lastModified: blogHubUpdated } : {}),
            changeFrequency: "weekly" as const,
            priority: 0.6,
          },
        ]
      : []),
    ...guides.map((g) => ({
      url: `/guides/${g.slug}`,
      lastModified: g.updated,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...posts.map((p) => ({
      url: `/blog/${p.slug}`,
      lastModified: p.updated,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  // Once the blog and guides move, this sitemap must stop advertising them:
  // a sitemap full of URLs that 301 elsewhere is a weak signal, and the
  // destination publishes its own. One filter at the end catches every source
  // of those paths, including the hub entries that come from LEARN_LINKS.
  const live = isBlogMigrated() ? paths.filter((e) => !isMigratedPath(String(e.url))) : paths;

  const home: MetadataRoute.Sitemap = [{ url: site, changeFrequency: "weekly", priority: 1 }];

  const legal: MetadataRoute.Sitemap = LEGAL_LINKS.map((l) => ({
    url: `${site}${l.href}`,
    changeFrequency: "monthly",
    // Contact and returns are commercial trust pages; the rest is boilerplate.
    priority: l.href === "/contact" || l.href === "/returns" ? 0.4 : 0.3,
  }));

  return [...home, ...live.map((e) => ({ ...e, url: `${site}${e.url}` })), ...legal];
}
