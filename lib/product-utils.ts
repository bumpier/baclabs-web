import type { Product } from "@prisma/client";

/**
 * There is one product and one price, so the variant machinery this file used
 * to carry is gone. Bundle tiers are a pricing construct in config/funnel.ts,
 * not database rows.
 */

export function priceGbpFor(product: Pick<Product, "priceGbp">): string {
  return product.priceGbp.toString();
}

export function parseImages(product: Pick<Product, "images"> | { images: string }): string[] {
  try {
    const arr = JSON.parse(product.images);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
