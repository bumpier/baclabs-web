/**
 * Reserve No.10's catalogue: few choices (1, 5, 10 and 20 vials, the same
 * four sizes as the beauty and gym brands sell), a signature box, next-day
 * delivery included on every order, and never a promotion code.
 *
 * Prices are illustrative until confirmed. TODO(confirm) every figure
 * marked so before launch. Per-vial price falls as the pack grows
 * (scripts/test-brand-checkout.ts holds every catalogue to that).
 */
import { deliveryOptionById } from "@/config/funnel";
import type { BrandCatalogue } from "../types";
import { PLAIN_BOX_SKU } from "../packaging";

const NEXT_DAY = deliveryOptionById("next_day")!;

export const luxuryCatalogue: BrandCatalogue = {
  parentSku: "LUX-10ML",
  // TODO(confirm): the signature box's SKU and its packed weight (scripts/seed-brand-skus.ts).
  boxSku: PLAIN_BOX_SKU,
  packs: [
    // TODO(confirm): all four prices.
    { id: "x1", sku: "LUX-10ML-X1", vials: 1, priceMinor: 799, label: "Single", available: true },
    { id: "x5", sku: "LUX-10ML-X5", vials: 5, priceMinor: 3499, label: "Five", available: true },
    { id: "x10", sku: "LUX-10ML-X10", vials: 10, priceMinor: 6499, label: "Ten", available: true },
    { id: "x20", sku: "LUX-10ML-X20", vials: 20, priceMinor: 11999, label: "Twenty", available: true },
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
  // The plan's "gift option and note": printed on the packing slip, packed in the box.
  collectGiftNote: true,
};
