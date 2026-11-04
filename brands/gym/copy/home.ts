/**
 * The home page's words, in the gym's voice: blunt, short, a bit of banter.
 * Every figure is handed in from the storefront view (prices, pack sizes,
 * delivery, the cutoff), never typed here, so a change in
 * brands/gym/catalogue.ts reaches every line by itself.
 *
 * Imports nothing, so the client components may read it without pulling a
 * profile or config/ into the bundle (npm run test:bundle). npm run
 * check:brands holds every string to the gym's copy rules
 * (lib/content-rules.ts GYM_RULES): the slang the owner allowed (gear, cycle,
 * blast, cruise), none of the words they banned, and never a dosing or
 * administering line.
 *
 * The product is described only as the legal pages describe it
 * (lib/commerce/legal.ts productLine): sterile water with a bacteriostatic
 * preservative, in a sealed 10ml vial, sold as a laboratory reagent.
 */

const vials = (n: number) => (n === 1 ? "1 vial" : `${n} vials`);

/** The scrolling strip above the header. Each fact is built from the view; a missing one is left out. */
export const MARQUEE = {
  label: "Delivery and shop facts",
  /** "Order by 3pm on a working day for next working day delivery" */
  cutoff: (time: string, option: string) => `Order by ${time} on a working day for ${option.toLowerCase()} delivery`,
  /** "Free next day delivery on orders of £40 or more" */
  free: (option: string, amount: string) => `Free ${option.toLowerCase()} delivery on orders of ${amount} or more`,
  tracked: "Tracked delivery to UK addresses",
  sealed: "Sealed 10ml vials",
  /** "Packs of 1, 5, 10 and 20" */
  packs: (counts: string) => `Packs of ${counts}`,
};

export const HERO = {
  /** The headline, one line each, set in capitals by CSS. */
  lines: ["Blast.", "Cruise.", "Restock."],
  lead: "Bacteriostatic water in sealed 10ml vials, boxed in black and sent tracked.",
  /** "Packs of 1 to 20, from £4.50 a vial." */
  from: (smallest: number, largest: number, price: string) => `Packs of ${smallest} to ${largest}, from ${price} a vial.`,
  cta: "Shop the stack",
};

export const SHOP = {
  heading: "Shop the stack",
  lead: "Same sealed vial in every box. The bigger the stack, the less each vial costs.",
  /** Shown only while the shared vial count is really low (StorefrontView.stock.low). No figure, no date. */
  low: "Stock is running low right now.",
  /** The card's title: "10 × 10ml vials" */
  title: (n: number) => `${n} × 10ml ${n === 1 ? "vial" : "vials"}`,
  unit: (n: number) => (n === 1 ? "vial" : "vials"),
  /** A line of banter per pack size; a size with none shows nothing. */
  taglines: {
    1: "Just the one. For the spare drawer.",
    5: "Keeps you topped up through a cruise.",
    10: "The sensible stock-up. No rationing.",
    20: "Never run dry halfway through a blast.",
  } as Record<number, string>,
  perVial: (price: string) => `${price} a vial`,
  save: (amount: string) => `Save ${amount}`,
  /** The tag on the pack with the lowest price a vial, computed from the catalogue. */
  lowest: "Lowest per vial",
  /** The basis of every saving, said once under the grid. */
  basis: (n: number) =>
    n === 1 ? "Savings are against buying the same vials one at a time." : `Savings are against buying the same vials in ${n}-packs.`,
  add: "Add to cart",
  /** Said after the button's label, for screen readers: "Add to cart: 10 vials, £49.99" */
  addDetail: (n: number, price: string) => `: ${vials(n)}, ${price}`,
  added: "Added",
  offline: "Not sold online",
  quote: "Ask us for a quote",
  /** The phone's hint under the scroller. */
  swipe: "Swipe for more packs",
};

export const MATHS = {
  heading: "Price per vial",
  lead: "Same vial, every box. Here's what one costs in each pack.",
  caption: "Price per 10ml vial, by pack size",
  pack: "Pack",
  perVial: "Per vial",
  versus: "Against singles",
  /** "1 vial", "20 vials" */
  size: (n: number) => vials(n),
  /** "31% less" */
  less: (pct: number) => `${pct}% less`,
  base: "Base price",
};

export const TRUST = {
  heading: "No messing about",
  dispatch: { title: "Sent from the UK", text: "Packed and dispatched by us on working days." },
  /** "Royal Mail Tracked 48 or Amazon Shipping. The tracking number lands by email." */
  tracked: {
    title: "Tracked, every parcel",
    text: (carriers: string) => `${carriers}. The tracking number lands in your inbox when it ships.`,
  },
  sealed: { title: "Sealed vials", text: "Every 10ml vial arrives under a tamper-evident flip-off cap." },
  returns: { title: "14-day returns", text: "Seal unbroken? Send it back within 14 days.", link: "Returns rules" },
};

export const FAQ = {
  heading: "Before you ask",
  lead: "Short questions, short answers. Anything else, ask us.",
  contact: "Message us",
  items: [
    {
      q: "What's in the vial?",
      a: "Sterile water with a bacteriostatic preservative. 10ml, sealed. That's it.",
    },
    {
      q: "Is it a medicine?",
      a: "No. It's sold as a laboratory reagent, and we make no therapeutic claim for it.",
    },
    {
      q: "What's the difference between the packs?",
      a: "Only the count. Every box holds the same sealed 10ml vials; the bigger the pack, the less each one costs.",
    },
    {
      q: "Who can order?",
      a: "Over-18s, delivering to a UK address. We can refuse or cancel any order.",
    },
  ],
  delivery: "How fast is delivery?",
  /** "Next day: Amazon Shipping, next working day if ordered by 3pm. £5.00." */
  deliveryLine: (label: string, detail: string, price: string) => `${label}: ${detail}. ${price}.`,
  freeFrom: (option: string, amount: string) => `${option} delivery is free on orders of ${amount} or more.`,
  returns: "Can I send it back?",
  returnsAnswer: "Within 14 days of delivery, if the seal is unbroken. Faulty or damaged, opened or not, tell us and we put it right.",
  returnsLink: "The full returns rules",
  kit: (name: string) => `What's in the ${name}?`,
  kitAnswer: (contents: string) => `${contents}. It goes in the same parcel, one kit per vial at most.`,
};

export const SIGNUP = {
  heading: "First in line",
  lead: "Restocks, offers and new pack sizes, straight to your inbox. Nothing else.",
  placeholder: "you@example.com",
  submit: "Sign me up",
  pending: "Signing up…",
  done: "You're in. Check your inbox.",
};

export const BAR = {
  /** The bar's region name, for screen readers. */
  label: "Quick add",
  pack: "Pack",
  option: (n: number, price: string) => `${vials(n)}, ${price}`,
  add: "Add",
  view: "View cart",
  /** "3 items, £54.99" */
  summary: (items: number, total: string) => `${items === 1 ? "1 item" : `${items} items`}, ${total}`,
};
