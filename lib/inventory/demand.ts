import { BUNDLES, bundleById } from "@/config/funnel";
import { normaliseCode } from "@/lib/inventory/codes";

/**
 * The storefront sells bundles; the warehouse ships SKUs. This is the one
 * place that translates between them.
 *
 * Each bundle in config/funnel.ts already carries a `sku` ("baclab-10ml-x5"),
 * which Stripe, Meta and the product schema have used as its identity since
 * launch. The warehouse SKU is that same string, upper-cased — so there is no
 * mapping table to keep in step, and a pack's code reads the same in Stripe,
 * in Events Manager and on the shelf.
 */

/** The single vial, the thing on the shelf. Matches the Product row's slug. */
export const VIAL_SKU_CODE = normaliseCode("baclab-10ml");

/** Every code the storefront can sell, in ladder order. */
export function storefrontSkuCodes(): { bundleId: string; code: string; vials: number }[] {
  return BUNDLES.map((b) => ({ bundleId: b.id, code: normaliseCode(b.sku), vials: b.vials }));
}

/** The shape app/api/checkout/route.ts writes into Order.items. */
interface StoredOrderItem {
  slug?: string;
  name?: string;
  qty: number;
  unitPrice?: string;
  lineTotal?: string;
  bundleId?: string;
  bundleQty?: number;
}

export interface SoldLine {
  /** Normalised warehouse SKU code of what was sold. */
  skuCode: string;
  /** Units of THAT SKU — packs for a pack, vials for a vial. */
  quantity: number;
  description: string;
  lineTotalMinor: number;
}

/**
 * What an order sold, as SKU codes. Orders placed before bundles existed
 * recorded vials only; they read as the vial SKU. A bundle since retired from
 * config/funnel.ts (the 7- and 8-packs) still resolves, to the code it was
 * sold under — "BACLAB-10ML-X7" — so an old order never silently becomes a
 * different product.
 */
export function soldLines(itemsJson: string): SoldLine[] {
  const items = JSON.parse(itemsJson) as StoredOrderItem[];
  return items.map((item) => {
    const lineTotalMinor = Math.round(
      parseFloat(item.lineTotal ?? String(parseFloat(item.unitPrice ?? "0") * item.qty)) * 100
    );
    const description = item.name ?? item.slug ?? "";

    if (item.bundleId && item.bundleQty && item.bundleQty > 0) {
      const bundle = bundleById(item.bundleId);
      const vialsPerBundle = item.qty / item.bundleQty;
      const code = bundle ? bundle.sku : `${item.slug ?? "baclab-10ml"}-x${vialsPerBundle}`;
      return {
        skuCode: normaliseCode(code),
        quantity: item.bundleQty,
        description,
        lineTotalMinor,
      };
    }
    return {
      skuCode: item.slug ? normaliseCode(item.slug) : VIAL_SKU_CODE,
      quantity: item.qty,
      description,
      lineTotalMinor,
    };
  });
}
