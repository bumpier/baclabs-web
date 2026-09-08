import type { MetadataRoute } from "next";
import { LEARN_LINKS, LEGAL_LINKS } from "@/components/Footer";
import { GUIDES } from "@/content/guides";
import { canonicalOrigin } from "@/lib/site-url";

/**
 * A single-page funnel plus its legal pages. There is no catalogue to
 * enumerate, so this needs no database access and no `force-dynamic` — which
 * also removes the old constraint that the database had to exist and be
 * migrated before `next build` could run.
 *
 * The legal pages come from the footer's LEGAL_LINKS so the sitemap cannot
 * list a page the site no longer links to, or miss one it does. Every URL
 * here must have a matching self-referencing `alternates.canonical` in its
 * page metadata, and nothing under app/robots.ts `privateRoutes` may appear.
 *
 * No `lastModified`: the old value was `new Date()`, which re-stamped every
 * URL at each build. Google ignores lastmod once it sees it is not tied to
 * real content changes, so a fake one is worse than none. Add it back only
 * from a real source (git date, CMS field).
 */

// Indexable pages that are neither the home page nor a footer legal link.
// Paths only ("/faq"); the origin is prefixed below. Guides, FAQ, calculator
// and safety-data-sheet pages belong here once they exist.
// The guides hub lists every guide, so it last changed when the newest
// guide did. That is a real date (each guide's hand-bumped `updated`), which
// is the only kind allowed here.
const GUIDES_HUB_UPDATED = GUIDES.map((g) => g.updated).sort().at(-1);

const TOP_LEVEL: MetadataRoute.Sitemap = [
  // The hub pages, from the footer's list so the two cannot disagree.
  ...LEARN_LINKS.map((l) => ({
    url: l.href,
    ...(l.href === "/guides" && GUIDES_HUB_UPDATED ? { lastModified: GUIDES_HUB_UPDATED } : {}),
    changeFrequency: "monthly" as const,
    priority: l.href === "/guides" ? 0.7 : 0.6,
  })),
  // One entry per guide. `updated` is a real, hand-bumped date on each guide,
  // so it is a legitimate lastModified.
  ...GUIDES.map((g) => ({
    url: `/guides/${g.slug}`,
    lastModified: g.updated,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = canonicalOrigin();

  const home: MetadataRoute.Sitemap = [{ url: site, changeFrequency: "weekly", priority: 1 }];

  const legal: MetadataRoute.Sitemap = LEGAL_LINKS.map((l) => ({
    url: `${site}${l.href}`,
    changeFrequency: "monthly",
    // Contact and returns are commercial trust pages; the rest is boilerplate.
    priority: l.href === "/contact" || l.href === "/returns" ? 0.4 : 0.3,
  }));

  return [...home, ...TOP_LEVEL.map((e) => ({ ...e, url: `${site}${e.url}` })), ...legal];
}
