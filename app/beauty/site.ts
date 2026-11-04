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
  "Bacteriostatic water in sealed 10ml vials, in sets of one, three and five, and in packs of 25, 50 and 100 for clinics and salons.";

/** Every public page, for the sitemap. Not the order confirmation: it is per order, and noindex. */
export const PAGES: readonly string[] = ["/", "/clinics", "/contact", "/terms", "/privacy", "/returns", "/disclaimer"];

/**
 * The catalogue as the browser sees it (lib/commerce/storefront.ts), built
 * with the pages: the root layout hands it to the basket, and the buy
 * section reads it from there.
 */
export const STOREFRONT = storefrontView(brand);

/**
 * The catalogue's packs of 25 and more are the clinic packs, sold on
 * /clinics; the smaller ones are the Essentials, sold on the home page.
 * Split here, on the server, so each page hands its picker only its own.
 */
const CLINIC_FROM_VIALS = 25;
export const ESSENTIAL_PACKS = STOREFRONT.packs.filter((p) => p.vials < CLINIC_FROM_VIALS);
export const CLINIC_PACKS = STOREFRONT.packs.filter((p) => p.vials >= CLINIC_FROM_VIALS);

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
