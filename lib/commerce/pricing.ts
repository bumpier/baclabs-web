/**
 * Pricing a brand order: the lines the storefront sends (SKU and count,
 * never a price) against the brand's catalogue. THE pricing the brand
 * checkout charges and the tests hold to; pure, so nothing about a request
 * can reach the amount except through here.
 *
 * BacLab's orders are priced by config/funnel.ts priceOrder and never come
 * this way.
 */
import type { BrandCatalogue } from "@/brands/types";
import type { BrandPricedLine } from "@/lib/order-items";
import { catalogueItem } from "@/lib/commerce/catalogue";

/** Different SKUs one order may carry. More is a malformed request, not a basket. */
export const MAX_BRAND_LINES = 10;
/** Packs (or add-ons) of one SKU per order, as BacLab's MAX_QUANTITY. */
export const MAX_LINE_QTY = 10;

export interface BrandRequestLine {
  sku: string;
  qty: number;
}

export interface PricedBrandOrder {
  /** Packs first, in the catalogue's order, then add-ons. */
  lines: BrandPricedLine[];
  /** Everything but delivery, in pence: what the order records and the threshold reads. */
  goodsMinor: number;
  /** Vials across every pack. */
  vials: number;
  /** Add-ons that ship as the Lab Kit. */
  kits: number;
}

export type BrandPricing = { ok: true; order: PricedBrandOrder } | { ok: false; error: string };

const INVALID = "Invalid order details";

/**
 * Price `lines` from `catalogue`, or say why the order cannot be sold:
 *  - a SKU the catalogue does not list, or a count that is not 1 to
 *    MAX_LINE_QTY, is a malformed request ("Invalid order details");
 *  - a pack or add-on listed but not available (quote-only packs, a
 *    withdrawn add-on, the Lab Kit while it is switched off) is refused by
 *    name, so the storefront can say so;
 *  - more vials than the catalogue's maxVials is refused, as is an order of
 *    add-ons alone, or more Lab Kits than vials (a kit is the kit for one
 *    vial, as on BacLab).
 * The same SKU twice is one line of the combined count.
 */
export function priceBrandLines(
  catalogue: BrandCatalogue,
  lines: readonly BrandRequestLine[],
  opts: { labKitOnSale: boolean }
): BrandPricing {
  if (lines.length === 0 || lines.length > MAX_BRAND_LINES) return { ok: false, error: INVALID };

  // Merge repeats by catalogue item, so "two lines of the 3-pack" and "one
  // line of two" are the same order and meet the same limits.
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty < 1) return { ok: false, error: INVALID };
    const item = catalogueItem(catalogue, line.sku);
    if (!item) return { ok: false, error: INVALID };
    const sku = item.kind === "pack" ? item.pack.sku : item.addOn.sku;
    counts.set(sku, (counts.get(sku) ?? 0) + line.qty);
  }

  const packs: BrandPricedLine[] = [];
  const addOns: BrandPricedLine[] = [];
  for (const [sku, quantity] of counts) {
    if (quantity > MAX_LINE_QTY) return { ok: false, error: INVALID };
    const item = catalogueItem(catalogue, sku)!;
    if (item.kind === "pack") {
      const { pack } = item;
      if (!pack.available) return { ok: false, error: "That pack can't be ordered online." };
      packs.push({
        kind: "pack",
        sku: pack.sku,
        vials: pack.vials,
        quantity,
        unitMinor: pack.priceMinor,
        lineMinor: pack.priceMinor * quantity,
      });
    } else {
      const { addOn } = item;
      if (!addOn.available || (addOn.ships === "lab-kit" && !opts.labKitOnSale)) {
        return { ok: false, error: `${addOn.name} is not available right now.` };
      }
      addOns.push({
        kind: "addOn",
        sku: addOn.sku,
        name: addOn.name,
        ships: addOn.ships,
        quantity,
        unitMinor: addOn.priceMinor,
        lineMinor: addOn.priceMinor * quantity,
      });
    }
  }

  const vials = packs.reduce((n, l) => n + (l.kind === "pack" ? l.vials * l.quantity : 0), 0);
  const kits = addOns.reduce((n, l) => n + (l.kind === "addOn" && l.ships === "lab-kit" ? l.quantity : 0), 0);
  if (vials === 0) return { ok: false, error: INVALID };
  if (vials > catalogue.maxVials) {
    return { ok: false, error: `One order can hold up to ${catalogue.maxVials} vials. For more, please contact us.` };
  }
  if (kits > vials) return { ok: false, error: INVALID };

  // Packs in the catalogue's own order, so the order record, Stripe's page
  // and the receipt list them the way the storefront does.
  const rank = (sku: string) => catalogue.packs.findIndex((p) => p.sku === sku);
  packs.sort((a, b) => rank(a.sku) - rank(b.sku));
  const priced = [...packs, ...addOns];
  return {
    ok: true,
    order: { lines: priced, goodsMinor: priced.reduce((n, l) => n + l.lineMinor, 0), vials, kits },
  };
}
