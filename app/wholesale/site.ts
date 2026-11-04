import { wholesaleProfile } from "@/brands/wholesale/profile";
import { storefrontView } from "@/lib/commerce/storefront";

/**
 * This brand's site settings, shared by its layout and its metadata routes.
 * Everything under app/wholesale/ is this brand's alone: it is reached only
 * through the host rewrite in middleware.ts, and never imports BacLab's
 * components, config or stylesheet.
 */
export const brand = wholesaleProfile();

/**
 * TODO(launch): true once the brand is live. Until then robots.txt
 * disallows everything and every page is noindex.
 */
export const LIVE = false;

export const DESCRIPTION = "10ml bacteriostatic water by the pack, priced per vial. Order online, or ask for a quote on larger volumes.";

/** Every public page, for the sitemap. Not the order confirmation: it is per order, and noindex. */
export const PAGES: readonly string[] = ["/", "/quote", "/contact", "/terms", "/privacy", "/returns", "/disclaimer"];

/**
 * The catalogue as the browser sees it (lib/commerce/storefront.ts), built
 * with the pages: the root layout hands it to the basket, and the buy
 * section reads it from there.
 *
 * Without each payment method's `terms` sentence: no page outside the legal
 * pages shows it, and it names the payment provider, which the legal pages
 * alone should. The view travels to the browser with every page, so it is
 * cut here rather than left unshown.
 */
const view = storefrontView(brand);
export const STOREFRONT = {
  ...view,
  payment: { methods: view.payment.methods.map((m) => ({ ...m, terms: "" })) },
};

/**
 * The basket's localStorage key. Each brand's domain has its own storage, so
 * it needs no brand in it; bump the suffix to drop every stored basket.
 */
export const BASKET_KEY = "basket-v1";

/**
 * The contact form's trade topic, in this brand's words; null offers none
 * (lib/commerce/contact.ts). Quote-only packs and standing orders come here.
 */
export const TRADE_TOPIC: { label: string; hint?: string } | null = {
  label: "A quote, or a standing order",
  hint: "Include the quantity you need, the delivery postcode and whether it is a one-off or recurring.",
};
