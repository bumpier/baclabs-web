/**
 * The order summary's words (app/wholesale/OrderDesk.tsx): the sticky panel
 * beside the price table on a desktop, the bottom sheet on a phone, and the
 * header's order button. A client component reads this file, so it imports
 * nothing but the view's formatter and the brand's own helpers.
 */
import { formatGbp } from "@/lib/commerce/view";
import { count, vials } from "./home";

export const ORDER = {
  heading: "Order summary",
  empty: "No packs yet. Type a quantity in the price table to start an order.",
  vials: "Vials",
  perVial: "Average per vial",
  notSet: "Not set yet",
  saving: (baseVials: number) => `Saving against ${count(baseVials)}-vial packs`,
  line: (qty: number, packVials: number) => `${qty} × ${vials(packVials)}`,
  remove: "Remove",
  removeLabel: (packVials: number) => `Remove the ${count(packVials)}-vial packs`,
  goods: "Goods",
  delivery: "Delivery",
  free: "Free",
  total: "Total",
  clear: "Clear order",
  /** Read out after every change, for screen readers. */
  status: (n: number, goodsMinor: number) => (n === 0 ? "Order empty." : `${vials(n)}, ${formatGbp(goodsMinor)} before delivery.`),
  /** The same vials cost less as other packs. */
  cheaper: (n: number, packs: string, savesMinor: number) => `The same ${vials(n)} cost ${formatGbp(savesMinor)} less as ${packs}.`,
  switchTo: "Switch packs",
  atLimit: (max: number) => `That is the ${vials(max)} one online order holds.`,
  moreThanLimit: "Need more?",
  quote: "Get a quote by email",
  businessHeading: "Add company details (optional)",
  company: "Company name",
  vat: "VAT number",
  businessHint: "Recorded against the order.",
  pay: "Continue to payment",
  payBy: (label: string) => `Pay by ${label}`,
  payNote: (label: string) => `Pay by ${label} on the next page.`,
  pending: "Going to payment…",
  deliveryLegend: "Delivery",
  /** The phone's bar and sheet. */
  barTotal: (total: string) => `${total} total`,
  view: "View order",
  close: "Close order summary",
  /** The header's button. */
  button: "Order",
  buttonLabel: (n: number) => (n === 0 ? "Order summary, no vials yet" : `Order summary, ${vials(n)}`),
};
