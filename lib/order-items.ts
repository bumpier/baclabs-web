import { LAB_KIT, PRODUCT, SINGLE_BUNDLE, type Bundle, type PricedOrder } from "@/config/funnel";

/**
 * The paid lines of a one-off order (Order.items): the packs, then any loose
 * vials as a line of their own, then any Lab Kits. Pure, so
 * scripts/test-order-pricing.ts can hold every reader of Order.items to an
 * order with all three.
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
  /** Vials; on the kit line, kits (isKitLine). */
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
  /**
   * Lab Kits (config/funnel.ts LAB_KIT): its own Product row, so legacy stock
   * counts kits, and never vials. Every reader that counts vials skips it.
   */
  kit?: true;
  /**
   * Another brand's lines only (buildBrandOrderItems): the code its
   * catalogue sold the line under. On a pack it is also the warehouse kit
   * the pack is made up as (lib/inventory/demand.ts soldLines); every line
   * gives it to Meta as the content id (lib/meta-capi-event.ts). BacLab's
   * lines never carry one: theirs is found from bundleId, as always.
   */
  sku?: string;
}

/** The name the loose-vial line carries on the slip, the receipt and the admin. */
export const EXTRA_VIAL_LINE_NAME = `Extra ${PRODUCT.size}`;

const pounds = (minor: number) => (minor / 100).toFixed(2);

/**
 * Each part's share of `total` (USD, as a number) by its share of the pounds.
 * The last part with any pounds takes the remainder, so the shares sum to
 * `total` exactly.
 */
function splitUsd(total: number, partsMinor: number[]): number[] {
  const goodsMinor = partsMinor.reduce((n, p) => n + p, 0);
  const last = partsMinor.reduce((at, p, i) => (p > 0 ? i : at), 0);
  const shares = partsMinor.map((p, i) =>
    i === last || goodsMinor === 0 ? 0 : Number(((total * p) / goodsMinor).toFixed(2))
  );
  shares[last] = Number((total - shares.reduce((n, s) => n + s, 0)).toFixed(2));
  return shares;
}

export function buildOrderItems(input: {
  productId: string;
  slug: string;
  bundle: Bundle;
  quantity: number;
  priced: PricedOrder;
  /** USD basis of the whole order's goods (subtotalUsd), as a decimal string. */
  goodsUsd: string;
  /** The Lab Kit's Product row. Required when the order has kits. */
  kitProductId?: string;
}): OrderLine[] {
  const { productId, slug, bundle, quantity, priced } = input;
  const [packsUsd, extrasUsd, kitsUsd] = splitUsd(Number(input.goodsUsd), [
    priced.packsMinor,
    priced.extrasMinor,
    priced.kitsMinor,
  ]) as [number, number, number];

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

  if (priced.kits > 0) {
    if (!input.kitProductId) throw new Error("An order with Lab Kits needs the kit's Product row");
    lines.push({
      productId: input.kitProductId,
      slug: LAB_KIT.sku,
      name: LAB_KIT.name,
      qty: priced.kits,
      unitPrice: pounds(priced.kitUnitMinor),
      unitPriceUsd: (kitsUsd / priced.kits).toFixed(2),
      lineTotal: pounds(priced.kitsMinor),
      lineTotalUsd: kitsUsd.toFixed(2),
      // The SKU, not a BundleId: Meta's content id and the warehouse code
      // both read it, and bundleById() rightly finds no pack by that name.
      bundleId: LAB_KIT.sku,
      bundleName: LAB_KIT.name,
      bundleQty: priced.kits,
      kit: true,
    });
  }
  return lines;
}

/**
 * One priced line of another brand's order (lib/commerce/pricing.ts):
 * `quantity` packs of `vials` each, or `quantity` add-ons.
 */
export type BrandPricedLine =
  | { kind: "pack"; sku: string; vials: number; quantity: number; unitMinor: number; lineMinor: number }
  | { kind: "addOn"; sku: string; name: string; ships: "lab-kit"; quantity: number; unitMinor: number; lineMinor: number };

/**
 * The paid lines of another brand's order, in exactly the shape
 * buildOrderItems writes, so every reader of Order.items works unchanged:
 *
 *  - a pack is a line of the SHARED vial's Product row, qty in vials, priced
 *    by the pack. Legacy stock takes the vials off that row, vial stock and
 *    finance count them, the packing slip prints its neutral name. Its
 *    bundleId is its SKU, never one of BacLab's BundleIds, so nothing that
 *    looks packs up in config/funnel.ts (plan upgrades, BacLab's reorder
 *    offer, its pack names) mistakes it for one of BacLab's;
 *  - the Lab Kit add-on is BacLab's kit line: the kit's Product row, `kit`,
 *    the parts on the slip, the kit SKU in the warehouse. Only its bundleId
 *    and sku are the brand's own code.
 *
 * Every line records its `sku`. Pure, like buildOrderItems.
 */
export function buildBrandOrderItems(input: {
  /** The shared vial's Product row, which every brand's packs sell from. */
  vial: { productId: string; slug: string };
  /** The Lab Kit's Product row. Required when a line ships as the kit. */
  kitProductId?: string;
  lines: readonly BrandPricedLine[];
  /** USD basis of the whole order's goods (subtotalUsd), as a decimal string. */
  goodsUsd: string;
}): OrderLine[] {
  const usd = splitUsd(
    Number(input.goodsUsd),
    input.lines.map((l) => l.lineMinor)
  );
  return input.lines.map((line, i): OrderLine => {
    const lineUsd = usd[i] ?? 0;
    const money = {
      unitPrice: pounds(line.unitMinor),
      unitPriceUsd: (lineUsd / line.quantity).toFixed(2),
      lineTotal: pounds(line.lineMinor),
      lineTotalUsd: lineUsd.toFixed(2),
    };
    if (line.kind === "pack") {
      return {
        productId: input.vial.productId,
        slug: input.vial.slug,
        name: `${PRODUCT.name} ${PRODUCT.size}`,
        qty: line.vials * line.quantity,
        ...money,
        bundleId: line.sku,
        bundleName: `${line.vials}-vial pack`,
        bundleQty: line.quantity,
        sku: line.sku,
      };
    }
    if (!input.kitProductId) throw new Error("An order with Lab Kits needs the kit's Product row");
    return {
      productId: input.kitProductId,
      slug: LAB_KIT.sku,
      name: line.name,
      qty: line.quantity,
      ...money,
      bundleId: line.sku,
      bundleName: line.name,
      bundleQty: line.quantity,
      kit: true,
      sku: line.sku,
    };
  });
}

export function isAddOnLine(item: object): boolean {
  return (item as { addOn?: unknown }).addOn === true;
}

/** A Lab Kit line: its qty is kits, so never count it as vials. */
export function isKitLine(item: unknown): boolean {
  return typeof item === "object" && item !== null && (item as { kit?: unknown }).kit === true;
}

/**
 * What the packer puts in the box for `kits` Lab Kits: each part multiplied
 * out ("10 kits" → 30 syringes, …), in LAB_KIT's order.
 */
export function kitPartsFor(kits: number): { name: string; sku: string; quantity: number }[] {
  return LAB_KIT.parts.map((p) => ({ name: p.name, sku: p.sku, quantity: p.perKit * kits }));
}
