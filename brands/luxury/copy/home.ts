/**
 * The home page's words. Plain strings and string functions that import
 * nothing, so the buy section (a client component) can use them without
 * pulling a profile or config/ into the browser. The brand's name is a
 * parameter, never typed here, so it follows the profile.
 *
 * The voice: understated and particular. Craft, packaging and service;
 * never price-led, no superlatives, nothing the catalogue cannot back. The
 * delivery sentences are built from the catalogue (brands/luxury/service.ts).
 */

/**
 * TODO(confirm): the sealed batch card is in the plan (Phase 4) but not yet
 * in the catalogue or the box's SKU (lib/inventory/brand-skus.ts). Confirm
 * every box carries one before launch. Set this to "" and every line and
 * drawing that shows the card renders nothing.
 */
export const BATCH_CARD: string = "A sealed card with the batch details of the vials inside.";

export const HERO = {
  heading: "Bacteriostatic water, boxed and sealed.",
  lede: (name: string) =>
    BATCH_CARD ? `10ml vials, packed in the ${name} box with a sealed batch card.` : `10ml vials, packed in the ${name} box.`,
  delivery: (f: { cutoff: string | null; arrives: string; included: boolean }) => {
    const when = f.cutoff ? `Order by ${f.cutoff} for delivery the ${f.arrives.toLowerCase()}` : `${f.arrives} delivery`;
    return f.included ? `${when}, included on every order.` : `${when}.`;
  },
  choose: "Choose a box",
  concierge: "Write to the concierge",
};

export const DAY = {
  heading: "The order of the day",
  choose: {
    when: (cutoff: string | null) => (cutoff ? `By ${cutoff}` : "Today"),
    title: "Choose a box",
  },
  arrive: {
    title: "It arrives",
    carrier: (f: { carrier: string; cutoff: string | null; arrives: string; included: boolean }) => {
      const when = f.cutoff ? ` the ${f.arrives.toLowerCase()} when you order by ${f.cutoff}` : "";
      return `${f.carrier} brings it to your door${when}${f.included ? ", at no charge on every order" : ""}.`;
    },
    tracking:
      "We email you its tracking number when it ships. Working days run Monday to Friday, bank holidays aside, and we deliver to UK addresses only.",
    figure: BATCH_CARD ? "The box open: the sealed batch card above the vials." : "The box open, with its vials.",
    contents: [
      { term: "The box", detail: (name: string) => `Each size comes packed in the ${name} box.` },
      { term: "The vials", detail: () => "10ml of sterile water with a bacteriostatic preservative, in a sealed vial. Supplied as a laboratory reagent." },
      ...(BATCH_CARD ? [{ term: "The card", detail: () => BATCH_CARD }] : []),
    ],
  },
  concierge: {
    when: "Whenever you need us",
    title: "The concierge",
    body: "Questions before you choose, about an order, its delivery or a return. Write to us and we reply by email.",
    action: "Write to the concierge",
  },
};

/** The buy section: choosing a size, the order and payment. */
export const BUY = {
  legend: "Size of box",
  vials: (n: number) => (n === 1 ? "1 vial" : `${n} vials`),
  onRequest: "On request",
  requestNote: "Sizes marked on request are not ordered online.",
  requestLink: "Ask the concierge",
  boxes: "Boxes",
  add: "Add to your order",
  added: (name: string, qty: number) => (qty === 1 ? `${name} added to your order.` : `${qty} × ${name} added to your order.`),
  addOnsHeading: "To go with it",
  addOnAdd: "Add",
  orderHeading: "Your order",
  empty: "Nothing chosen yet.",
  lineBoxes: (name: string) => `${name} boxes`,
  remove: "Remove",
  delivery: "Delivery",
  included: "Included",
  total: "Total",
  shortfall: (amount: string) => `Add ${amount} more and delivery is included.`,
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
