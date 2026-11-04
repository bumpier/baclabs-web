/**
 * The home page's words, in the gym's voice: blunt, short, no fluff. Every
 * figure is handed in from the storefront view (prices, pack sizes,
 * delivery), never typed here, so a change in brands/gym/catalogue.ts
 * reaches every line by itself.
 *
 * Imports nothing, so the client components may read it without pulling a
 * profile or config/ into the bundle (npm run test:bundle). npm run
 * check:brands holds every string to the gym's copy rules
 * (lib/content-rules.ts GYM_RULES): the slang the owner allowed ("cycle"),
 * none of the words they banned, and never a dosing or injecting line.
 *
 * The product is described only as the legal pages describe it
 * (lib/commerce/legal.ts productLine): sterile water with a bacteriostatic
 * preservative, in a sealed 10ml vial, sold as a laboratory reagent.
 */

const vials = (n: number) => (n === 1 ? "1 vial" : `${n} vials`);

export const HERO = {
  /** The three lines of the headline: "10 vials." "£49.99." "Done." Set in capitals by CSS. */
  count: (n: number) => `${vials(n)}.`,
  price: (price: string) => `${price}.`,
  done: "Done.",
  lead: "Bacteriostatic water in sealed 10ml vials. Boxed, tracked and sent. Stock up before your next cycle.",
  /** The button: "Add 10 vials", with the price beside it. */
  add: (n: number) => `Add ${vials(n)}`,
  /** Under the button, when this pack clears the free-delivery line: "Free next day delivery on this pack." */
  freeDelivery: (option: string) => `Free ${option.toLowerCase()} delivery on this pack.`,
  morePacks: "See every pack size",
};

export const LADDER = {
  heading: "Stock up.",
  lead: "Bigger pack, cheaper vial. Do the maths once and stop running out.",
  legend: "Pack size",
  count: (n: number) => (n === 1 ? "vial" : "vials"),
  perVial: (price: string) => `${price} a vial`,
  save: (amount: string) => `Save ${amount}`,
  /** The basis of every saving, said once under the ladder. */
  basis: (n: number) => `Savings are against buying the same vials in ${n}-packs.`,
  offline: "Not sold online",
  quote: "Ask us for a quote",
  quoteNote: "Packs marked not sold online are by quote only.",
  quantity: "Number of packs",
  add: "Add to basket",
  /** Announced when a pack goes in: "10 vials in the basket." */
  added: (n: number, qty: number) => (qty === 1 ? `${vials(n)} in the basket.` : `${qty} packs of ${n} in the basket.`),
  plates: (n: number) => `${vials(n)}`,
};

export const KIT = {
  lead: "Add the kit while you are here. It goes in the same parcel.",
  limit: "One kit per vial, at most.",
  add: "Add a Lab Kit",
  /** With nothing in the basket yet, the button adds the chosen pack and a kit together. */
  addWith: (n: number) => `Add with ${vials(n)}`,
  maxed: "One kit per vial, and you are at it.",
  added: "Lab Kit in the basket.",
};

export const BASKET = {
  heading: "Your order",
  empty: "Nothing in here yet. Pick a pack.",
  pack: (n: number, label: string) => (label ? `${label}, ${vials(n)}` : vials(n)),
  subtotal: "Subtotal",
  delivery: "Delivery",
  total: "Total",
  free: "Free",
  /** "£12.01 more and next day delivery is free." */
  shortfall: (amount: string, option: string) => `${amount} more and ${option.toLowerCase()} delivery is free.`,
  checkout: "Go to checkout",
  payWith: (label: string) => `Pay by ${label}`,
  pending: "Opening checkout…",
  payBy: (label: string) => `Pay by ${label}.`,
  remove: "Remove",
  quantityOf: (name: string) => `Quantity of ${name}`,
  tooManyKits: "One kit per vial, at most. Take a kit off or add vials.",
};

export const BOX = {
  heading: "What you get.",
  facts: [
    { term: "In the vial", detail: "Sterile water with a bacteriostatic preservative. 10ml, sealed." },
    { term: "Sold as", detail: "A laboratory reagent. Not a medicine and not a medical device." },
    { term: "Who can order", detail: "Over-18s, to a UK address." },
  ],
  delivery: "Delivery",
  /** "Royal Mail Tracked 48, 2–3 working days: £3.90." */
  deliveryLine: (label: string, detail: string, price: string) => `${label}: ${detail}, ${price}.`,
  freeFrom: (amount: string, option: string) => `${option} delivery is free on orders of ${amount} or more.`,
  returns: "Returns",
  returnsLine: "14 days to change your mind while the seal is unbroken. Faulty or damaged, opened or not, we put it right.",
  returnsLink: "The returns rules",
  /** The crate's stencilling, standing in for the product photo until there is one. */
  crate: { count: (n: number) => `${n} × 10ml`, contents: "Bacteriostatic water", up: "This way up" },
};

export const ANSWERS = {
  heading: "Straight answers.",
  items: [
    {
      q: "What is it?",
      a: "Sterile water with a bacteriostatic preservative, in a sealed 10ml vial. Nothing more to it.",
    },
    {
      q: "Is it a medicine?",
      a: "No. It is sold as a laboratory reagent, and we make no therapeutic claim for it.",
    },
    {
      q: "Where do you deliver?",
      a: "UK addresses only.",
    },
    {
      q: "Who can order?",
      a: "Over-18s only. We can refuse or cancel any order.",
    },
  ],
  delivery: "How fast is delivery?",
  returns: "Can I send it back?",
  returnsAnswer: "Within 14 days of delivery, if the seal is unbroken. Faulty or damaged, opened or not, tell us and we put it right.",
  returnsLink: "Full returns rules",
};

export const SIGNUP = {
  heading: "Restock emails.",
  lead: "Offers, restocks and new pack sizes. Nothing else.",
  placeholder: "you@example.com",
  submit: "Sign me up",
  pending: "Signing up…",
  done: "You are in. Check your inbox.",
};

export const BAR = {
  /** The bar's region name, for screen readers. */
  label: "Quick buy",
  basket: (items: number) => (items === 1 ? "1 item" : `${items} items`),
  add: "Add to basket",
  checkout: "Checkout",
  view: "View basket",
};
