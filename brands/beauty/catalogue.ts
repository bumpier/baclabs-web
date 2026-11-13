/**
 * BeautyBac's catalogue: sets of 1, 5, 10 and 20 vials, the same four sizes
 * as the gym and luxury brands sell, on the home page and on the "For
 * clinics" page alike. Delivery is BacLab's own options and threshold, by
 * the same ids.
 *
 * The prices are the owner's (confirmed 13 Nov 2026). Per-vial price falls
 * as the pack grows
 * (scripts/test-brand-checkout.ts holds every catalogue to that).
 */
import { DELIVERY, DELIVERY_OPTIONS } from "@/config/funnel";
import type { BrandCatalogue } from "../types";

export const beautyCatalogue: BrandCatalogue = {
  parentSku: "BEA-10ML",
  packs: [
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
