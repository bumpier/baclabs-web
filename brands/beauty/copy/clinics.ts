/**
 * The "For clinics" page's words: the same voice as the home page, in a
 * professional register. Practitioners and salons, their clients, their
 * orders; never a procedure, a treatment or anything done to a person.
 */
import { gbpShort } from "./home";

export const CLINICS = {
  metaTitle: "For clinics and salons",
  metaDescription:
    "Bacteriostatic water in sealed 10ml vials, in packs of 25, 50 and 100 for clinics and salons. Order online, or enquire about a larger or regular order.",
  title: "For clinics and salons",
  lead: "The same sealed 10ml vial as our Essentials, packed in number for practitioners and salons. Order a pack online in a few minutes, or write to us about a larger or regular order.",
  // TODO(launch): photography. The drawn tray stands in for a photograph of a
  // clinic pack, opened, seen from above.
  orderTitle: "Order a clinic pack",
  legend: "Pack size",
  packOption: (vials: number) => `${vials} vials`,
  quantity: "How many packs",
  add: "Add to basket",
  freeDelivery: "Delivery is free on every clinic pack.",
  artLabel: (vials: number) => `A tray of ${vials} sealed vials seen from above`,
  howTitle: "How clinic orders work",
  onlineTerm: "Online",
  online: (payLabel: string | null) =>
    payLabel
      ? `Choose a pack, check out and pay by ${payLabel}. We pack it and send it by tracked delivery.`
      : "Choose a pack and add it to your basket. We pack it and send it by tracked delivery.",
  largerTerm: "Larger or regular orders",
  larger: "Tell us the quantity, how often you need it and where it should go, and we will reply by email.",
  productTerm: "The product",
  product: "Sterile water with a bacteriostatic preservative, in a sealed 10ml vial, sold as a laboratory reagent.",
  limitTerm: "Per order",
  limit: (maxVials: number) => `One online order holds up to ${maxVials} vials. For more, send us an enquiry.`,
  enquireTitle: "Enquire about a clinic order",
  enquireLead: "Write to us and we will reply by email.",
  enquireLink: "Enquire about a larger order",
  /** The contact form's trade topic on this site (lib/commerce/contact.ts). */
  tradeTopic: "Clinic and salon orders",
  tradeHint: "Include the quantity you need, the delivery postcode and whether it is a one-off or recurring order.",
} as const;

/** "From £124.99" for the cheapest clinic pack. */
export function clinicsFrom(minor: number): string {
  return `From ${gbpShort(minor)}`;
}
