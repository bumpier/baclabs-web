/**
 * The home page's words. Calm and plain: what the vial is, how a set
 * arrives, how it is sent. Every figure on the page is computed from the
 * storefront view where it is rendered; nothing here states a price.
 *
 * The product is described in the words every brand's legal pages use
 * (lib/commerce/legal.ts): sterile water with a bacteriostatic preservative,
 * in a sealed 10ml vial, supplied as a laboratory reagent. The preservative
 * is never named. "The ritual" is the ritual of having it: it arrives, it
 * is kept, it comes again. Never what is done with it.
 *
 * Imports nothing but the view's types and formatter, so client components
 * may import it (npm run test:bundle).
 */
import { formatGbp, type DeliveryOptionView } from "@/lib/commerce/view";

/** "£40" rather than "£40.00" in running text; pence stay when there are any. */
export function gbpShort(minor: number): string {
  return formatGbp(minor).replace(/\.00$/, "");
}

/** "1, 5, 10 and 20". */
export function listSizes(sizes: readonly number[]): string {
  if (sizes.length <= 1) return sizes.join("");
  return `${sizes.slice(0, -1).join(", ")} and ${sizes[sizes.length - 1]}`;
}

/** "one, five, ten or twenty", for running text. */
export function sizeWords(sizes: readonly number[], joiner = "or"): string {
  const words: Record<number, string> = { 1: "one", 5: "five", 10: "ten", 20: "twenty" };
  const named = sizes.map((n) => words[n] ?? String(n));
  if (named.length <= 1) return named.join("");
  return `${named.slice(0, -1).join(", ")} ${joiner} ${named[named.length - 1]}`;
}

/**
 * The line above the header: the free-delivery offer the catalogue makes,
 * in its own figures, and its cutoff (shown from tablet width up, so a
 * phone keeps it to one line), or null when it makes none.
 */
export function announcement(
  options: readonly DeliveryOptionView[],
  freeFromMinor: number | null
): { offer: string; cutoff: string | null } | null {
  if (freeFromMinor === null) return null;
  const free = options.find((o) => o.overThreshold === "free");
  if (!free) return null;
  return {
    offer: `${free.label} delivery is free on orders from ${gbpShort(freeFromMinor)}.`,
    cutoff: free.cutoff ? `Order by ${free.cutoff} on a working day.` : null,
  };
}

export const HERO = {
  /** The promise. Its full stop is drawn as the seal on the page. */
  title: "Your ritual, done properly.",
  lead: (sizes: string) =>
    `Sterile water with a bacteriostatic preservative, in a sealed 10ml vial. In sets of ${sizes}, sent to your door by tracked delivery.`,
  cta: "Shop the Essentials",
  clinics: "For clinics and salons",
  from: (minor: number) => `A single vial is ${gbpShort(minor)}.`,
} as const;

export const ESSENTIALS = {
  title: "The Essentials",
  subtitle: "Bacteriostatic water, in sealed 10ml vials",
  galleryLabel: "Pictures of the Essentials",
  showPicture: (n: number, label: string) => `Picture ${n}: ${label}`,
  sizeLegend: "Size",
  /** Each size's name on its tile. */
  sizeName: (vials: number) =>
    vials === 1 ? "Single vial" : vials === 5 ? "Set of five" : vials === 10 ? "Set of ten" : vials === 20 ? "Set of twenty" : `Set of ${vials}`,
  contents: (vials: number) => (vials === 1 ? "One sealed vial" : `${vials} sealed vials`),
  // The box (the owner, 6 Nov 2026): every brand's sets go out in the same plain,
  // unprinted white box (brands/beauty/catalogue.ts boxSku).
  box: "Every size comes in a plain white box, with nothing printed on it.",
  quantity: "Quantity",
  add: "Add to basket",
  deliveryTitle: "Delivery",
  sentFrom: "Packed and sent from the UK, tracked all the way.",
  returnsTitle: "Returns",
  returns: "Sealed goods have their own rules. Our returns policy sets out your rights, and how and when we refund.",
  returnsLink: "Read the returns policy",
} as const;

/**
 * The delivery options in one or two sentences, from the catalogue's own
 * options and threshold, so the page and the checkout never disagree. Next
 * day's detail carries its cutoff ("if ordered by 3pm").
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

export const RITUAL = {
  title: "The ritual",
  voice: "The right thing, kept well, and in its place for when you want it.",
  /** A sequence: it arrives, it is kept, it comes again. */
  // The box, as ESSENTIALS.box.
  moments: [
    {
      title: "It arrives",
      body: "Your set comes in a plain white box, every vial sealed, sent by tracked delivery from the UK.",
    },
    {
      title: "It is kept",
      body: "The box keeps the set together in a drawer or on a shelf, each vial sealed until the day you open it.",
    },
    {
      title: "It comes again",
      body: "When a set runs low, the next is a few minutes away, in whichever size suits you.",
    },
  ],
  caption: "A set, as it arrives.",
  cta: "Choose your set",
} as const;

export const DETAILS = {
  title: "Kept simple",
  lead: "One product, described plainly, and sent the way you choose.",
  vialTerm: "The vial",
  vial: "Sterile water with a bacteriostatic preservative, in a sealed 10ml vial of clear glass. It is sold as a laboratory reagent.",
  capTerm: "The cap",
  cap: "Every vial is sealed under a blue flip-off cap and a silver crimp, and the label is left plain. Our name is on the packing slip, not on the vial or its box.",
  boxTerm: "The box",
  // The box is foam-padded inside (the owner, 13 Nov 2026).
  box: "Plain white card, with foam padding inside so every vial arrives unbroken.",
  sentTerm: "From the UK",
  sent: "Packed and sent from the UK by tracked delivery. When it ships, we email you its tracking number.",
} as const;

export const LETTERS = {
  title: "Letters from BeautyBac",
  body: "New sets, restocks and offers, now and then, by email.",
  placeholder: "Your email address",
  submit: "Join the list",
  pending: "Joining…",
  done: "Thank you. You are on the list.",
  close: "Close",
} as const;

export const CLINICS_TEASER = {
  title: "For clinics and salons",
  body: (sizes: string) =>
    `The same sealed vial in packs of ${sizes}, for practitioners and salons who order in number, and a direct line for anything larger or regular.`,
  cta: "See the clinic price list",
} as const;
