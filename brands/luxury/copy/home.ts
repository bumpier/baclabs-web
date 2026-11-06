/**
 * The home page's words: the hero, the product, the three chapters, the
 * concierge and the bag. Plain strings and string functions that import
 * nothing, so the purchase column and the bag (client components) can use
 * them without pulling a profile or config/ into the browser. The brand's
 * name is a parameter, never typed here, so it follows the profile.
 *
 * The voice: understated and particular, speaking of the vial, its delivery
 * and the service. Never price-led, no superlatives, nothing the catalogue
 * cannot back. Delivery is said in the catalogue's own terms (brands/luxury/
 * service.ts), so the page never promises what the checkout does not sell.
 *
 * The packaging is a plain, unprinted white box, the same for every brand
 * (the owner, 6 Nov 2026): no printed or branded box, no seal, no card. The
 * words say so plainly where it helps and never dress it up. The drawn seal
 * (components/Marks.tsx) is the site's graphic, not something in the parcel.
 */

/** The delivery facts the page reads (ServiceFacts in brands/luxury/service.ts). */
interface Facts {
  label: string;
  carrier: string;
  cutoff: string | null;
  arrives: string;
  included: boolean;
}

export const HERO = {
  heading: "Bacteriostatic water, sealed in glass.",
  action: "Choose a size",
};

export const PRODUCT = {
  name: "Bacteriostatic Water",
  lede: "Sealed 10ml glass vials",
  intro: (name: string) =>
    `Sterile water with a bacteriostatic preservative, in sealed 10ml glass vials. Every ${name} order is sent in a plain white box. Supplied as a laboratory reagent.`,
  gallery: {
    label: "Photographs of the vial and its box",
    showing: (n: number, of: number) => `Photograph ${n} of ${of}`,
  },
  sizes: "Size",
  vials: (n: number) => (n === 1 ? "1 vial" : `${n} vials`),
  onRequest: "On request",
  requestNote: "Sizes marked on request are not ordered online.",
  requestLink: "Ask the concierge",
  quantity: "Quantity",
  add: "Add to bag",
  added: (size: string, qty: number) => (qty === 1 ? `${size} added to your bag.` : `${qty} × ${size} added to your bag.`),
  addOnsHeading: "To go with it",
  addOnAdd: "Add",
  service: {
    label: "Delivery and returns",
    delivery: (f: Facts) => {
      const what = `${f.arrives} delivery${f.included ? ", complimentary on every order" : ""}.`;
      return f.cutoff ? `${what} Order by ${f.cutoff} on a working day.` : what;
    },
    carrier: (f: Facts) => `Sent tracked by ${f.carrier}, from the UK.`,
    returns: "Returns within 14 days of delivery, while the vials are sealed.",
    returnsLink: "Returns policy",
  },
  details: {
    vial: {
      title: "The vial",
      body: "10ml of sterile water with a bacteriostatic preservative, in a clear glass vial sealed under a blue flip-off cap and a silver crimp. The vial and its label are plain. Supplied as a laboratory reagent, not a medicine.",
    },
    // The box as the owner describes it (6 Nov 2026): plain, unprinted,
    // white card, the vials standing in a card divider. Say nothing more of
    // it than that.
    box: {
      title: "The box",
      body: "Every size, from a single vial to twenty, comes in a plain white card box with nothing printed on it, the vials standing upright inside.",
    },
  },
};

/** The gift option: the note is printed on the packing slip, which goes in the box (lib/commerce/gift-note.ts). */
export const GIFT = {
  option: "Include a gift note",
  label: "Your note",
  hint: (max: number) => `Printed on the packing slip, which goes in the box with the vials. Up to ${max} characters.`,
  summary: "Gift note",
};

/**
 * The three chapters, in the order an order lives them: the vial, the
 * packing (and the gift note, where the catalogue offers one), the
 * delivery. TODO(confirm): that every order is packed by hand.
 */
export const CHAPTERS = {
  vial: {
    title: "The vial",
    body: "Ten millilitres of sterile water with a bacteriostatic preservative, in clear glass, sealed under a blue flip-off cap and a silver crimp. The label is plain, and so is the box it comes in.",
  },
  hands: {
    title: "Packed by hand",
    body: (giftNote: boolean) =>
      `Each order is packed by hand, the vials set upright in a plain white box.${
        giftNote ? " If it is a gift, your note is printed on the packing slip and goes in with them." : ""
      }`,
  },
  arrival: {
    title: "The next working day",
    body: (f: Facts) =>
      `${f.carrier} brings it to your door the ${f.arrives.toLowerCase()}${f.cutoff ? ` when you order by ${f.cutoff}` : ""}, tracked${
        f.included ? " and at no charge" : ""
      }. We email you the tracking number as it leaves us.`,
    days: "Working days run Monday to Friday, bank holidays aside. We deliver to UK addresses only.",
  },
};

export const CONCIERGE_BAND = {
  title: "The concierge",
  body: "Questions before you choose, about an order, its delivery or a return. Write to us and we reply by email.",
  action: "Write to the concierge",
};

/** The bag drawer: the order, delivery, the gift note and payment. */
export const BAG = {
  title: "Your bag",
  close: "Close the bag",
  empty: "Your bag is empty.",
  browse: "Choose a size",
  lineName: (size: string) => size,
  lineQty: (name: string) => `Quantity of ${name}`,
  remove: "Remove",
  delivery: "Delivery",
  included: "Complimentary",
  total: "Total",
  shortfall: (amount: string) => `Add ${amount} more and delivery is complimentary.`,
  pay: "Proceed to payment",
  paying: "Going to payment…",
  payWith: (label: string) => `Pay by ${label}`,
  payNote: (label: string) => `Payment by ${label} follows on the next page.`,
};

export const LETTERS = {
  heading: "Letters",
  lede: "Now and then, word of new releases and restocks.",
  placeholder: "Your email address",
  submit: "Subscribe",
  pending: "Subscribing…",
  done: "Thank you. You are on the list.",
};
