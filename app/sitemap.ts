import type { MetadataRoute } from "next";
import { canonicalOrigin } from "@/lib/site-url";

/**
 * A single-page funnel plus its legal pages. There is no catalogue to
 * enumerate, so this needs no database access and no `force-dynamic` — which
 * also removes the old constraint that the database had to exist and be
 * migrated before `next build` could run.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = canonicalOrigin();
  const now = new Date();

  return [
    { url: site, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/returns`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${site}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${site}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${site}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${site}/disclaimer`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
