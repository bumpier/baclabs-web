import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { brandFor, DEFAULT_BRAND } from "@/brands/registry";
import { canonicalOrigin } from "@/lib/site-url";

/**
 * Structured-data helpers shared by the pages. Each returns a plain object
 * for <JsonLd>; nothing here renders.
 *
 * Each takes the brand it is for, BacLab by default, so BacLab's output is
 * exactly what it always was. Another brand's name and origin come from its
 * profile, never from canonicalOrigin(): its pages are prerendered with no
 * Host header to go on.
 */

/** The site name and origin for a brand's pages. */
export function siteOf(brandId: string = DEFAULT_BRAND): { name: string; origin: string } {
  if (brandId === DEFAULT_BRAND) return { name: brand.name, origin: canonicalOrigin() };
  const b = brandFor(brandId);
  return { name: b.name, origin: b.origin };
}

/**
 * BreadcrumbList for an interior page. Every interior page is one level below
 * the home page, so the trail is always Home → this page. `path` must be the
 * page's canonical path, starting with "/".
 */
export function breadcrumbSchema(name: string, path: string, brandId: string = DEFAULT_BRAND): Record<string, unknown> {
  const site = siteOf(brandId);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: site.origin },
      { "@type": "ListItem", position: 2, name, item: `${site.origin}${path}` },
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
  /** The brand the page belongs to. BacLab when omitted. */
  brandId?: string;
}): Metadata {
  const { name } = siteOf(opts.brandId);
  const fullTitle = `${opts.title} | ${name}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: opts.type ?? "website",
      siteName: name,
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
