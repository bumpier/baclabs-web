export { priceGbpFor, parseImages } from "@/lib/product-utils";

/**
 * The storefront is GBP-only, so there is no currency preference to resolve
 * and no cookie to read. USD exists solely as the crypto settlement currency
 * (see config/brand.ts) and is never presented to a shopper.
 */
export const STORE_CURRENCY = "GBP" as const;
