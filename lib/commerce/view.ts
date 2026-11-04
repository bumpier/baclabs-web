/**
 * A brand's storefront as its browser sees it: the catalogue cut down to what
 * a page shows and a basket needs. Built on the server by storefrontView()
 * (lib/commerce/storefront.ts) and handed to client components as a prop.
 *
 * Imports nothing, so any client component may use it: nothing here can pull
 * the brand registry, a profile or config/ into a bundle (npm run test:bundle
 * checks that for every file under components/commerce).
 *
 * Every figure here is for display. The checkout prices each line again from
 * the catalogue (lib/commerce/pricing.ts) and never reads a price from the
 * browser. priceBasket and deliveryQuote follow its rules, in its words, so
 * the page, the error it shows and the checkout agree; npm run test:kit
 * holds them to the checkout's own functions.
 */

/**
 * A way to pay (BrandProfile.payment), as the buy section may show it: its
 * id and label, and nothing else. The method's `terms` and `refunds`
 * sentences stay on the server, for the legal pages (lib/commerce/legal.ts
 * reads them from the profile): they name the provider, and the view
 * travels to the browser with every page.
 */
export interface PaymentMethodView {
  /** The id a payment-method choice would send with the order. */
  id: string;
  label: string;
}

/** One pack, as the storefront lists it (CataloguePack in brands/types.ts). */
export interface PackView {
  sku: string;
  /** The catalogue's name or badge for it. "" renders nothing. */
  label: string;
  vials: number;
  /** One pack, in pence. */
  priceMinor: number;
  /** One vial's share, rounded, in pence. Display only. */
  perVialMinor: number;
  /** false: listed but never sold online (quote only). The checkout refuses it. */
  available: boolean;
}

/** Something sold beside the packs (CatalogueAddOn). */
export interface AddOnView {
  sku: string;
  /** Neutral: it is also the line's name on the order and the receipt. */
  name: string;
  priceMinor: number;
  /** false while it is withdrawn or switched off (the Lab Kit before its stock arrives). */
  available: boolean;
  /** What one holds, in words ("3 syringes, ..."). "" when it has no parts list. */
  contents: string;
  /** At most one per vial in the order, as the checkout enforces. */
  perVial: boolean;
}

/** A delivery option, as the catalogue offers it (config/funnel.ts DeliveryOption). */
export interface DeliveryOptionView {
  /** "standard", "next_day": the id the checkout's `deliveryOption` takes. */
  id: string;
  label: string;
  carrier: string;
  /** "2–3 working days". */
  transit: string;
  /** Carrier and transit together. */
  detail: string;
  /** Below the free-delivery threshold, in pence. */
  priceMinor: number;
  /** At or over it: free, the difference from standard, or not offered. */
  overThreshold: "free" | "less-standard" | "hide";
}

export interface StorefrontView {
  currency: "GBP";
  /** Smallest first, as the catalogue lists them. */
  packs: PackView[];
  addOns: AddOnView[];
  delivery: {
    options: DeliveryOptionView[];
    /** Goods value, in pence, from which the over-threshold prices apply. null: never. */
    freeFromMinor: number | null;
  };
  /**
   * What one order may hold; the checkout refuses anything past them.
   * `maxGiftNote` is the gift note's length in characters, for a site whose
   * flags.giftNote is set.
   */
  limits: { maxVials: number; maxLineQty: number; maxLines: number; maxGiftNote: number };
  flags: {
    /** Trade buyers may give a company name and VAT number with the order (the checkout's `business`). */
    businessDetails: boolean;
    /** The checkout takes promotion codes. */
    promotionCodes: boolean;
    /**
     * The buyer may add a gift note (the checkout's `giftNote`), printed on
     * the packing slip and packed in the box. The checkout refuses one on a
     * site where this is false.
     */
    giftNote: boolean;
  };
  /**
   * The ways the checkout takes payment, as the brand's profile lists them,
   * in the order to offer them. Empty: the brand takes no payment, so show
   * no checkout button and nothing method-specific. With several, the order
   * names one (`method`). A listed method can still be off when the
   * customer pays (the view is built without the runtime env): the checkout
   * then answers 503 in neutral words, shown as they stand.
   */
  payment: { methods: PaymentMethodView[] };
  /** The brand's own GA4 property. null: none. Its Meta pixel is resolved per request (/api/pixel). */
  tracking: { ga4Id: string | null };
  /** The words the brand's signup form must show (they are stored as the consent record). null: no list. */
  mailingList: { consentText: string } | null;
}

/** A basket line: what the storefront sends to the checkout. Never a price. */
export interface BasketLine {
  sku: string;
  qty: number;
}

/**
 * What the buy section says when a payment comes back to it unfinished:
 * the return route's `?payment=<outcome>` (lib/commerce/payments/
 * paypal-settle.ts) and the provider's cancel address. Neutral: it names no
 * provider, so it reads the same for every way to pay.
 */
const PAYMENT_RETURN_MESSAGES: Record<string, string> = {
  cancelled: "Payment was cancelled. Your basket is still here.",
  declined: "The payment was declined. Please try again, or pay another way.",
  pending:
    "Your payment is still being confirmed. We will email you as soon as it clears, so there is no need to pay again.",
  address: "We deliver to UK addresses only. Please choose a UK delivery address when you pay.",
  failed: "The payment could not be completed. Please try again.",
};

/** The sentence for a `?payment=` code, or null for none or one we do not know. */
export function paymentReturnMessage(code: string | null | undefined): string | null {
  return (code && Object.hasOwn(PAYMENT_RETURN_MESSAGES, code) ? PAYMENT_RETURN_MESSAGES[code] : null) ?? null;
}

/** "£7.99", "£2,699.99". The same on the server and in the browser, so it hydrates. */
export function formatGbp(minor: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

export type BasketItem =
  | { kind: "pack"; sku: string; qty: number; pack: PackView; lineMinor: number }
  | { kind: "addOn"; sku: string; qty: number; addOn: AddOnView; lineMinor: number };

export interface PricedBasket {
  /** Packs in the catalogue's order, then add-ons. Unknown SKUs are left out. */
  items: BasketItem[];
  /** Everything but delivery, in pence. */
  goodsMinor: number;
  vials: number;
  /** Add-ons limited to one per vial. */
  kits: number;
  /**
   * Why the checkout would refuse this basket, in the checkout's own words,
   * or null when it would take it. An empty basket is null: it is a state to
   * show, not an error.
   */
  problem: string | null;
}

// The checkout's refusals (lib/commerce/pricing.ts), word for word.
const INVALID = "Invalid order details";
const PACK_OFFLINE = "That pack can't be ordered online.";

/**
 * The basket priced from the view, by the checkout's rules: repeats of a SKU
 * merge into one line, and the result says why the checkout would refuse it.
 */
export function priceBasket(view: StorefrontView, lines: readonly BasketLine[]): PricedBasket {
  const counts = new Map<string, number>();
  let problem: string | null = lines.length > view.limits.maxLines ? INVALID : null;
  for (const line of lines) {
    const sku = line.sku.trim().toUpperCase();
    const known = view.packs.some((p) => p.sku === sku) || view.addOns.some((a) => a.sku === sku);
    if (!known || !Number.isInteger(line.qty) || line.qty < 1) {
      problem ??= INVALID;
      continue;
    }
    counts.set(sku, (counts.get(sku) ?? 0) + line.qty);
  }

  const packs: BasketItem[] = [];
  const addOns: BasketItem[] = [];
  for (const [sku, qty] of counts) {
    if (qty > view.limits.maxLineQty) problem ??= INVALID;
    const pack = view.packs.find((p) => p.sku === sku);
    if (pack) {
      if (!pack.available) problem ??= PACK_OFFLINE;
      packs.push({ kind: "pack", sku, qty, pack, lineMinor: pack.priceMinor * qty });
      continue;
    }
    const addOn = view.addOns.find((a) => a.sku === sku)!;
    if (!addOn.available) problem ??= `${addOn.name} is not available right now.`;
    addOns.push({ kind: "addOn", sku, qty, addOn, lineMinor: addOn.priceMinor * qty });
  }
  const rank = (sku: string) => view.packs.findIndex((p) => p.sku === sku);
  packs.sort((a, b) => rank(a.sku) - rank(b.sku));

  const items = [...packs, ...addOns];
  const vials = packs.reduce((n, i) => n + (i.kind === "pack" ? i.pack.vials * i.qty : 0), 0);
  const kits = addOns.reduce((n, i) => n + (i.kind === "addOn" && i.addOn.perVial ? i.qty : 0), 0);
  if (items.length > 0) {
    if (vials === 0) problem ??= INVALID;
    else if (vials > view.limits.maxVials) {
      problem ??= `One order can hold up to ${view.limits.maxVials} vials. For more, please contact us.`;
    } else if (kits > vials) problem ??= INVALID;
  }
  return { items, goodsMinor: items.reduce((n, i) => n + i.lineMinor, 0), vials, kits, problem };
}

/** Whether goods of this value clear the free-delivery threshold. */
export function shipsFree(view: StorefrontView, goodsMinor: number): boolean {
  const from = view.delivery.freeFromMinor;
  return from !== null && goodsMinor >= from;
}

/**
 * The delivery options an order of this value is offered, each at the price
 * the checkout will charge, in the catalogue's order (the first is the one
 * it preselects). lib/commerce/catalogue.ts catalogueDeliveryOptions, read
 * from the view.
 */
export function deliveryQuote(
  view: StorefrontView,
  goodsMinor: number
): { option: DeliveryOptionView; priceMinor: number }[] {
  const free = shipsFree(view, goodsMinor);
  const standard = view.delivery.options.find((o) => o.id === "standard");
  const out: { option: DeliveryOptionView; priceMinor: number }[] = [];
  for (const option of view.delivery.options) {
    if (!free) out.push({ option, priceMinor: option.priceMinor });
    else if (option.overThreshold === "free") out.push({ option, priceMinor: 0 });
    else if (option.overThreshold === "less-standard") {
      out.push({ option, priceMinor: Math.max(0, option.priceMinor - (standard?.priceMinor ?? 0)) });
    }
  }
  return out;
}

/** How much more in goods clears the free-delivery threshold, or null when there is none to clear. */
export function freeDeliveryShortfallMinor(view: StorefrontView, goodsMinor: number): number | null {
  const from = view.delivery.freeFromMinor;
  if (from === null || goodsMinor >= from) return null;
  return from - goodsMinor;
}

/**
 * What a pack saves against buying its vials at the per-vial price of the
 * smallest pack on sale, in pence. 0 for that pack itself, or when nothing
 * smaller is on sale.
 */
export function packSavingMinor(view: StorefrontView, pack: PackView): number {
  const base = view.packs.find((p) => p.available);
  if (!base || base.sku === pack.sku) return 0;
  return Math.max(0, Math.round((base.priceMinor / base.vials) * pack.vials) - pack.priceMinor);
}
