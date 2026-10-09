import { PRODUCT, SINGLE_BUNDLE, type Bundle, type PricedOrder } from "@/config/funnel";

/**
 * The paid lines of a one-off order (Order.items): the packs, then any loose
 * vials as a line of their own. Pure, so scripts/test-order-pricing.ts can
 * hold every reader of Order.items to an order with both.
 *
 * Bundle prices do NOT divide evenly into whole pence per vial (2199/5 =
 * 439.8p), so a pack line prices by the BUNDLE, not the vial: unitPrice ×
 * bundleQty reconciles exactly to the amount charged. `qty` (vials) stays
 * separate: it is what fulfilment packs, not what is priced. `lineTotal` is
 * stored rather than re-derived, so every reader (admin, confirmation page,
 * emails) reconciles even though unitPrice × qty does not.
 */

export interface OrderLine {
  productId: string;
  slug: string;
  name: string;
  /** Vials. */
  qty: number;
  /** Per BUNDLE, not per vial: see above. */
  unitPrice: string;
  unitPriceUsd: string;
  lineTotal: string;
  lineTotalUsd: string;
  bundleId: string;
  bundleName: string;
  bundleQty: number;
  /** Loose vials added to the packs: the restock nudge and finance tell them apart. */
  addOn?: true;
}

/** The name the loose-vial line carries on the slip, the receipt and the admin. */
export const EXTRA_VIAL_LINE_NAME = `Extra ${PRODUCT.size}`;

const pounds = (minor: number) => (minor / 100).toFixed(2);

export function buildOrderItems(input: {
  productId: string;
  slug: string;
  bundle: Bundle;
  quantity: number;
  priced: PricedOrder;
  /** USD basis of the whole order's goods (subtotalUsd), as a decimal string. */
  goodsUsd: string;
}): OrderLine[] {
  const { productId, slug, bundle, quantity, priced } = input;
  const goodsUsd = Number(input.goodsUsd);
  // The pack line's share of the USD basis by its share of the pounds; the
  // loose vials take the remainder, so the two lines sum to goodsUsd exactly.
  const packsUsd =
    priced.extrasMinor === 0 ? goodsUsd : Number(((goodsUsd * priced.packsMinor) / priced.goodsMinor).toFixed(2));
  const extrasUsd = Number((goodsUsd - packsUsd).toFixed(2));

  const lines: OrderLine[] = [
    {
      productId,
      slug,
      name: `${PRODUCT.name} ${PRODUCT.size}`,
      qty: bundle.vials * quantity,
      unitPrice: pounds(bundle.priceMinor),
      unitPriceUsd: (packsUsd / quantity).toFixed(2),
      lineTotal: pounds(priced.packsMinor),
      lineTotalUsd: packsUsd.toFixed(2),
      // Kept so the admin and the packing slip can show what was actually
      // bought, rather than an undifferentiated vial count.
      bundleId: bundle.id,
      bundleName: `${bundle.vials}-vial pack`,
      bundleQty: quantity,
    },
  ];

  if (priced.extraVials > 0) {
    lines.push({
      productId,
      slug,
      name: EXTRA_VIAL_LINE_NAME,
      qty: priced.extraVials,
      unitPrice: pounds(SINGLE_BUNDLE.priceMinor),
      unitPriceUsd: (extrasUsd / priced.extraVials).toFixed(2),
      lineTotal: pounds(priced.extrasMinor),
      lineTotalUsd: extrasUsd.toFixed(2),
      bundleId: SINGLE_BUNDLE.id,
      bundleName: "single vial",
      bundleQty: priced.extraVials,
      addOn: true,
    });
  }
  return lines;
}

export function isAddOnLine(item: object): boolean {
  return (item as { addOn?: unknown }).addOn === true;
}
