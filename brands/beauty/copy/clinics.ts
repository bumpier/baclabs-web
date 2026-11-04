/**
 * The "For clinics" page's words: the same voice as the home page, in a
 * professional register. Practitioners and salons, their stock, their
 * orders; never anything done to a person.
 */
export const CLINICS = {
  metaTitle: "For clinics and salons",
  metaDescription:
    "Bacteriostatic water in sealed 10ml vials, in packs of 1, 5, 10 and 20 for clinics and salons. Order online, or enquire about a larger or regular order.",
  title: "For clinics and salons",
  lead: (sizes: string) =>
    `The same sealed 10ml vial as our Essentials, in packs of ${sizes}, for practitioners and salons. Order online in a few minutes, or write to us about a larger or regular order.`,
  toPriceList: "See the price list",
  enquireLink: "Enquire about a larger order",
  /** Short facts under the hero, each true of every order. */
  facts: (sizes: string, maxVials: number) => [
    { term: "Packs", detail: `Of ${sizes} sealed vials` },
    { term: "Online", detail: `Up to ${maxVials} vials an order` },
    { term: "Delivery", detail: "Tracked, from the UK" },
  ],
  priceTitle: "The price list",
  // TODO(confirm): the pouch, as copy/home.ts ESSENTIALS.pouch.
  priceLead: (count: number) =>
    `One product in ${count === 4 ? "four" : count} pack sizes, each pack in the Aurelle pouch. Choose a pack and how many, and it goes into your basket.`,
  legend: "Pack",
  packName: (vials: number) => (vials === 1 ? "Single vial" : `Pack of ${vials}`),
  packContents: (vials: number) => (vials === 1 ? "One sealed 10ml vial" : `${vials} sealed 10ml vials`),
  freeDelivery: (label: string) => `Free ${label.toLowerCase()} delivery`,
  quantity: "Packs",
  add: "Add to basket",
  howTitle: "How clinic orders work",
  onlineTerm: "Ordering online",
  online: (payLabel: string | null) =>
    payLabel
      ? `Choose a pack, check out and pay by ${payLabel}. We pack it and send it by tracked delivery.`
      : "Choose a pack and add it to your basket. We pack it and send it by tracked delivery.",
  largerTerm: "Larger or regular orders",
  larger: "Tell us the quantity, how often you need it and where it should go, and we will reply by email.",
  productTerm: "The product",
  product: "Sterile water with a bacteriostatic preservative, in a sealed 10ml vial under a blue flip-off cap, sold as a laboratory reagent.",
  limitTerm: "Per order",
  limit: (maxVials: number) => `One online order holds up to ${maxVials} vials. For more, send us an enquiry.`,
  enquireTitle: "Enquire about a clinic order",
  enquireLead: "Tell us what you need and we will reply by email.",
  enquireNote: "The quantity, how often, and the delivery postcode are all we need to start.",
  /** The enquiry form's own labels, in this page's words (the kit's ContactForm `text`). */
  form: {
    topic: "Your enquiry is about",
    name: "Your name",
    email: "Work email",
    message: "What you need",
    submit: "Send enquiry",
    sending: "Sending…",
    again: "Send another enquiry",
  },
  /** The contact form's trade topic on this site (lib/commerce/contact.ts). */
  tradeTopic: "Clinic and salon orders",
  tradeHint: "Include the quantity you need, the delivery postcode and whether it is a one-off or recurring order.",
} as const;
