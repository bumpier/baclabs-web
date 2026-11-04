/**
 * Reading a brand's catalogue (brands/<id>/catalogue.ts): which pack or
 * add-on a SKU is, and what delivery costs on an order of a given value.
 * Pure, so scripts/test-brand-checkout.ts can hold every catalogue to it.
 *
 * BacLab never comes through here. Its packs, its delivery and its switch
 * for the delivery choice are config/funnel.ts, exactly as before brands
 * existed. A brand's checkout always offers its delivery options: there is
 * no "choice switched off" mode to fall back to, because no brand has ever
 * sold without one.
 */
import type { BrandCatalogue, CatalogueAddOn, CataloguePack } from "@/brands/types";
import { VIAL_ML, type DeliveryOption } from "@/config/funnel";
import { normaliseCode } from "@/lib/inventory/codes";

export type CatalogueItem = { kind: "pack"; pack: CataloguePack } | { kind: "addOn"; addOn: CatalogueAddOn };

/**
 * The pack or add-on a SKU names, whether or not it is on sale. Case and
 * surrounding space are ignored, as everywhere a SKU code is read.
 */
export function catalogueItem(catalogue: BrandCatalogue, sku: string): CatalogueItem | null {
  const code = normaliseCode(sku);
  const pack = catalogue.packs.find((p) => p.sku === code);
  if (pack) return { kind: "pack", pack };
  const addOn = catalogue.addOns.find((a) => a.sku === code);
  return addOn ? { kind: "addOn", addOn } : null;
}

export function cataloguePack(catalogue: BrandCatalogue, sku: string): CataloguePack | undefined {
  const item = catalogueItem(catalogue, sku);
  return item?.kind === "pack" ? item.pack : undefined;
}

/** One vial's share of a pack's price, in pence (rounded, for display and checks only). */
export function packPerVialMinor(pack: CataloguePack): number {
  return Math.round(pack.priceMinor / pack.vials);
}

/** "3-vial pack", "single vial": the pack as the order, the slip and finance name it. */
export function packSizeName(vials: number): string {
  return vials === 1 ? "single vial" : `${vials}-vial pack`;
}

/**
 * A line's name on Stripe's page, the receipt Stripe keeps and its reports:
 * neutral, whatever the brand's own voice. Never slang, never marketing
 * copy, never the brand's name. The checkout names inline lines with it and
 * scripts/stripe-setup.ts names the brand's Products with it, so the two
 * read the same.
 */
export function brandLineName(line: { kind: "pack" | "addOn"; vials?: number; name?: string }): string {
  return line.kind === "pack" ? `${VIAL_ML}ml bacteriostatic water × ${line.vials}` : (line.name ?? "");
}

/**
 * A line's persistent Stripe Product: `<stem>_<catalogue id>`, the stem
 * being the brand's STRIPE_PRODUCT__<ID>. Created by
 * `scripts/stripe-setup.ts --brand <id>` with the brand in its metadata, so
 * coupons and reports can be scoped to one brand. One Product per pack
 * rather than one per brand, because a Product's name IS the line's name on
 * Stripe's page: one Product would show a 3-pack and a 12-pack as the same
 * item.
 */
export function brandStripeProductId(stem: string, catalogueId: string): string {
  return `${stem}_${catalogueId}`;
}

/** The stem stripe-setup gives a brand's Products, and prints as STRIPE_PRODUCT__<ID>. */
export function defaultBrandProductStem(brandId: string): string {
  return `brand_${brandId}`;
}

/** Whether goods of this value clear the brand's free-delivery threshold. */
export function catalogueShipsFree(catalogue: BrandCatalogue, goodsMinor: number): boolean {
  const from = catalogue.delivery.freeFromMinor;
  return from !== null && goodsMinor >= from;
}

/**
 * The delivery options offered on an order of this value, each at the price
 * it will be charged, in the catalogue's order: the first is the one
 * Stripe's page preselects. The same rules as config/funnel.ts
 * deliveryOptionsFor, read from the brand's own options and threshold.
 */
export function catalogueDeliveryOptions(
  catalogue: BrandCatalogue,
  goodsMinor: number
): { option: DeliveryOption; priceMinor: number }[] {
  const free = catalogueShipsFree(catalogue, goodsMinor);
  const standard = catalogue.delivery.options.find((o) => o.id === "standard");
  const out: { option: DeliveryOption; priceMinor: number }[] = [];
  for (const option of catalogue.delivery.options) {
    if (!free) out.push({ option, priceMinor: option.priceMinor });
    else if (option.overThreshold === "free") out.push({ option, priceMinor: 0 });
    else if (option.overThreshold === "less-standard") {
      out.push({ option, priceMinor: Math.max(0, option.priceMinor - (standard?.priceMinor ?? 0)) });
    }
  }
  return out;
}
