/**
 * BulkBac's catalogue: bulk packs at a tiered per-vial price, open to
 * anyone, with the company name and VAT number asked for with the order.
 * Delivery is BacLab's own options and threshold, by the same ids (every
 * pack here is over the threshold, so next day is free on all of them).
 *
 * 250 vials and up weigh more than the 2 kg the label buyer's services take
 * today, so those packs are listed but not available: quote only, and the
 * checkout refuses them. Make them available once a heavier SmartTrack
 * service (Parcelforce, DPD) is on /admin/shipping, and raise maxVials with
 * them.
 *
 * Prices kept as they stand for launch (the owner, 13 Nov 2026). Per-vial
 * price falls as the pack grows (scripts/test-brand-checkout.ts holds every
 * catalogue to that). The quote-only packs are quoted by email
 * (brands/wholesale/mailbox.ts).
 */
import { DELIVERY, DELIVERY_OPTIONS } from "@/config/funnel";
import type { BrandCatalogue } from "../types";

export const wholesaleCatalogue: BrandCatalogue = {
  parentSku: "WHL-10ML",
  packs: [
    { id: "x50", sku: "WHL-10ML-X50", vials: 50, priceMinor: 19999, label: "", available: true },
    { id: "x100", sku: "WHL-10ML-X100", vials: 100, priceMinor: 34999, label: "", available: true },
    // Over 2 kg: quoted by email until a heavy service exists (see above).
    { id: "x250", sku: "WHL-10ML-X250", vials: 250, priceMinor: 79999, label: "", available: false },
    { id: "x500", sku: "WHL-10ML-X500", vials: 500, priceMinor: 144999, label: "", available: false },
    { id: "x1000", sku: "WHL-10ML-X1000", vials: 1000, priceMinor: 269999, label: "", available: false },
  ],
  addOns: [],
  delivery: { options: DELIVERY_OPTIONS, freeFromMinor: DELIVERY.freeFromMinor },
  maxVials: 100,
  allowPromotionCodes: false,
  collectBusinessDetails: true,
  collectGiftNote: false,
};
