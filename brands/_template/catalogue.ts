/**
 * Template Brand's catalogue: four packs, delivery as BacLab's own options
 * and threshold, by the same ids (the label buyer knows which services
 * fulfil each one only by those ids), and never a promotion code.
 *
 * Prices are illustrative until confirmed. TODO(confirm) every figure
 * marked so before launch. Per-vial price falls as the pack grows
 * (npm run check:brands holds every catalogue to that).
 */
import { DELIVERY, DELIVERY_OPTIONS } from "@/config/funnel";
import type { BrandCatalogue } from "../types";

export const templateCatalogue: BrandCatalogue = {
  parentSku: "TPL-10ML",
  packs: [
    // TODO(confirm): all four prices.
    { id: "x1", sku: "TPL-10ML-X1", vials: 1, priceMinor: 699, label: "", available: true },
    { id: "x3", sku: "TPL-10ML-X3", vials: 3, priceMinor: 1899, label: "", available: true },
    { id: "x5", sku: "TPL-10ML-X5", vials: 5, priceMinor: 2999, label: "", available: true },
    { id: "x10", sku: "TPL-10ML-X10", vials: 10, priceMinor: 5499, label: "", available: true },
  ],
  addOns: [],
  delivery: { options: DELIVERY_OPTIONS, freeFromMinor: DELIVERY.freeFromMinor },
  maxVials: 100,
  allowPromotionCodes: false,
  collectBusinessDetails: false,
  collectGiftNote: false,
};
