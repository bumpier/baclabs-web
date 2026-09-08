import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { canonicalOrigin } from "@/lib/site-url";

/**
 * Structured-data helpers shared by the pages. Each returns a plain object
 * for <JsonLd>; nothing here renders.
 */

/**
 * BreadcrumbList for an interior page. Every interior page is one level below
 * the home page, so the trail is always Home → this page. `path` must be the
 * page's canonical path, starting with "/".
 */
export function breadcrumbSchema(name: string, path: string): Record<string, unknown> {
  const site = canonicalOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: brand.name, item: site },
      { "@type": "ListItem", position: 2, name, item: `${site}${path}` },
    ],
  };
}

/**
 * Metadata for an interior page: title, description, self-referencing
 * canonical, and Open Graph / Twitter fields that mirror them. Without the
 * per-page Open Graph override every page inherited the home page's
 * commercial og:title, so a shared link to /privacy previewed as "Buy
 * Bacteriostatic Water UK…". `path` must be the canonical path, starting
 * with "/" — the sitemap relies on every listed page carrying it.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const fullTitle = `${opts.title} | ${brand.name}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: opts.type ?? "website",
      siteName: brand.name,
      locale: "en_GB",
      title: fullTitle,
      description: opts.description,
      url: opts.path,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: opts.description,
    },
  };
}
