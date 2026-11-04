import { luxuryProfile } from "@/brands/luxury/profile";
import { storefrontView } from "@/lib/commerce/storefront";

/**
 * This brand's site settings, shared by its layout and its metadata routes.
 * Everything under app/luxury/ is this brand's alone: it is reached only
 * through the host rewrite in middleware.ts, and never imports BacLab's
 * components, config or stylesheet.
 */
export const brand = luxuryProfile();

/**
 * TODO(launch): true once the brand is live. Until then robots.txt
 * disallows everything and every page is noindex.
 */
export const LIVE = false;

/**
 * The one-line summary: root metadata, the Open Graph card and llms.txt.
 * Delivery in the catalogue's own words (next day, on every order, at no
 * charge: brands/luxury/catalogue.ts).
 */
export const DESCRIPTION = `10ml bacteriostatic water in the ${brand.name} box, with next-day delivery included on every order. Supplied as a laboratory reagent.`;

/** Every public page, for the sitemap. Not the order confirmation: it is per order, and noindex. */
export const PAGES: readonly string[] = ["/", "/contact", "/terms", "/privacy", "/returns", "/disclaimer"];

/**
 * The catalogue as the browser sees it (lib/commerce/storefront.ts), built
 * with the pages: the root layout hands it to the basket, and the buy
 * section reads it from there.
 */
export const STOREFRONT = storefrontView(brand);

/**
 * The basket's localStorage key. Each brand's domain has its own storage, so
 * it needs no brand in it; bump the suffix to drop every stored basket.
 */
export const BASKET_KEY = "basket-v1";

/** The contact form's trade topic, in this brand's words; null offers none (lib/commerce/contact.ts). */
export const TRADE_TOPIC: { label: string; hint?: string } | null = null;
