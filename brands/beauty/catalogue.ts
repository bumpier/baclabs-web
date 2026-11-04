/**
 * Aurelle's catalogue: the consumer sets (1, 3 and 5 vials) and, for the
 * "For clinics" page, the larger clinic packs. Delivery is BacLab's own
 * options and threshold, by the same ids.
 *
 * Prices are illustrative until confirmed. TODO(confirm) every figure
 * marked so before launch. Per-vial price falls as the pack grows
 * (scripts/test-brand-checkout.ts holds every catalogue to that).
 */
import { DELIVERY, DELIVERY_OPTIONS } from "@/config/funnel";
import type { BrandCatalogue } from "../types";

export const beautyCatalogue: BrandCatalogue = {
  parentSku: "BEA-10ML",
  // TODO(confirm): the gift-ready pouch's SKU and its packed weight (scripts/seed-brand-skus.ts).
  boxSku: "BEA-BOX",
  packs: [
    // TODO(confirm): all six prices.
    { id: "x1", sku: "BEA-10ML-X1", vials: 1, priceMinor: 699, label: "", available: true },
    { id: "x3", sku: "BEA-10ML-X3", vials: 3, priceMinor: 1899, label: "", available: true },
    { id: "x5", sku: "BEA-10ML-X5", vials: 5, priceMinor: 2999, label: "", available: true },
    // The clinic packs.
    { id: "x25", sku: "BEA-10ML-X25", vials: 25, priceMinor: 12499, label: "For clinics", available: true },
    { id: "x50", sku: "BEA-10ML-X50", vials: 50, priceMinor: 22999, label: "For clinics", available: true },
    { id: "x100", sku: "BEA-10ML-X100", vials: 100, priceMinor: 42999, label: "For clinics", available: true },
  ],
  addOns: [],
  delivery: { options: DELIVERY_OPTIONS, freeFromMinor: DELIVERY.freeFromMinor },
  maxVials: 100,
  allowPromotionCodes: false,
  collectBusinessDetails: false,
};
