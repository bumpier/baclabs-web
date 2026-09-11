import {
  BUNDLES,
  DELIVERY,
  MAX_QUANTITY,
  PRODUCT,
  VIAL_ML,
  deliveryMinorFor,
  drawsPerVial,
  perMlMinor,
  perVialMinor,
  savingMinor,
  savingPercent,
  shipsFree,
  singlesPriceMinor,
  formatMinor,
  formatMinorShort,
  type Bundle,
} from "@/config/funnel";
import { FACTS } from "@/content/facts";

/**
 * The figures a pack page prints, derived from one bundle.
 *
 * This file exists so that eight pages cannot disagree about arithmetic. A
 * pack page renders `metricsFor(bundle)` and nothing else: there is no route
 * by which a page can state a per-vial price that the ladder table on the
 * next page contradicts.
 *
 * Everything is integer pence in, integer pence out. `formatMinor` from
 * config/funnel.ts is the only thing that turns pence into a £ string.
 */
export interface PackMetrics {
  bundle: Bundle;
  /** Vials in the pack. */
  vials: number;
  /** Total fill volume across the pack, in millilitres. */
  totalMl: number;
  /** Charged price for one pack, in pence. */
  priceMinor: number;
  /** Price of one vial within this pack, in pence. */
  perVialMinor: number;
  /** Price per millilitre, in pence. Sub-penny; format to 2dp for display. */
  perMlMinor: number;
  /** What the same vials cost bought one at a time, in pence. */
  singlesPriceMinor: number;
  /** Saving against buying singly, in pence. 0 for the single tier. */
  savingMinor: number;
  /** The same saving as a whole percent. */
  savingPercent: number;
  /** Draws from the whole pack at 1ml and at 2ml. */
  drawsAt1ml: number;
  drawsAt2ml: number;
  /** Delivery charged on a one-pack order, in pence. 0 when it ships free. */
  deliveryMinor: number;
  shipsFree: boolean;
  /** 1-based position in the ascending ladder, and the ladder's length. */
  rank: number;
  tierCount: number;
  /** True when no tier costs less per vial than this one. */
  isCheapestPerVial: boolean;
  /** Most vials one order of this pack can hold, at the quantity ceiling. */
  maxOrderVials: number;
}

/** The tier with the lowest per-vial price. Ties resolve to the smaller pack. */
export function cheapestPerVialBundle(): Bundle {
  return BUNDLES.reduce((best, b) =>
    perVialMinor(b) < perVialMinor(best) ? b : best
  );
}

/** Bundles in ascending vial order — the order every ladder table renders in. */
export function laddered(): Bundle[] {
  return [...BUNDLES].sort((a, b) => a.vials - b.vials);
}

export function metricsFor(bundle: Bundle): PackMetrics {
  const ladder = laddered();
  const cheapest = cheapestPerVialBundle();
  const totalMl = bundle.vials * VIAL_ML;

  return {
    bundle,
    vials: bundle.vials,
    totalMl,
    priceMinor: bundle.priceMinor,
    perVialMinor: perVialMinor(bundle),
    perMlMinor: perMlMinor(bundle),
    singlesPriceMinor: singlesPriceMinor(bundle),
    savingMinor: savingMinor(bundle),
    savingPercent: savingPercent(bundle),
    // Draws across the WHOLE pack, not one vial — the pack is what is being
    // bought, so the pack is the unit the figure should be in.
    drawsAt1ml: drawsPerVial(1) * bundle.vials,
    drawsAt2ml: drawsPerVial(2) * bundle.vials,
    deliveryMinor: deliveryMinorFor(bundle.priceMinor),
    shipsFree: shipsFree(bundle.priceMinor),
    rank: ladder.findIndex((b) => b.id === bundle.id) + 1,
    tierCount: ladder.length,
    isCheapestPerVial: perVialMinor(bundle) <= perVialMinor(cheapest),
    maxOrderVials: bundle.vials * MAX_QUANTITY,
  };
}

/**
 * Tiers that beat this one on per-vial price, cheapest first.
 *
 * Several pack pages promise in their copy to say so when a larger pack is
 * better value — notably the 8-vial page, which is dearer per vial than four
 * tiers above it. This is what lets that promise be kept by arithmetic rather
 * than by an author remembering to update prose after a re-price.
 */
export function cheaperPerVialThan(bundle: Bundle): Bundle[] {
  return BUNDLES.filter((b) => perVialMinor(b) < perVialMinor(bundle)).sort(
    (a, b) => perVialMinor(a) - perVialMinor(b)
  );
}

/**
 * The SMALLEST pack that costs less per vial than this one, or null if none
 * does.
 *
 * Deliberately not "the cheapest pack per vial". For the 8-vial tier the
 * absolute cheapest is the 100-vial case, and answering "you want eight
 * vials, buy a hundred" is not advice — it is an upsell wearing advice's
 * clothes. The nearest tier that genuinely beats this one on unit price is
 * the recommendation a buyer can actually act on.
 */
export function nextBetterValue(bundle: Bundle): Bundle | null {
  const cheaper = cheaperPerVialThan(bundle);
  if (cheaper.length === 0) return null;
  return cheaper.reduce((smallest, b) => (b.vials < smallest.vials ? b : smallest));
}

/** Price per millilitre as a string, e.g. "5.99p". Sub-penny, so not formatMinor. */
export function formatPerMl(minorPerMl: number): string {
  return `${minorPerMl.toFixed(2)}p`;
}

/** "10 × 10ml vial" — the pack said the way the packing slip says it. */
export function packLabel(bundle: Bundle): string {
  return `${bundle.vials} × ${PRODUCT.size}`;
}

/**
 * Fills the braced tokens in a pack FAQ answer from this pack's own figures.
 *
 * The registry writes "{price} for {vials} vials" rather than "£274.99 for
 * 100 vials", so a re-price moves every answer with it. That is the same rule
 * the rest of the site follows — no figure is typed where it is displayed —
 * applied to prose that needs to read like a sentence.
 *
 * An UNKNOWN token is left in place, braces and all. Emptying it silently
 * would turn "up to {maxPaks} packs" into "up to  packs" and ship; leaving it
 * visible makes the typo obvious the first time the page is looked at.
 */
export function fillTokens(text: string, m: PackMetrics): string {
  const values: Record<string, string> = {
    vials: String(m.vials),
    vialWord: m.vials === 1 ? "vial" : "vials",
    // BARE NUMBERS, like {vials}. A token that carried its own unit produced
    // "200mlml" on every pack page, because the copy sensibly writes
    // "{totalMl}ml". The unit belongs to the sentence, not to the value.
    totalMl: String(m.totalMl),
    price: formatMinor(m.priceMinor),
    perVial: formatMinor(m.perVialMinor),
    perMl: formatPerMl(m.perMlMinor),
    singlesPrice: formatMinor(m.singlesPriceMinor),
    singleUnit: formatMinor(PRODUCT.unitPriceMinor),
    saving: `${formatMinor(m.savingMinor)} (${m.savingPercent}%)`,
    drawsAt1ml: String(m.drawsAt1ml),
    drawsAt2ml: String(m.drawsAt2ml),
    maxPacks: String(MAX_QUANTITY),
    maxOrderVials: String(m.maxOrderVials),
    openedLimit: FACTS.openedLimit.toLowerCase(),
    freeFrom:
      DELIVERY.freeFromMinor !== null
        ? formatMinorShort(DELIVERY.freeFromMinor)
        : "the published threshold",
  };

  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? values[key] : whole
  );
}
