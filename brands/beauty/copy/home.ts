/**
 * The home page's words. Calm and plain: what the vial is, how a set
 * arrives, how it is sent. Every figure on the page is computed from the
 * storefront view where it is rendered; nothing here states a price.
 *
 * The product is described in the words every brand's legal pages use
 * (lib/commerce/legal.ts): sterile water with a bacteriostatic preservative,
 * in a sealed 10ml vial, supplied as a laboratory reagent. The preservative
 * is never named.
 */
import { formatGbp, type DeliveryOptionView } from "@/lib/commerce/view";

/** "£40" rather than "£40.00" in running text; pence stay when there are any. */
export function gbpShort(minor: number): string {
  return formatGbp(minor).replace(/\.00$/, "");
}

export const HERO = {
  title: "Your ritual, done properly.",
  lead: "Sterile water with a bacteriostatic preservative, in a sealed 10ml vial. Sets of one, three or five, packed with care and sent to your door.",
  cta: "Choose your set",
  clinics: "For clinics and salons",
  from: (minor: number) => `A single vial is ${gbpShort(minor)}.`,
  freeFrom: (minor: number) => `Delivery is free from ${gbpShort(minor)}.`,
  // TODO(launch): photography. The drawn still life stands in for a photograph
  // of the vial and its pouch on marble and silk.
  artLabel: "A sealed Aurelle vial standing on a marble plinth, with blush silk and pearls",
} as const;

export const ESSENTIALS = {
  title: "The Essentials",
  // TODO(confirm): the pouch. The catalogue packs each set in a gift-ready
  // pouch (brands/beauty/catalogue.ts boxSku); say so only once it is real.
  intro: "A single vial to begin, or a set to keep on hand. Each set arrives in a soft pouch, ready to put away or to give.",
  legend: "Choose a set",
  contents: (vials: number) => (vials === 1 ? "One sealed 10ml vial" : `${vials} sealed 10ml vials`),
  quantity: "How many",
  add: "Add to basket",
  artLabel: (vials: number) => (vials === 1 ? "A blush pouch holding one vial" : `A blush pouch holding ${vials} vials`),
} as const;

export const DETAILS = {
  title: "Kept simple",
  lead: "One product, described plainly, and sent the way you choose.",
  vialTerm: "The vial",
  vial: "Sterile water with a bacteriostatic preservative, in a sealed 10ml vial. It is sold as a laboratory reagent.",
  pouchTerm: "The pouch",
  pouch: "Every set of the Essentials comes wrapped in a soft pouch, so it arrives as something you would be glad to open.",
  deliveryTerm: "Delivery",
  returnsTerm: "Returns",
  returns: "Sealed goods have their own rules. Our returns policy sets out your rights, and how and when we refund.",
  returnsLink: "Read the returns policy",
} as const;

/**
 * The delivery options in one or two sentences, from the catalogue's own
 * options and threshold, so the page and the checkout never disagree.
 */
export function deliverySentences(options: readonly DeliveryOptionView[], freeFromMinor: number | null): string[] {
  const out = options.map((o) => `${o.label}, ${gbpShort(o.priceMinor)}: ${o.detail}.`);
  const free = options.filter((o) => o.overThreshold === "free");
  if (freeFromMinor !== null && free.length > 0) {
    const names = free.map((o) => o.label.toLowerCase()).join(" and ");
    out.push(`From ${gbpShort(freeFromMinor)}, ${names} delivery is free.`);
  }
  return out;
}

export const LETTERS = {
  title: "Letters from Aurelle",
  body: "New sets, restocks and offers, now and then, by email.",
  placeholder: "Your email address",
  submit: "Join the list",
  pending: "Joining…",
  done: "Thank you. You are on the list.",
  close: "Close",
} as const;

export const CLINICS_TEASER = {
  title: "For clinics and salons",
  body: (sizes: string, fromMinor: number) =>
    `The same sealed vial in packs of ${sizes}, for practitioners and salons who order in number. From ${gbpShort(fromMinor)} a pack.`,
  cta: "See the clinic packs",
} as const;

/** "25, 50 and 100". */
export function listSizes(sizes: readonly number[]): string {
  if (sizes.length <= 1) return sizes.join("");
  return `${sizes.slice(0, -1).join(", ")} and ${sizes[sizes.length - 1]}`;
}
