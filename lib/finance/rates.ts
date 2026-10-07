/**
 * What the shop pays to send an order out, by date, for /admin/finance.
 *
 * Every price has the day it took effect, so typing in a new one never
 * rewrites the days before it: a cost is priced by the latest rate taking
 * effect on or before its day. Rows live in CostRate and are typed in on
 * /admin/finance/costs. Nothing here touches the database, so the rules can
 * be tested on their own (scripts/test-finance.ts).
 */

export type CostKind = "fulfilment" | "postage";

export interface Rate {
  kind: string;
  /** postage: the SmartTrack service code. "" for fulfilment. */
  key: string;
  amountMinor: number;
  /** A UK day, "2026-10-01". */
  effectiveFrom: string;
}

/** effectiveFrom for a price that has always applied. */
export const FROM_THE_START = "1970-01-01";

/**
 * The fulfilment company's charge per package until a rate is typed in: £1.
 * Postage has no default — a missing price is shown as missing, not guessed.
 */
export const DEFAULT_FULFILMENT_MINOR = 100;

/** The UK standard rate, which everything the shop sells is assumed to carry. */
export const VAT_RATE_PERCENT = 20;

/** The price in force on `day`, or null when no rate had taken effect by then. */
export function rateOn(rates: readonly Rate[], kind: CostKind, key: string, day: string): number | null {
  let best: Rate | null = null;
  for (const r of rates) {
    if (r.kind !== kind || r.key !== key || r.effectiveFrom > day) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best ? best.amountMinor : null;
}

/** The fulfilment charge per package on `day`. */
export function fulfilmentRateOn(rates: readonly Rate[], day: string): number {
  return rateOn(rates, "fulfilment", "", day) ?? DEFAULT_FULFILMENT_MINOR;
}

/** Whether a sale on `day` carries VAT. `registeredFrom` "" or null = not registered. */
export function vatApplies(registeredFrom: string | null, day: string): boolean {
  return !!registeredFrom && day >= registeredFrom;
}

/** The VAT inside a VAT-inclusive amount: a sixth at 20%, to the nearest penny. */
export function vatInside(grossMinor: number): number {
  return Math.round((grossMinor * VAT_RATE_PERCENT) / (100 + VAT_RATE_PERCENT));
}

/** Pence from what an admin typed: "1", "£1.20", "3.9". Null when it is not a price. */
export function parsePounds(raw: string): number | null {
  const v = raw.trim().replace(/^£/, "").replace(/,/g, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}
