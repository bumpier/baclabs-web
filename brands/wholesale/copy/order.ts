/**
 * The order label's words (app/wholesale/BuySection.tsx): the panel beside
 * the price list that totals the order as it is set. A client component
 * reads this file, so it imports nothing but the view's formatter.
 */
import { formatGbp } from "@/lib/commerce/view";
import { count, vials } from "./home";

export const ORDER = {
  heading: "Your order",
  empty: "Set a quantity in the price list to start an order.",
  vials: "Vials",
  perVial: "Per vial",
  notSet: "Not set yet",
  /** The phone summary bar: "£4.00 a vial", and its link down to the label. */
  perVialShort: (price: string) => `${price} a vial`,
  review: "Review order",
  saving: (baseVials: number) => `Saving against ${count(baseVials)}-vial packs`,
  line: (qty: number, packVials: number) => `${qty} × ${vials(packVials)}`,
  goods: "Goods",
  delivery: "Delivery",
  free: "Free",
  total: "Total",
  clear: "Clear order",
  /** Read out after every change, for screen readers. */
  status: (n: number, goodsMinor: number) => (n === 0 ? "Order empty." : `${vials(n)}, ${formatGbp(goodsMinor)} before delivery.`),
  /** The same vials cost less as other packs. */
  cheaper: (n: number, packs: string, savesMinor: number) =>
    `The same ${vials(n)} cost ${formatGbp(savesMinor)} less as ${packs}.`,
  switchTo: "Switch packs",
  atLimit: (max: number) => `That is the ${vials(max)} one online order holds.`,
  moreThanLimit: "Need more?",
  quote: "Request a quote",
  company: "Company name (optional)",
  vat: "VAT number (optional)",
  businessHint: "Recorded against the order.",
  pay: "Continue to payment",
  payBy: (label: string) => `Pay by ${label}`,
  payNote: (label: string) => `Pay by ${label}.`,
  pending: "Going to payment…",
  deliveryLegend: "Delivery",
};
