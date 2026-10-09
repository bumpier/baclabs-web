// ─────────────────────────────────────────────────────────────────
// FUNNEL CONFIG — the single source of truth for the product, its
// price, and every bundle tier.
//
// Change a price HERE and nowhere else. `npx tsx scripts/stripe-setup.ts`
// then pushes the change to Stripe and to the local Product rows.
//
// Everything below that is empty ("" / [] / null) RENDERS NOTHING. That is
// deliberate: an unconfirmed fact must never appear on the page as a
// placeholder a customer could mistake for a claim.
// ─────────────────────────────────────────────────────────────────

import { brand } from "@/config/brand";
import { formatCutoffHour, formatDeliveryDay, nextDayDeadline } from "@/lib/delivery-date";

/** Money is held in integer pence everywhere. Never use floats for totals. */
export const CURRENCY = "GBP" as const;

/**
 * Millilitres in one vial. The fill volume is a headline fact on the page
 * and the divisor in every price-per-ml figure, so it lives here rather
 * than as a literal at each call site.
 */
export const VIAL_ML = 10;

/**
 * Draws obtainable from one vial at a given draw size, rounded down.
 * Stated on the page as a plain division, not a claim: a 10ml vial gives
 * ten 1ml draws or five 2ml draws, and nothing about the product
 * guarantees any particular draw size.
 */
export function drawsPerVial(drawMl: number): number {
  return Math.floor(VIAL_ML / drawMl);
}

// ── The product ───────────────────────────────────────────────────
// These are the confirmed facts. Do not add to them without a source.
export const PRODUCT = {
  name: "Bacteriostatic Water",
  size: "10ml vial",
  /** Price of a single vial, in pence. */
  unitPriceMinor: 599,
  // The preservative is never named or quantified on the site — see the note
  // at the top of content/facts.ts.
  composition:
    "Sterile water with a bacteriostatic preservative, in a sealed multi-dose vial.",
  use: "A sterile diluent and solvent, used to reconstitute or dilute substances for laboratory and research purposes.",
  // Empty strings render nothing.
  // Storage is NOT printed on the label, so never write "as per the label" for
  // it. Unopened vials keep at room temperature; opened vials go to 2–8°C.
  // The unopened expiry is batch-specific and printed on each vial, so it is
  // NOT stated here as a single figure.
  storageUnopened: "room temperature",
  storageOpened: "2–8°C",
  storage: "Room temperature until opened, then 2–8°C once opened",
  shelfLifeUnopened: "",
  /** pH range from the supplier's specification. Empty until supplied. */
  ph: "",
  // Confirmed from the supplier's label. Rendered as a spec row and answered
  // in config/faq.ts; both go silent again if this is ever cleared.
  shelfLifeAfterOpening: "28 days from first puncture",
  origin: "",
} as const;

// ── Bundle tiers ──────────────────────────────────────────────────
// `quantity` on the checkout route means "how many of THIS bundle", not
// how many vials. Buying 2 × five = 10 vials.
export type BundleId = "single" | "five" | "ten" | "twenty" | "fifty" | "hundred";

export interface Bundle {
  id: BundleId;
  /** Vials contained in one unit of this bundle. */
  vials: number;
  /** Price for one unit of this bundle, in pence. */
  priceMinor: number;
  /** Badge text. Empty string = no badge. */
  label: string;
  /** Name shown in Stripe, on the packing slip and in the order record. */
  sku: string;
}

export const BUNDLES: readonly Bundle[] = [
  { id: "single", vials: 1, priceMinor: 599, label: "", sku: "baclab-10ml-x1" },
  { id: "five", vials: 5, priceMinor: 2199, label: "Most popular", sku: "baclab-10ml-x5" },
  // The 7- and 8-vial tiers were retired on 11 Sept 2026. The 8-pack worked
  // out at £3.69 a vial — DEARER than the 10, 20, 50 and 100 packs beneath
  // it — so the ladder had a kink in it that every comparison table on the
  // site had to explain away. Six tiers now descend cleanly. Their Stripe
  // Prices (STRIPE_PRICE_SEVEN / _EIGHT) are no longer read and can be
  // archived in Stripe; the SKUs baclab-10ml-x7 and -x8 survive only in
  // historical order rows, which is exactly where they should stay.
  { id: "ten", vials: 10, priceMinor: 3499, label: "Stock up", sku: "baclab-10ml-x10" },
  { id: "twenty", vials: 20, priceMinor: 6499, label: "", sku: "baclab-10ml-x20" },
  { id: "fifty", vials: 50, priceMinor: 14999, label: "", sku: "baclab-10ml-x50" },
  { id: "hundred", vials: 100, priceMinor: 27499, label: "Wholesale", sku: "baclab-10ml-x100" },
] as const;

/**
 * The date the figures in BUNDLES or PRODUCT.unitPriceMinor last changed,
 * YYYY-MM-DD. Bump it in the same commit as a price change. It is the
 * `dateModified` on the home page's WebPage structured data — a real
 * date from a real edit, never a build timestamp.
 */
export const PRICES_UPDATED = "2026-09-07";

/** Pre-selected tier in the purchase block. */
export const DEFAULT_BUNDLE_ID: BundleId = "five";

/** Bundle quantity a single order may contain. Enforced server-side. */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

// ── Derived figures — computed, never typed by hand ───────────────

export function bundleById(id: string): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}

/** Price of one vial within this bundle, in pence. */
export function perVialMinor(b: Bundle): number {
  return Math.round(b.priceMinor / b.vials);
}

/** What the same number of vials would cost bought singly, in pence. */
export function singlesPriceMinor(b: Bundle): number {
  return b.vials * PRODUCT.unitPriceMinor;
}

/** Saving versus buying singles, in pence. 0 for the single tier. */
export function savingMinor(b: Bundle): number {
  return Math.max(0, singlesPriceMinor(b) - b.priceMinor);
}

/** Saving versus buying singles, as a whole percentage. */
export function savingPercent(b: Bundle): number {
  const full = singlesPriceMinor(b);
  return full === 0 ? 0 : Math.round((savingMinor(b) / full) * 100);
}

/** Order total for `quantity` units of a bundle, in pence. */
export function totalMinor(b: Bundle, quantity: number): number {
  return b.priceMinor * quantity;
}

/** £7.50 — the canonical way to render pence. Used in copy and CTAs. */
export function formatMinor(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

/**
 * "£30" for a whole number of pounds, "£7.50" otherwise. BADGE COPY ONLY.
 * A trailing ".00" on a round threshold reads as noise in a sentence, but a
 * price, a line item or a total must always show two decimals — those stay on
 * `formatMinor`, and nothing in the totals table uses this.
 */
export function formatMinorShort(minor: number): string {
  return minor % 100 === 0 ? `£${minor / 100}` : formatMinor(minor);
}

/** Price per millilitre, for the comparison table. */
export function perMlMinor(b: Bundle): number {
  return b.priceMinor / (b.vials * VIAL_ML);
}

// ── Sale presentation ─────────────────────────────────────────────
//
// PRESENTATION ONLY. The customer is charged `priceMinor`, exactly the same
// figure as with the sale switched off — nothing here touches Stripe, the
// order total or the Price IDs. The struck-through figure is DERIVED from
// `percentOff`, so the arithmetic shown on the page is always self-consistent.
//
// BEFORE ENABLING THIS FOR REAL CUSTOMERS: a struck-through "was" price has to
// be a price the product was genuinely on sale at, for a meaningful period —
// CMA pricing guidance, enforced under the CPUTR and the DMCC Act. Set
// `referenceFrom` to the date that higher price actually took effect.
// `mayShowReferencePrice()` returns false until REFERENCE_MIN_DAYS have passed,
// so a fabricated reference price cannot ship by accident.
export const SALE = {
  enabled: true,
  /** Whole percent. Drives the badge text AND the struck-through figure. */
  percentOff: 30,
  bannerText: "30% off every bundle",
  /** ISO date the pre-sale price actually took effect. null = never charged. */
  referenceFrom: null as string | null,
};

/** Days the reference price must have been the real selling price. */
export const REFERENCE_MIN_DAYS = 30;

/**
 * Design-review escape hatch: renders the sale UI without a qualifying
 * reference period. Off unless NEXT_PUBLIC_SALE_PREVIEW is explicitly "true",
 * so it can never reach customers by omission.
 */
export const SALE_PREVIEW = process.env.NEXT_PUBLIC_SALE_PREVIEW === "true";

/** True once the reference price has been the real selling price long enough. */
export function mayShowReferencePrice(now: Date = new Date()): boolean {
  if (!SALE.referenceFrom) return false;
  const from = new Date(SALE.referenceFrom);
  if (Number.isNaN(from.getTime())) return false;
  return (now.getTime() - from.getTime()) / 86_400_000 >= REFERENCE_MIN_DAYS;
}

/** Whether the sale UI renders at all. */
export function saleVisible(now?: Date): boolean {
  if (!SALE.enabled || SALE.percentOff <= 0) return false;
  return SALE_PREVIEW || mayShowReferencePrice(now);
}

/** The struck-through figure for a bundle, in pence. */
export function referencePriceMinor(b: Bundle): number {
  return Math.round(b.priceMinor / (1 - SALE.percentOff / 100));
}

/** The struck-through figure for one vial, in pence. */
export function referenceUnitPriceMinor(): number {
  return Math.round(PRODUCT.unitPriceMinor / (1 - SALE.percentOff / 100));
}

/** The struck-through per-vial figure for a pack, in pence — the chooser tiles. */
export function referencePerVialMinor(b: Bundle): number {
  return Math.round(referencePriceMinor(b) / b.vials);
}

/** Pence the sale takes off `quantity` of this pack — the "You save" line. */
export function saleSavingMinor(b: Bundle, quantity: number): number {
  return (referencePriceMinor(b) - b.priceMinor) * quantity;
}

/** Pence the sale takes off one vial, for the hero. */
export function saleUnitSavingMinor(): number {
  return referenceUnitPriceMinor() - PRODUCT.unitPriceMinor;
}

/** "30% off" — derived, so the badge can never contradict the figures. */
export function saleLabel(): string {
  return `${SALE.percentOff}% off`;
}

/** "Save 30%" — the same figure, for the hero pill. */
export function saleSaveLabel(): string {
  return `Save ${SALE.percentOff}%`;
}

/**
 * The tier that genuinely costs least per vial. DERIVED, never typed: the
 * "Best value" badge used to be a literal on the 8-vial pack while four
 * larger packs undercut it, which is exactly the kind of claim the CPUTR and
 * the DMCC Act put the burden of proof on the seller for. Re-price any tier
 * and the badge follows the arithmetic instead of contradicting it.
 *
 * Ties resolve to the SMALLER pack — the more conservative place to put a
 * value claim, because it is the one a buyer reaches first.
 */
export function bestPerVialBundleId(): BundleId {
  return BUNDLES.reduce((best, b) =>
    perVialMinor(b) < perVialMinor(best) ? b : best
  ).id;
}

/**
 * Every badge a tier should show, in render order. The derived value badge
 * comes first because it is the one making a claim; the editorial label
 * ("Most popular", "Wholesale") follows as a signpost. Empty entries drop
 * out, so a tier with neither renders no badge at all.
 */
export function bundleBadges(b: Bundle): string[] {
  const badges: string[] = [];
  if (b.id === bestPerVialBundleId()) badges.push("Best value per vial");
  if (b.label) badges.push(b.label);
  return badges;
}

/** Best genuine bundle saving against the single-vial price, as a percent. */
export function bestSavingPercent(): number {
  return BUNDLES.reduce((best, b) => Math.max(best, savingPercent(b)), 0);
}

// ── Environment: Stripe Price IDs ─────────────────────────────────
// One Price per bundle. Populated by scripts/stripe-setup.ts, which prints
// these lines ready to paste. Server-side only — never exposed to the client.
const PRICE_ENV: Record<BundleId, string> = {
  single: "STRIPE_PRICE_SINGLE",
  five: "STRIPE_PRICE_FIVE",
  ten: "STRIPE_PRICE_TEN",
  twenty: "STRIPE_PRICE_TWENTY",
  fifty: "STRIPE_PRICE_FIFTY",
  hundred: "STRIPE_PRICE_HUNDRED",
};

/** The Price ID configured for a bundle, or null when unset. */
export function priceIdFor(id: BundleId): string | null {
  return process.env[PRICE_ENV[id]] || null;
}

/**
 * Every Price ID this deployment will accept. The checkout route matches the
 * resolved Price against this list before creating a session, so a Price ID
 * that is not configured here can never be charged.
 */
export function allowedPriceIds(): string[] {
  return BUNDLES.map((b) => priceIdFor(b.id)).filter((v): v is string => !!v);
}

// ── Storefront configuration ──────────────────────────────────────

/**
 * Announcement bar. Empty string hides the bar entirely.
 * Only put REAL, currently-true information here.
 */
export const ANNOUNCEMENT = "";

/**
 * Real stock signal. `null` renders nothing.
 * Set to a number ONLY when it reflects actual stock on hand. Inventing
 * scarcity is unlawful in the UK under the CPUTR / DMCC Act.
 */
export const STOCK_LEVEL: number | null = null;

/** Below this figure the page shows a low-stock line. Ignored while STOCK_LEVEL is null. */
export const LOW_STOCK_THRESHOLD = 10;

/**
 * Countries Stripe Checkout will collect a shipping address for.
 * Add more ISO-3166-1 alpha-2 codes as you start shipping to them.
 */
export const SHIPPING_COUNTRIES = ["GB"] as const;

/**
 * The delivery options the customer chooses between at checkout — on
 * Stripe's page for cards, on /checkout for crypto. Each one is linked to
 * the SmartTrack services that fulfil it on the admin Shipping page, so an
 * order that paid for next day is only ever sent next day.
 *
 * `priceMinor` is the charge below the free-delivery threshold.
 * `overThreshold` is what happens once the order qualifies (shipsFree()):
 *  - "free"          → £0
 *  - "less-standard" → priceMinor minus the Standard option's price, so the
 *                      customer still gets the free delivery they earned
 *  - "hide"          → not offered. Standard hides, so an order over the
 *                      threshold has the one option: next day, free
 *
 * The first option offered is the one preselected on Stripe's page.
 * `detail` is the timeless wording, for the FAQ, llms.txt and the admin.
 * Checkout shows deliveryDetailAt() instead, where next day carries the
 * date it arrives (lib/delivery-date.ts). Promise no speed here that
 * dispatch cannot keep: next day only means next day after dispatch.
 */
export type DeliveryOptionId = "standard" | "next_day";

/**
 * The customer's choice of delivery is being TESTED and is off in live.
 * Off, checkout is exactly as it was before there was a choice: Stripe
 * charges STRIPE_SHIPPING_RATE_ID (free over the threshold), crypto orders
 * pay no delivery, and the storefront quotes the one price. Turn it on per
 * environment with NEXT_PUBLIC_DELIVERY_CHOICE=on — read at build time, so
 * rebuild after changing it.
 */
export function deliveryChoiceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DELIVERY_CHOICE === "on";
}

export interface DeliveryOption {
  id: DeliveryOptionId;
  label: string;
  carrier: string;
  /** How long it takes, as a phrase: "2–3 working days". */
  transit: string;
  /** Carrier and transit together: "Royal Mail Tracked 48, 2–3 working days". */
  detail: string;
  /** The service in a sentence: "next-day delivery". */
  noun: string;
  priceMinor: number;
  overThreshold: "free" | "less-standard" | "hide";
}

const option = (o: Omit<DeliveryOption, "detail">): DeliveryOption => ({ ...o, detail: `${o.carrier}, ${o.transit}` });

/**
 * Standard's working days in transit, [min, max]: the Standard line and the
 * structured data both read it. 2–3 is Royal Mail's own target for Tracked
 * 48, so the site promises no more than the carrier does.
 */
const STANDARD_TRANSIT_DAYS: [number, number] = [2, 3];

export const DELIVERY_OPTIONS: readonly DeliveryOption[] = [
  option({
    id: "standard",
    label: "Standard",
    carrier: "Royal Mail Tracked 48",
    transit: `${STANDARD_TRANSIT_DAYS[0]}–${STANDARD_TRANSIT_DAYS[1]} working days`,
    noun: "standard delivery",
    priceMinor: 390,
    overThreshold: "hide",
  }),
  option({
    id: "next_day",
    label: "Next day",
    carrier: "Amazon Shipping",
    transit: `next working day if ordered by ${formatCutoffHour()}`,
    noun: "next-day delivery",
    priceMinor: 500,
    overThreshold: "free",
  }),
];

export const STANDARD_DELIVERY = DELIVERY_OPTIONS.find((o) => o.id === "standard")!;

/** The option an order gets free once it clears the threshold: next day. */
const FREE_DELIVERY = DELIVERY_OPTIONS.find((o) => o.overThreshold === "free");

export function deliveryOptionById(id: string | null | undefined): DeliveryOption | undefined {
  return DELIVERY_OPTIONS.find((o) => o.id === id);
}

/**
 * An option's line at checkout at this moment. Next day carries the day it
 * arrives: "Amazon Shipping. Order by 3pm for delivery Wed 7 Oct" before the
 * cutoff, "Amazon Shipping. Delivery Thu 8 Oct" after it. Every other option
 * shows its detail.
 */
export function deliveryDetailAt(option: DeliveryOption, now: Date): string {
  if (option.id !== "next_day") return option.detail;
  const { deliveryDayKey, dispatchedToday } = nextDayDeadline(now);
  const day = formatDeliveryDay(deliveryDayKey);
  return dispatchedToday
    ? `${option.carrier}. Order by ${formatCutoffHour()} for delivery ${day}`
    : `${option.carrier}. Delivery ${day}`;
}

/**
 * Whether next day can be bought, for anything that promises it outside
 * checkout. False while the choice is switched off: live checkout cannot
 * sell it then.
 */
export function nextDayOffered(): boolean {
  return deliveryChoiceEnabled() && DELIVERY.mode !== "unknown" && deliveryOptionById("next_day") !== undefined;
}

/**
 * What STRIPE_SHIPPING_RATE_ID charges: the one delivery price while the
 * choice is switched off, so the storefront quotes what Stripe will charge.
 * Delete it with the switch once the choice is live.
 */
const SINGLE_RATE_MINOR = 299;

/** The delivery price the storefront quotes below the free threshold. */
export function quotedDeliveryMinor(): number {
  return deliveryChoiceEnabled() ? STANDARD_DELIVERY.priceMinor : SINGLE_RATE_MINOR;
}

/**
 * Delivery presentation. `mode: "unknown"` shows "calculated at checkout"
 * and flags itself in LAUNCH-CHECKLIST.md.
 *  - "free"     → no delivery charge; `note` explains any threshold
 *  - "flat"     → charged by Stripe via STRIPE_SHIPPING_RATE_ID
 *  - "unknown"  → "Delivery calculated at checkout"
 */
export const DELIVERY: {
  mode: "free" | "flat" | "threshold" | "unknown";
  priceMinor: number | null;
  /**
   * Order value, in pence, AT OR ABOVE which delivery is free. Compared
   * against the amount actually charged for the order (post-sale if a sale
   * is live), not the pre-sale reference price. Only read when mode is
   * "threshold".
   */
  freeFromMinor: number | null;
  note: string;
  dispatchLine: string;
  handlingDays: [number, number] | null;
  transitDays: [number, number] | null;
} = {
  mode: "threshold",
  // The figure the storefront quotes: the Standard option's price, set on
  // DELIVERY_OPTIONS above, or the single Stripe rate while the choice is off.
  priceMinor: quotedDeliveryMinor(),
  freeFromMinor: 4000,
  note:
    deliveryChoiceEnabled() && FREE_DELIVERY
      ? `Free ${FREE_DELIVERY.noun} on UK orders of £40 or more.`
      : "Free UK delivery on orders of £40 or more.",
  // Every order, standard and next day alike, leaves the same day when it is
  // placed before the cutoff on a working day (lib/delivery-date.ts).
  dispatchLine: `Orders placed by ${formatCutoffHour()} on a working day are dispatched the same day.`,
  /**
   * Working days from order to dispatch, and from dispatch to arrival, as
   * `[min, max]`. Feed Product `shippingDetails.deliveryTime`; null omits the
   * block, so the structured data never asserts a speed the shop has not
   * committed to on the page. Set both, and dispatchLine above, together.
   * Handling is 0 before the cutoff, 1 after it. Transit is the Standard
   * option's, whose price the structured data quotes, so it is only stated
   * while the customer chooses Standard and the carrier is known.
   */
  handlingDays: [0, 1],
  transitDays: deliveryChoiceEnabled() ? STANDARD_TRANSIT_DAYS : null,
};

/**
 * The returns policy as structured data reads it. Every figure here is the
 * one written on /returns — change them together. `customerPaysReturn` is
 * the "you pay the cost of returning the goods" clause; the sealed-goods
 * exception cannot be expressed in schema and is left to the page.
 */
export const RETURNS = {
  windowDays: 14,
  customerPaysReturn: true,
  path: "/returns",
} as const;

/**
 * Whether an order of this value ships free.
 *
 * THE single source of truth: the storefront and the Stripe session both call
 * it, so the delivery a customer is shown and the delivery they are charged
 * cannot drift apart. Change the rule here and both follow.
 */
export function shipsFree(orderValueMinor: number): boolean {
  if (DELIVERY.mode === "free") return true;
  if (DELIVERY.mode !== "threshold") return false;
  return DELIVERY.freeFromMinor !== null && orderValueMinor >= DELIVERY.freeFromMinor;
}

/**
 * Standard delivery's charge in pence for an order of this value. 0 when it
 * ships free. The figure the storefront quotes; the other options are listed
 * beside it (deliveryOptionsFor).
 */
export function deliveryMinorFor(orderValueMinor: number): number {
  if (DELIVERY.mode === "unknown") return 0;
  if (shipsFree(orderValueMinor)) return 0;
  // Read the switch now rather than DELIVERY.priceMinor's copy from load
  // time, for scripts that flip it (scripts/test-shipping.ts).
  return quotedDeliveryMinor();
}

/**
 * The delivery options offered for an order of this value, each at the price
 * it will be charged, in DELIVERY_OPTIONS order. THE source for the Stripe
 * session, the crypto checkout and the storefront alike. Empty while the
 * choice is switched off (deliveryChoiceEnabled) or DELIVERY.mode is
 * "unknown".
 */
export function deliveryOptionsFor(orderValueMinor: number): { option: DeliveryOption; priceMinor: number }[] {
  if (!deliveryChoiceEnabled() || DELIVERY.mode === "unknown") return [];
  const free = shipsFree(orderValueMinor);
  const out: { option: DeliveryOption; priceMinor: number }[] = [];
  for (const option of DELIVERY_OPTIONS) {
    if (!free) {
      out.push({ option, priceMinor: option.priceMinor });
    } else if (option.overThreshold === "free") {
      out.push({ option, priceMinor: 0 });
    } else if (option.overThreshold === "less-standard") {
      out.push({ option, priceMinor: Math.max(0, option.priceMinor - STANDARD_DELIVERY.priceMinor) });
    }
  }
  return out;
}

/**
 * The option a purchase block prices for an order of this value: the first
 * one offered, which Stripe preselects too. Standard below the threshold,
 * next day once the order ships free.
 */
export function quotedDeliveryOption(orderValueMinor: number): DeliveryOption {
  return deliveryOptionsFor(orderValueMinor)[0]?.option ?? STANDARD_DELIVERY;
}

/**
 * "Next day £5.00" — the options other than the quoted one, for the line
 * under a purchase block's total. "" when there are none.
 */
export function otherDeliveryOptionsLine(orderValueMinor: number): string {
  return deliveryOptionsFor(orderValueMinor)
    .slice(1)
    .map((o) => `${o.option.label} ${o.priceMinor === 0 ? "free" : formatMinor(o.priceMinor)}`)
    .join(" · ");
}

/**
 * What an order over the threshold gets free: "next-day delivery" while the
 * customer chooses their delivery, plain "UK delivery" while they cannot.
 */
export function freeDeliveryName(): string {
  return deliveryChoiceEnabled() && FREE_DELIVERY ? FREE_DELIVERY.noun : "UK delivery";
}

/**
 * One sentence listing every option and its prices, for the FAQ and
 * llms.txt. "" while the choice is switched off.
 */
export function deliveryOptionsSentence(): string {
  if (!deliveryChoiceEnabled() || DELIVERY.mode === "unknown") return "";
  const over = DELIVERY.freeFromMinor;
  const parts = DELIVERY_OPTIONS.map((o) => {
    const base = `${o.label} (${o.detail}) ${formatMinorShort(o.priceMinor)}`;
    if (DELIVERY.mode !== "threshold" || over === null) return base;
    if (o.overThreshold === "free") return `${base}, free from ${formatMinorShort(over)}`;
    if (o.overThreshold === "less-standard") {
      return `${base}, ${formatMinorShort(Math.max(0, o.priceMinor - STANDARD_DELIVERY.priceMinor))} from ${formatMinorShort(over)}`;
    }
    return `${base} on orders under ${formatMinorShort(over)}`;
  });
  return `Choose your delivery at checkout: ${parts.join("; ")}.`;
}

/**
 * How long each option takes, for "How long does delivery take?": "You
 * choose at checkout: standard by Royal Mail Tracked 48 (2–3 working days) or next day by
 * Amazon Shipping (…)". "" while the choice is switched off, since the
 * carrier is then not the customer's to pick.
 */
export function deliveryTimesSentence(): string {
  if (!deliveryChoiceEnabled() || DELIVERY.mode === "unknown") return "";
  const parts = DELIVERY_OPTIONS.map((o) => `${o.label.toLowerCase()} by ${o.carrier} (${o.transit})`);
  const over = DELIVERY.mode === "threshold" ? DELIVERY.freeFromMinor : null;
  const freeOnly =
    over !== null && FREE_DELIVERY && DELIVERY_OPTIONS.some((o) => o.overThreshold === "hide")
      ? ` Orders of ${formatMinorShort(over)} or more go ${FREE_DELIVERY.label.toLowerCase()}, free.`
      : "";
  const dated = nextDayOffered() ? " For next day, checkout shows the date it will arrive." : "";
  return `You choose at checkout: ${parts.join(" or ")}.${freeOnly}${dated}`;
}

/**
 * VAT treatment shown before the customer reaches Stripe.
 * `statement` is rendered verbatim; empty renders nothing.
 * Stripe Tax stays off by default — see app/api/checkout/route.ts.
 */
export const VAT: { statement: string } = {
  statement: "",
};

/**
 * "Why buy from us" items. Only entries with BOTH a title and body render.
 * Every one of these must be something you can evidence.
 */
export const WHY_BUY: readonly { title: string; body: string }[] = [];

/**
 * Guarantee / risk-reversal terms. Shown as the detail line of the price
 * badge in the trust bar (the `#guarantee` anchor); there is no standalone
 * section. Empty body drops the badge, and with it every link to it.
 */
export const GUARANTEE: { title: string; body: string } = {
  title: "The UK's lowest price — guaranteed",
  // The instruction is route-aware. With no address configured this used to
  // read "Email us the listing and we'll match the price" — telling the
  // reader to use a channel the site does not publish, on the one claim that
  // substantiates LOWEST_PRICE_BADGE. The undertaking survives without the
  // channel; the instruction does not, so only the instruction drops.
  body: brand.contact.email
    ? `Found this exact product cheaper, in stock, from another UK-based seller? Email us the listing at ${brand.contact.email} and we'll match the price.`
    : `Found this exact product cheaper, in stock, from another UK-based seller? We'll match the price.`,
};

/**
 * Short badge text for the hero, comparison table, footer and sticky bar.
 * The full terms live in GUARANTEE.body — every use of this string should
 * link to the trust-bar price card (id="guarantee" on the home page) rather
 * than restate the terms.
 */
export const PRICE_MATCH_BADGE = "UK price match guarantee";

/**
 * The headline price claim. Empty string renders nothing, everywhere.
 *
 * READ THIS BEFORE CHANGING IT. This is a bare SUPERLATIVE: the qualified
 * wording ("... or we match it") was considered and the bare form chosen
 * deliberately. Under the CPUTR and the DMCC Act the burden of substantiating
 * a superlative sits with the seller, and two things carry it here:
 *
 *  1. GUARANTEE.body, the undertaking to match any cheaper UK listing.
 *     `trustBadges()` will not emit this badge while that body is empty, so
 *     clearing the guarantee withdraws the claim automatically rather than
 *     leaving a superlative standing on nothing.
 *  2. Every use of it links to `#guarantee`, putting the terms one click from
 *     the claim on all three surfaces that state it: the hero strip, the trust
 *     bar and the closing CTA. (The purchase block deliberately does not
 *     repeat it — the hero and trust bar are on screen moments earlier.)
 *
 * Neither of those makes the claim TRUE. That depends on the prices in
 * BUNDLES really being the lowest in the UK -- a fact about the market, not
 * about this file, and one worth re-checking against real competitor listings
 * periodically. If it stops holding, change this string; do not leave the
 * price-match promise to absorb the difference.
 */
export const LOWEST_PRICE_BADGE = "Cheapest in the UK";

/**
 * "Free UK delivery over £40", DERIVED from DELIVERY rather than typed.
 * The badge, the basket nudge and the amount Stripe charges all resolve from
 * the same figure, so re-pricing delivery can never leave a stale promise on
 * the page. Returns "" when the current mode makes no free-delivery claim.
 *
 * `named` names the service the offer covers, "Free next-day delivery over
 * £40", for beside the next-day countdown, so the pair says outright that
 * the free delivery is the fast one.
 */
export function freeDeliveryBadge({ named = false }: { named?: boolean } = {}): string {
  const free = named ? `Free ${freeDeliveryName()}` : "Free UK delivery";
  if (DELIVERY.mode === "free") return free;
  if (DELIVERY.mode === "threshold" && DELIVERY.freeFromMinor !== null) {
    return `${free} over ${formatMinorShort(DELIVERY.freeFromMinor)}`;
  }
  return "";
}

/**
 * "Next-day delivery, order by 3pm", beside the free-delivery badge. "" while
 * next day cannot be bought (nextDayOffered), so the claim never outlives
 * the option.
 */
export function nextDayBadge(): string {
  return nextDayOffered() ? `Next-day delivery, order by ${formatCutoffHour()}` : "";
}

/**
 * Pence still to add before this order ships free. 0 once it already does,
 * and 0 when no threshold applies \u2014 so a caller can render the nudge on a
 * positive number alone without re-checking the delivery mode.
 */
export function remainingForFreeDeliveryMinor(orderValueMinor: number): number {
  if (DELIVERY.mode !== "threshold" || DELIVERY.freeFromMinor === null) return 0;
  if (shipsFree(orderValueMinor)) return 0;
  return DELIVERY.freeFromMinor - orderValueMinor;
}

/** Which mark a badge draws. Mapped to an SVG in components/funnel/TrustBar. */
export type TrustIcon = "price" | "delivery" | "secure" | "sealed";

export interface TrustBadge {
  /** The short line. Also the React key, so it must be unique. */
  label: string;
  /** One sentence of substantiation, shown wherever there is room for it. */
  detail: string;
  icon: TrustIcon;
  /** Anchor holding the full terms. Omitted when there are none to link to. */
  href?: string;
}

/**
 * THE badge set. The hero strip, the trust bar, the sticky bar, the final CTA
 * and the announcement bar all read this, so a claim is added, reworded or
 * withdrawn in exactly one place.
 *
 * Entries whose text resolves empty are dropped, keeping the "an unconfirmed
 * fact renders nothing" rule of this file: clear LOWEST_PRICE_BADGE or switch
 * DELIVERY.mode and the badge disappears everywhere at once.
 */
export function trustBadges(): TrustBadge[] {
  const delivery = freeDeliveryBadge();
  const underThreshold =
    DELIVERY.mode === "threshold" && DELIVERY.priceMinor !== null
      ? ` Below that it is ${formatMinorShort(DELIVERY.priceMinor)}, shown before you pay.`
      : "";

  const all: (TrustBadge | null)[] = [
    LOWEST_PRICE_BADGE && GUARANTEE.body
      ? {
          label: LOWEST_PRICE_BADGE,
          detail: GUARANTEE.body,
          icon: "price",
          href: "#guarantee",
        }
      : null,
    delivery
      ? {
          label: delivery,
          detail: `Sent to any UK address.${underThreshold}`,
          icon: "delivery",
        }
      : null,
    {
      label: "Secure checkout by Stripe",
      detail: "Card details go straight to Stripe. We never see or store them.",
      icon: "secure",
    },
    {
      label: "Sealed, tamper-evident vial",
      detail: `${VIAL_ML}ml, sterile water with a bacteriostatic preservative, sold as a laboratory and research diluent.`,
      icon: "sealed",
    },
  ];

  return all.filter((b): b is TrustBadge => b !== null);
}

/**
 * The step up to the next pack: a line under the pack choice, and a dialog
 * between the checkout button and Stripe (lib/upsell.ts). It only ever
 * offers a pack from BUNDLES at its own price, so it makes no claim the
 * ladder does not already make. `enabled: false` removes both; `popup: false`
 * keeps the line and checks out without the dialog.
 */
export const UPSELL = {
  enabled: true,
  popup: true,
} as const;

/**
 * Desktop-only, dismissible exit-intent offer. Disabled by default.
 * Never enable this with an invented discount — wire `promoCode` to a real
 * Stripe promotion code, which `allow_promotion_codes` will accept.
 */
export const EXIT_INTENT: { enabled: boolean; heading: string; body: string; promoCode: string } = {
  enabled: false,
  heading: "",
  body: "",
  promoCode: "",
};

/**
 * The mailing-list signup and its welcome offer: one free vial on the
 * subscriber's first order. Read by components/mailing-list/*, the checkout
 * route and lib/mailing-list.ts, so switching the offer off here removes it
 * from the forms, the Stripe page and the order at once.
 *
 * Empty config renders nothing: `enabled: false` hides every signup surface;
 * an empty `headline` or `offerLine` drops that line; `welcomeVial.enabled:
 * false` keeps the list running without the gift. `consentText` is stored
 * against each subscriber as the record of what they agreed to, so change
 * it deliberately.
 */
export const MAILING_LIST = {
  enabled: true,
  headline: "Get a free vial on your first order",
  offerLine:
    "Join the BacLab mailing list and we will add an extra 10ml vial to your first order, on us.",
  consentText:
    "By signing up you agree to receive marketing emails from BacLab: offers, restocks and new pack sizes. Unsubscribe at any time from any email.",
  /** The name of the free line on the order, the Stripe page and the receipt. */
  welcomeLineName: "Free vial (mailing list welcome)",
  popup: {
    /** Opens this long after landing. 0 disables the entry popup. */
    entryDelayMs: 4000,
    /** Opens again as the pointer leaves the top of the window (desktop). */
    exitIntent: true,
    /** How long a dismissal is remembered in this browser. */
    dismissDays: 14,
  },
  welcomeVial: { enabled: true },
  /**
   * Follow-up emails to a subscriber whose welcome vial is still unused
   * (lib/welcome-reminders.ts). They stop as soon as the subscriber orders or
   * unsubscribes. `enabled: false` sends none; the bonus already promised to
   * anyone who has had the second reminder is still honoured.
   */
  reminders: {
    enabled: true,
    /** The first reminder goes this long after signup. */
    firstAfterHours: 48,
    /** The second goes this long after the first, and carries the bonus. */
    secondAfterHours: 72,
    /**
     * A signup older than this is never chased, so a job that was switched
     * off for a while does not email a list that has gone cold.
     */
    staleAfterDays: 14,
    /**
     * The second reminder's offer: this many vials on top of the welcome
     * vial, on a first order of at least `minVials`, for `validDays` after
     * the email. The email states the end date, so checkout enforces it.
     */
    bonus: { extraVials: 2, minVials: 10, validDays: 7 },
  },
} as const;

/**
 * Product photography. Empty array falls back to the neutral placeholder.
 * Shot list lives in LAUNCH-CHECKLIST.md.
 */
export const PRODUCT_IMAGES: readonly {
  src: string;
  alt: string;
  width: number;
  height: number;
}[] = [
  {
    src: "/static-water.png",
    alt: `A sealed ${PRODUCT.size} of ${PRODUCT.name.toLowerCase()} with a crimped aluminium collar and white flip cap, ${VIAL_ML}ml.`,
    /** Intrinsic pixel size, so the layout reserves the right box before the file loads. */
    width: 1122,
    height: 1402,
  },
];
