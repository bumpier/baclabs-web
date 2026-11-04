/**
 * A link that opens a brand's storefront with a basket already filled: the
 * reorder button in its emails points here (lib/reorder.ts), and the
 * storefront reads it back with parseBuyParam. BacLab's own links are
 * lib/pack-link.ts and never this.
 *
 *   /?buy=LUX-10ML-X3:2,LUX-10ML-X1:1
 *
 * Site-relative; the email puts the brand's origin in front. Imports
 * nothing, so a client component may use it.
 */

export const BUY_PARAM = "buy";

/** Lines in a link: never more than the checkout takes (lib/commerce/pricing.ts). */
const MAX_LINES = 10;
const MAX_QTY = 10;

export function brandBuyLink(lines: readonly { sku: string; qty: number }[]): string {
  return `/?${BUY_PARAM}=${lines.map((l) => `${l.sku}:${l.qty}`).join(",")}`;
}

/**
 * The basket a `buy` value names, or [] when it names none. Malformed parts
 * are dropped rather than failing the whole link; whatever is left is still
 * only a suggestion, priced and checked again by the checkout.
 */
export function parseBuyParam(value: string | null | undefined): { sku: string; qty: number }[] {
  if (!value) return [];
  const out: { sku: string; qty: number }[] = [];
  for (const part of value.split(",").slice(0, MAX_LINES)) {
    const m = part.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]{0,39}):(\d{1,2})$/);
    if (!m) continue;
    const qty = Number(m[2]);
    if (qty >= 1 && qty <= MAX_QTY) out.push({ sku: m[1]!.toUpperCase(), qty });
  }
  return out;
}
