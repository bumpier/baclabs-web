/**
 * The home page's words: the hero, the product, the three chapters, the
 * concierge and the bag. Plain strings and string functions that import
 * nothing, so the purchase column and the bag (client components) can use
 * them without pulling a profile or config/ into the browser. The brand's
 * name is a parameter, never typed here, so it follows the profile.
 *
 * The voice: understated and particular, a house speaking of its box and its
 * service. Never price-led, no superlatives, nothing the catalogue cannot
 * back. Delivery is said in the catalogue's own terms (brands/luxury/
 * service.ts), so the page never promises what the checkout does not sell.
 */

/**
 * TODO(confirm): the card closed with wax, shown in every photograph of the
 * open box, is the packaging concept, not yet in the catalogue or the box's
 * SKU (lib/inventory/brand-skus.ts). Confirm every box carries one before
 * launch. Set this to "" and every sentence that names the card renders
 * without it (the photographs would then need reshooting without it too).
 */
export const CARD: string = "a card sealed with wax";

/** The delivery facts the page reads (ServiceFacts in brands/luxury/service.ts). */
interface Facts {
  label: string;
  carrier: string;
  cutoff: string | null;
  arrives: string;
  included: boolean;
}

export const HERO = {
  heading: "Bacteriostatic water, boxed in claret.",
  action: "Choose a size",
};

export const PRODUCT = {
  name: "Bacteriostatic Water",
  lede: "10ml vials, in the claret box",
  intro: (name: string) =>
    `Sterile water with a bacteriostatic preservative, in sealed 10ml glass vials. Every order is packed in the ${name} box${
      CARD ? `, with ${CARD}` : ""
    }. Supplied as a laboratory reagent.`,
  gallery: {
    label: "Photographs of the box and the vial",
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
      body: "10ml of sterile water with a bacteriostatic preservative, in a clear glass vial sealed under a blue flip-off cap. Each vial and its label are plain: the house's name is on the box. Supplied as a laboratory reagent, not a medicine.",
    },
    // TODO(confirm): the box as the photographs show it (claret, the seal
    // pressed into the lid, a fitted tray). Say nothing of its materials
    // until the real box is made.
    box: {
      title: "The box",
      body: (name: string) =>
        `Every size, from a single vial to twenty, is packed in the ${name} box: deep claret, with the house seal pressed into the lid and the vials held in a fitted tray${
          CARD ? `, beside ${CARD}` : ""
        }.`,
    },
  },
};

/** The gift option: the note is printed on the packing slip, which goes in the box (lib/commerce/gift-note.ts). */
export const GIFT = {
  option: "Include a gift note",
  label: "Your note",
  hint: (max: number) => `Printed and packed in the box with the vials. Up to ${max} characters.`,
  summary: "Gift note",
};

/**
 * The three chapters, in the order a box lives them. TODO(confirm): that
 * every order is packed by hand, and the box's finish and pressed seal as
 * the photographs show them (copy/images.ts).
 */
export const CHAPTERS = {
  box: {
    title: "The box",
    body: (name: string) =>
      `Every size, from a single vial to twenty, comes in the same box. Deep claret, the ${name} seal pressed into its lid, and nothing printed on the vials inside.`,
  },
  hands: {
    title: "Packed by hand",
    body: `Each order is packed by hand: the vials set in their tray${CARD ? `, ${CARD} laid beside them` : ""}, the lid closed, the box wrapped for the journey.`,
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
