/**
 * BeautyBac's catalogue: sets of 1, 5, 10 and 20 vials, the same four sizes
 * as the gym and luxury brands sell, on the home page and on the "For
 * clinics" page alike. Delivery is BacLab's own options and threshold, by
 * the same ids.
 *
 * Prices are illustrative until confirmed. TODO(confirm) every figure
 * marked so before launch. Per-vial price falls as the pack grows
 * (scripts/test-brand-checkout.ts holds every catalogue to that).
 */
import { DELIVERY, DELIVERY_OPTIONS } from "@/config/funnel";
import type { BrandCatalogue } from "../types";

export const beautyCatalogue: BrandCatalogue = {
  parentSku: "BEA-10ML",
  // TODO(confirm): the plain white box's SKU and its packed weight (scripts/seed-brand-skus.ts).
  boxSku: "BEA-BOX",
  packs: [
    // TODO(confirm): all four prices.
    { id: "x1", sku: "BEA-10ML-X1", vials: 1, priceMinor: 699, label: "", available: true },
    { id: "x5", sku: "BEA-10ML-X5", vials: 5, priceMinor: 2999, label: "", available: true },
    { id: "x10", sku: "BEA-10ML-X10", vials: 10, priceMinor: 5499, label: "", available: true },
    { id: "x20", sku: "BEA-10ML-X20", vials: 20, priceMinor: 9999, label: "", available: true },
  ],
  addOns: [],
  delivery: { options: DELIVERY_OPTIONS, freeFromMinor: DELIVERY.freeFromMinor },
  maxVials: 100,
  allowPromotionCodes: false,
  collectBusinessDetails: false,
  collectGiftNote: false,
};
