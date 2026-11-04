/**
 * Aurelle's words that appear on every page: the header, the basket and the
 * footer. Kept here, not in the components, so `npm run check:brands` reads
 * them in one place against the brand's rules (lib/content-rules.ts
 * BEAUTY_RULES): no procedure or treatment words, no claims about skin.
 *
 * Imports nothing but the view's types and formatter, so client components
 * may import it (npm run test:bundle).
 */
import { formatGbp } from "@/lib/commerce/view";

export const NAV = {
  label: "Main",
  essentials: "The Essentials",
  clinics: "For clinics",
  contact: "Contact",
  home: "Aurelle, home",
} as const;

/** What each pack is called on the page and in the basket, by its vial count. */
export function packName(vials: number): string {
  if (vials === 1) return "A single vial";
  if (vials === 5) return "A set of five";
  if (vials === 10) return "A set of ten";
  if (vials === 20) return "A set of twenty";
  return `A set of ${vials}`;
}

export function vialCount(n: number): string {
  return n === 1 ? "1 vial" : `${n} vials`;
}

export function perVial(minor: number): string {
  return `${formatGbp(minor)} a vial`;
}

export const BASKET = {
  link: "Basket",
  linkLabel: (n: number) => (n === 0 ? "Basket, empty" : `Basket, ${n === 1 ? "1 item" : `${n} items`}`),
  heading: "Your basket",
  empty: "Your basket is empty.",
  subtotal: "Subtotal",
  delivery: "Delivery",
  free: "Free",
  shortfall: (minor: number) => `Add ${formatGbp(minor)} more and delivery is free.`,
  quantityOf: (name: string) => `Quantity of ${name}`,
  remove: "Remove",
  checkout: "Check out",
  pending: "Opening checkout…",
  payBy: (label: string) => `Pay by ${label}.`,
  payWith: (label: string) => `Pay by ${label}`,
  added: "Added to your basket.",
  seeBasket: "See your basket",
} as const;

export const FOOTER = {
  navLabel: "Footer",
  shop: "Shop",
  help: "Help",
  policies: "Policies",
  essentials: "The Essentials",
  clinics: "For clinics and salons",
  contact: "Contact",
  returns: "Returns",
  terms: "Terms",
  privacy: "Privacy",
  disclaimer: "Product disclaimer",
  cookies: "Cookie settings",
  tagline: "Your ritual, done properly.",
} as const;

export const NOT_FOUND = {
  title: "This page is not here",
  body: "The address may have changed, or it never existed. Everything we sell is on the home page.",
  home: "Back to the home page",
} as const;
