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
  // 0.9% is w/v (9 mg/mL), the USP basis — NOT by volume. The two differ
  // (benzyl alcohol is ~1.044 g/mL, so 0.9% w/v is ~0.86% v/v), and the page
  // previously said "by volume". State the basis wherever the figure appears.
  composition:
    "Sterile water with 0.9% w/v benzyl alcohol (9 mg/mL) as a bacteriostatic preservative, in a sealed multi-dose vial.",
  use: "A sterile diluent and solvent, used to reconstitute or dilute substances for laboratory and research purposes.",
  // Empty strings render nothing.
  storage: "",
  shelfLifeUnopened: "",
  // Confirmed from the supplier's label. Rendered as a spec row and answered
  // in config/faq.ts; both go silent again if this is ever cleared.
  shelfLifeAfterOpening: "28 days from first puncture",
  origin: "",
} as const;

// ── Bundle tiers ──────────────────────────────────────────────────
// `quantity` on the checkout route means "how many of THIS bundle", not
// how many vials. Buying 2 × five = 10 vials.
export type BundleId = "single" | "five" | "seven" | "eight" | "ten" | "twenty" | "fifty" | "hundred";

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
  { id: "seven", vials: 7, priceMinor: 2589, label: "", sku: "baclab-10ml-x7" },
  { id: "eight", vials: 8, priceMinor: 2949, label: "Best value", sku: "baclab-10ml-x8" },
  { id: "ten", vials: 10, priceMinor: 3499, label: "Stock up", sku: "baclab-10ml-x10" },
  { id: "twenty", vials: 20, priceMinor: 6499, label: "", sku: "baclab-10ml-x20" },
  { id: "fifty", vials: 50, priceMinor: 14999, label: "", sku: "baclab-10ml-x50" },
  { id: "hundred", vials: 100, priceMinor: 27499, label: "Wholesale", sku: "baclab-10ml-x100" },
] as const;

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

/** "30% off" — derived, so the badge can never contradict the figures. */
export function saleLabel(): string {
  return `${SALE.percentOff}% off`;
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
  seven: "STRIPE_PRICE_SEVEN",
  eight: "STRIPE_PRICE_EIGHT",
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
} = {
  mode: "threshold",
  priceMinor: 200,
  freeFromMinor: 3000,
  note: "Free UK delivery on orders of £30 or more.",
  dispatchLine: "",
};

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

/** Delivery charge in pence for an order of this value. 0 when it ships free. */
export function deliveryMinorFor(orderValueMinor: number): number {
  if (DELIVERY.mode === "unknown") return 0;
  if (shipsFree(orderValueMinor)) return 0;
  return DELIVERY.priceMinor ?? 0;
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

/** Guarantee / risk-reversal block. Empty body renders nothing at all. */
export const GUARANTEE: { title: string; body: string } = {
  title: "",
  body: "",
};

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
 * Product photography. Empty array falls back to the neutral placeholder.
 * Shot list lives in LAUNCH-CHECKLIST.md.
 */
export const PRODUCT_IMAGES: readonly { src: string; alt: string }[] = [
  {
    src: "/product-vial.jpg",
    alt: `A sealed ${PRODUCT.name.toLowerCase()} vial with a crimped aluminium collar and red flip cap, standing on a marble surface.`,
  },
];
