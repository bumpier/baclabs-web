/**
 * Aurelle's words that appear on every page: the header, the basket, the
 * footer, and the pages every shop has (contact, the order, the 404). Kept
 * here, not in the components, so `npm run check:brands` reads them in one
 * place against the brand's rules (lib/content-rules.ts BEAUTY_RULES): no
 * procedure or skin words, no claims about skin.
 *
 * Imports nothing but the view's formatter, so client components may
 * import it (npm run test:bundle).
 */
import { formatGbp } from "@/lib/commerce/view";

export const NAV = {
  label: "Main",
  shop: "Shop",
  ritual: "The ritual",
  clinics: "For clinics",
  contact: "Contact",
  home: "Aurelle, home",
  menu: "Menu",
  closeMenu: "Close menu",
  /** The phone's menu, in full words. */
  menuLinks: {
    shop: "The Essentials",
    ritual: "The ritual",
    clinics: "For clinics and salons",
    contact: "Contact",
  },
} as const;

/** What each pack is called in the basket and on the order, by its vial count. */
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
  close: "Close the basket",
  empty: "Your basket is empty.",
  emptyBody: "Every size of the Essentials comes in the Aurelle pouch.",
  emptyCta: "Shop the Essentials",
  contents: (vials: number) => (vials === 1 ? "One sealed 10ml vial" : `${vials} sealed 10ml vials`),
  subtotal: "Subtotal",
  delivery: "Delivery",
  free: "Free",
  /** How far the basket is from free delivery, in the catalogue's figures. */
  shortfall: (minor: number, label: string | null) =>
    label ? `Add ${formatGbp(minor)} more for free ${label.toLowerCase()} delivery.` : `Add ${formatGbp(minor)} more and delivery is free.`,
  freeReached: (label: string | null) => (label ? `Your order has free ${label.toLowerCase()} delivery.` : "Your delivery is free."),
  quantityOf: (name: string) => `Quantity of ${name}`,
  remove: "Remove",
  checkout: "Check out",
  pending: "Opening checkout…",
  payBy: (label: string) => `Pay by ${label}.`,
  payWith: (label: string) => `Pay by ${label}`,
  sent: "Packed and sent from the UK by tracked delivery.",
  /** Read by screen readers when a set goes in. */
  added: (name: string) => `${name} added to your basket.`,
} as const;

export const FOOTER = {
  navLabel: "Footer",
  shop: "Shop",
  help: "Help",
  policies: "Policies",
  essentials: "The Essentials",
  ritual: "The ritual",
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
  body: "The address may have changed, or it never existed. The Essentials are a click away.",
  shop: "Shop the Essentials",
  home: "Back to the home page",
} as const;

export const CONTACT = {
  metaDescription: (name: string) => `Message ${name} about an order, delivery, a return or a question about the product.`,
  title: "Contact",
  lead: "Questions about an order, delivery or a return, complaints, and questions about the product before you order.",
  byForm: "Send us a message here",
  orEmail: ", or email ",
  formOnly: "Send us a message here.",
  clinicsLead: "Ordering for a clinic or salon?",
  clinicsLink: "See the clinic price list",
  orderLead: "Writing about an order?",
  orderHint: "Your order number is in your confirmation email.",
  form: {
    submit: "Send message",
  },
} as const;

export const ORDER = {
  metaTitle: "Your order",
  heading: {
    cancelled: "This order was cancelled",
    paid: "Thank you, your order is confirmed",
    confirming: "Payment received",
    received: "Order received",
  },
  status: {
    cancelled: "It is no longer active.",
    delivered: "Your order has been delivered.",
    sent: "Your order is on its way.",
    paid: "Payment has cleared and your order is being prepared.",
    confirming: "We are confirming your payment now. This page updates itself in a few seconds.",
    waiting: "We are waiting for your payment to be confirmed. This page shows the latest status whenever you reload it.",
  },
  summary: "Your order",
  orderLabel: "Order",
  placed: "Placed",
  delivery: "Delivery",
  free: "Free",
  totalPaid: "Total paid",
  total: "Total",
  // TODO(confirm): the pouch, as copy/home.ts ESSENTIALS.pouch; stepPack names it too.
  pouch: "Every set is packed in the Aurelle pouch.",
  parcel: "Your parcel",
  sentBy: "Sent by",
  tracking: "Tracking number",
  latest: "Latest update",
  delivered: "Delivered",
  sentOn: "Sent",
  next: "What happens next",
  stepEmail: "A confirmation email is on its way",
  stepEmailTo: "to",
  stepPack: (carrier: string | null, due: string | null, transit: string | null) =>
    carrier
      ? `We pack your order in its pouch and send it by ${carrier} to the address you gave${due ? `. It is due ${due}` : transit ? ` (${transit})` : ""}.`
      : "We pack your order in its pouch and send it to the address you gave.",
  stepShips: (detail: string, text: string) => ` ${detail} It ships on ${text}.`,
  stepTracking: "You get a second email when it ships, with its tracking number.",
  help: "Something not right?",
  helpLink: "Get in touch",
  helpTail: "quoting your order number.",
  home: "Back to the home page",
} as const;
