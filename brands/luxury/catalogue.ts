/**
 * Reserve No.10's catalogue: few choices, a signature box, next-day delivery
 * included on every order, and never a promotion code.
 *
 * Prices are illustrative until confirmed. TODO(confirm) every figure
 * marked so before launch. Per-vial price falls as the pack grows
 * (scripts/test-brand-checkout.ts holds every catalogue to that).
 */
import { deliveryOptionById } from "@/config/funnel";
import type { BrandCatalogue } from "../types";

const NEXT_DAY = deliveryOptionById("next_day")!;

export const luxuryCatalogue: BrandCatalogue = {
  parentSku: "LUX-10ML",
  // TODO(confirm): the signature box's SKU and its packed weight (scripts/seed-brand-skus.ts).
  boxSku: "LUX-BOX",
  packs: [
    // TODO(confirm): all four prices.
    { id: "x1", sku: "LUX-10ML-X1", vials: 1, priceMinor: 799, label: "Single", available: true },
    { id: "x3", sku: "LUX-10ML-X3", vials: 3, priceMinor: 2199, label: "Trio", available: true },
    { id: "x6", sku: "LUX-10ML-X6", vials: 6, priceMinor: 3999, label: "Six", available: true },
    { id: "x12", sku: "LUX-10ML-X12", vials: 12, priceMinor: 7499, label: "Twelve", available: true },
  ],
  addOns: [],
  delivery: {
    // Next day on every order at no charge: the markup carries Amazon's £5.
    // freeFromMinor 0 means every order is "over the threshold", so the one
    // option is always free. The same "next_day" id as BacLab's, so the
    // label buyer sends it by the services linked to next day.
    options: [{ ...NEXT_DAY, priceMinor: 0, overThreshold: "free" }],
    freeFromMinor: 0,
  },
  maxVials: 100,
  // Never: the brand does not discount (Phase 4 of the plan).
  allowPromotionCodes: false,
  collectBusinessDetails: false,
};
