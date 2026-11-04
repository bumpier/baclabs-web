/**
 * What every brand's site needs from its profile: root metadata, viewport,
 * robots.txt, sitemap, web manifest and llms.txt. Each brand's routes in
 * app/<id>/ call these with its own profile, so a brand can replace any one
 * without touching another brand.
 *
 * Everything here is built from the profile alone. Never canonicalOrigin()
 * or requestOrigin(): a brand page is prerendered with no Host header, and
 * both would fall back to BacLab's domain.
 *
 * File conventions (icon.svg, opengraph-image.tsx, robots.ts…) are not used
 * inside app/<id>/: they would be served at /<id>/…, which middleware.ts
 * refuses. The brand's icon is public/<id>/icon.svg, its OG image the route
 * app/<id>/og, and both are reached at /icon.svg and /og through the rewrite.
 */
import type { Metadata, Viewport } from "next";
import type { BrandProfile } from "@/brands/types";

export const BRAND_ICON_PATH = "/icon.svg";
export const BRAND_OG_PATH = "/og";
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * A brand's root layout metadata. Sets its own icons and its own Open Graph
 * and Twitter images explicitly: BacLab's icon.svg, apple-icon and
 * opengraph-image sit at the app root, and Next would otherwise hand them to
 * every root layout (see app/opengraph-image.tsx).
 */
export function brandRootMetadata(b: BrandProfile, opts: { description: string; live: boolean }): Metadata {
  const image = { url: BRAND_OG_PATH, ...OG_SIZE, alt: b.name };
  return {
    metadataBase: new URL(b.origin),
    title: { default: b.name, template: `%s | ${b.name}` },
    description: opts.description,
    // Until launch nothing is indexed, belt and braces with robots.txt.
    robots: opts.live ? { index: true, follow: true } : { index: false, follow: false },
    icons: { icon: [{ url: BRAND_ICON_PATH, type: "image/svg+xml", sizes: "any" }] },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      siteName: b.name,
      title: b.name,
      description: opts.description,
      url: "/",
      locale: "en_GB",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: b.name, description: opts.description, images: [image] },
  };
}

/**
 * A brand's not-found.tsx metadata. It repeats the brand's own Open Graph
 * card: on a 404 Next pairs the not-found metadata with the root's file
 * metadata, and would otherwise show BacLab's opengraph-image.
 */
export function brandNotFoundMetadata(b: BrandProfile, description: string): Metadata {
  const { openGraph, twitter } = brandRootMetadata(b, { description, live: false });
  return { title: "Page not found", robots: { index: false, follow: true }, openGraph, twitter };
}

export function brandViewport(b: BrandProfile): Viewport {
  return { width: "device-width", initialScale: 1, colorScheme: "light", themeColor: b.colours.paper };
}

/** A plain-text or XML body as a route handler's response. */
export function textResponse(body: string, contentType: string): Response {
  return new Response(body, { headers: { "Content-Type": `${contentType}; charset=utf-8` } });
}

/** robots.txt. While a brand is not live it disallows everything. */
export function robotsTxt(b: BrandProfile, live: boolean): string {
  if (!live) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /checkout",
    "Disallow: /order-confirmation/",
    "",
    `Sitemap: ${b.origin}/sitemap.xml`,
    "",
  ].join("\n");
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** sitemap.xml for the brand's public paths ("/" is the home page). */
export function sitemapXml(b: BrandProfile, paths: readonly string[]): string {
  const urls = paths
    .map((p) => `  <url><loc>${xmlEscape(p === "/" ? b.origin : `${b.origin}${p}`)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * The web manifest. Required, not optional: app/manifest.ts puts
 * <link rel="manifest" href="/manifest.webmanifest"> on every page of every
 * site, and on a brand host that path is rewritten to the brand's own.
 */
export function webManifest(b: BrandProfile): Record<string, unknown> {
  return {
    name: b.name,
    short_name: b.name,
    start_url: "/",
    display: "browser",
    background_color: b.colours.paper,
    theme_color: b.colours.primary,
    icons: [{ src: BRAND_ICON_PATH, sizes: "any", type: "image/svg+xml" }],
  };
}

/** llms.txt: the brand's name and a one-line summary, and later its pages. */
export function llmsTxt(b: BrandProfile, summary: string): string {
  return `# ${b.name}\n\n> ${summary}\n`;
}
