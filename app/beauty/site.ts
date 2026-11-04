import { beautyProfile } from "@/brands/beauty/profile";
import { CLINICS } from "@/brands/beauty/copy/clinics";
import { storefrontView } from "@/lib/commerce/storefront";

/**
 * This brand's site settings, shared by its layout and its metadata routes.
 * Everything under app/beauty/ is this brand's alone: it is reached only
 * through the host rewrite in middleware.ts, and never imports BacLab's
 * components, config or stylesheet.
 */
export const brand = beautyProfile();

/**
 * TODO(launch): true once the brand is live. Until then robots.txt
 * disallows everything and every page is noindex.
 */
export const LIVE = false;

export const DESCRIPTION =
  "Bacteriostatic water in sealed 10ml vials, in sets of one, five, ten and twenty, for you and for clinics and salons.";

/** Every public page, for the sitemap. Not the order confirmation: it is per order, and noindex. */
export const PAGES: readonly string[] = ["/", "/clinics", "/contact", "/terms", "/privacy", "/returns", "/disclaimer"];

/**
 * The catalogue as the browser sees it (lib/commerce/storefront.ts), built
 * with the pages: the root layout hands it to the basket, and the buy
 * section reads it from there.
 */
export const STOREFRONT = storefrontView(brand);

/**
 * The home page's Essentials and the /clinics page sell the same packs, the
 * catalogue's four sizes. Named apart, so each page hands its picker its
 * own list.
 */
export const ESSENTIAL_PACKS = STOREFRONT.packs;
export const CLINIC_PACKS = STOREFRONT.packs;

/**
 * The basket's localStorage key. Each brand's domain has its own storage, so
 * it needs no brand in it; bump the suffix to drop every stored basket.
 */
export const BASKET_KEY = "basket-v1";

/**
 * The contact form's trade topic, in this brand's words; null offers none
 * (lib/commerce/contact.ts). The clinic packs' orders and quotes come here.
 */
export const TRADE_TOPIC: { label: string; hint?: string } | null = { label: CLINICS.tradeTopic, hint: CLINICS.tradeHint };
