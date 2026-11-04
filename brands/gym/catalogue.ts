/**
 * Brute Lab's catalogue: the stock-up ladder (5, 10, 20 and 50 vials) and
 * the Lab Kit beside it. Delivery is BacLab's own options and threshold, by
 * the same ids.
 *
 * The Lab Kit is BacLab's kit (config/funnel.ts LAB_KIT): the same parts,
 * the same Product row and the same kit SKU, so the packer counts the same
 * pieces into the box. Only its code here is the brand's own, because the
 * storefront and the brand's Meta dataset both see it.
 *
 * Prices are illustrative until confirmed. TODO(confirm) every figure
 * marked so before launch. Per-vial price falls as the pack grows
 * (scripts/test-brand-checkout.ts holds every catalogue to that).
 */
import { DELIVERY, DELIVERY_OPTIONS, LAB_KIT } from "@/config/funnel";
import type { BrandCatalogue } from "../types";

export const gymCatalogue: BrandCatalogue = {
  parentSku: "GYM-10ML",
  // TODO(confirm): the box's SKU and its packed weight (scripts/seed-brand-skus.ts).
  boxSku: "GYM-BOX",
  packs: [
    // TODO(confirm): all four prices.
    { id: "x5", sku: "GYM-10ML-X5", vials: 5, priceMinor: 2799, label: "", available: true },
    { id: "x10", sku: "GYM-10ML-X10", vials: 10, priceMinor: 4999, label: "", available: true },
    { id: "x20", sku: "GYM-10ML-X20", vials: 20, priceMinor: 8999, label: "", available: true },
    { id: "x50", sku: "GYM-10ML-X50", vials: 50, priceMinor: 19999, label: "", available: true },
  ],
  addOns: [
    // TODO(confirm): one flat price per kit. BacLab prices its kit by pack
    // (£5.99 to £3.99); this ladder starts at five vials, so one price.
    { id: "lab-kit", sku: "GYM-LAB-KIT", name: LAB_KIT.name, priceMinor: 499, available: true, ships: "lab-kit" },
  ],
  delivery: { options: DELIVERY_OPTIONS, freeFromMinor: DELIVERY.freeFromMinor },
  maxVials: 100,
  allowPromotionCodes: false,
  collectBusinessDetails: false,
  collectGiftNote: false,
};
