import { formatPrice, type Currency } from "@/config/brand";

/**
 * GBP-based multipliers: 1 GBP = rates[C] units of currency C. GBP is always 1.
 *
 * The storefront is GBP-only. USD exists solely because the crypto gateway
 * settles in USD — it is never shown to a shopper.
 */
export type FxRates = Record<Currency, number>;

// Last-resort rate used only when the FX API is unreachable AND no cached
// rate exists (approx. mid-2026 value). Update occasionally.
export const FALLBACK_GBP_RATES: FxRates = {
  GBP: 1,
  USD: 1.27,
};

/** Convert an authored GBP amount, rounded to 2dp. */
export function convertFromGbp(gbp: number, to: Currency, rates: FxRates): number {
  const raw = gbp * (rates[to] ?? FALLBACK_GBP_RATES[to]);
  return Math.round(raw * 100) / 100;
}

export interface PricedInGbp {
  priceGbp: string;
}

/** Unit price of a product in a given currency, from the authored GBP price. */
export function priceIn(p: PricedInGbp, to: Currency, rates: FxRates): number {
  return convertFromGbp(parseFloat(p.priceGbp), to, rates);
}

/** Resolve a product's price in a currency and format it for display. */
export function displayPrice(p: PricedInGbp, to: Currency, rates: FxRates): string {
  return formatPrice(priceIn(p, to, rates), to);
}
