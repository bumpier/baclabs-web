/**
 * The words every page carries (the header, the cart drawer, the footer, the
 * cookie banner, the description search engines and link previews show) and
 * the words of the pages that are not the home page: contact, the 404 and the
 * order confirmation. Imports nothing, like copy/home.ts, so client
 * components may read it.
 */

const vials = (n: number) => (n === 1 ? "1 vial" : `${n} vials`);

/** "5, 10, 20 or 50" from the packs on sale. */
function sizes(counts: readonly number[], last = "or"): string {
  if (counts.length <= 1) return counts.join("");
  return `${counts.slice(0, -1).join(", ")} ${last} ${counts[counts.length - 1]}`;
}

export const SITE = {
  /** The meta description, built from the packs on sale so it never names a size that is gone. */
  description: (counts: readonly number[]) =>
    counts.length > 0
      ? `Bacteriostatic water in sealed 10ml vials, by the pack: ${sizes(counts)} vials, boxed and sent tracked to UK addresses.`
      : "Bacteriostatic water in sealed 10ml vials, boxed and sent tracked to UK addresses.",
  /** "1, 5, 10 and 20", for the marquee. */
  sizes: (counts: readonly number[]) => sizes(counts, "and"),
  skip: "Skip to content",
  home: (name: string) => `${name}, home`,
  nav: "Main",
  links: {
    shop: "Shop",
    maths: "Price per vial",
    faq: "FAQ",
    contact: "Contact",
    terms: "Terms",
    privacy: "Privacy",
    returns: "Returns",
    disclaimer: "Product disclaimer",
  },
  footer: {
    nav: "Footer",
    shop: "Shop",
    help: "Help",
    legal: "Legal",
    signoff: "Lift heavy. Restock early.",
  },
  cookieSettings: "Cookie settings",
};

/** The header's cart button and the slide-out cart. */
export const CART = {
  open: "Cart",
  /** The button's name: "Cart, 3 items" */
  openWith: (n: number) => (n === 1 ? "Cart, 1 item" : `Cart, ${n} items`),
  heading: "Your stack",
  /** Beside the heading: "(3)" is drawn, this is said. */
  count: (n: number) => (n === 1 ? "1 item" : `${n} items`),
  close: "Close cart",
  empty: "Nothing in here yet.",
  emptyLead: "Pick a pack and it lands here.",
  shop: "Shop the stack",
  /** The free-delivery meter. */
  shortfall: (amount: string, option: string) => `${amount} more for free ${option.toLowerCase()} delivery.`,
  freeDone: (option: string) => `Free ${option.toLowerCase()} delivery is yours.`,
  meter: "Progress to free delivery",
  /** A pack line: "10 vials" with "£5.00 a vial" under it. */
  pack: (n: number, label: string) => (label ? `${label}, ${vials(n)}` : vials(n)),
  perVial: (price: string) => `${price} a vial`,
  remove: "Remove",
  quantityOf: (name: string) => `Quantity of ${name}`,
  kitTag: "Kit",
  /** The Lab Kit, offered inside the cart while the view lists it on sale. */
  kit: {
    lead: "Add it while you're here. Same parcel.",
    limit: "One kit per vial, at most.",
    /** "Add Lab Kit"; its price is beside its name above the button. */
    add: (name: string) => `Add ${name}`,
    maxed: "One kit per vial, and you're at it.",
    added: (name: string) => `${name} added.`,
  },
  delivery: "Delivery",
  subtotal: "Subtotal",
  total: "Total",
  free: "Free",
  checkout: "Checkout",
  payWith: (label: string) => `Pay by ${label}`,
  pending: "Opening checkout…",
  payBy: (label: string) => `Pay by ${label}. You'll confirm your address on the next page.`,
  tooManyKits: "One kit per vial, at most. Take a kit off or add vials.",
  /** Announced when a pack goes in from a card or the bar: "10 vials added." */
  added: (n: number) => `${vials(n)} added to your cart.`,
};

export const COOKIES = {
  heading: "Cookies",
  /** The companies are named by the banner itself, from the trackers the site runs. */
  body: (companies: string) =>
    `${companies} cookies tell us how the site is used and how our adverts do. They stay off unless you accept, and the cart works either way.`,
  reject: "Reject",
  accept: "Accept",
};

export const CONTACT = {
  title: "Contact",
  description: (name: string) => `Message ${name} about an order, delivery, a return or the product.`,
  heading: "Talk to us",
  lead: "Orders, delivery, returns, complaints, or a question before you buy. Write it here",
  orEmail: "or email",
  /** The facts beside the form, each from the catalogue or the terms. */
  asideHeading: "Before you write",
  order: "Got an order number? Put it in. It's on your confirmation email.",
  returns: "Sending something back? Tell us first and we'll give you the address.",
  returnsLink: "Returns rules",
  /** The kit form's labels, in the brand's words. */
  form: {
    topic: "What's it about?",
    topicPrompt: "Pick one",
    name: "Your name",
    email: "Your email",
    orderRef: "Order number (if you have one)",
    message: "What's up?",
    submit: "Send it",
    sending: "Sending…",
    again: "Send another",
  },
};

export const NOT_FOUND = {
  heading: "Missed the lift.",
  lead: "Nothing lives at this address. The packs are one tap away.",
  back: "Back to the shop",
};

export const CONFIRMATION = {
  title: "Your order",
  heading: {
    cancelled: "Order cancelled.",
    paid: "Locked in.",
    confirming: "Payment in.",
    pending: "Order received.",
  },
  status: {
    cancelled: "This order is no longer active.",
    delivered: "Delivered. You're stocked up.",
    sent: "On its way.",
    paid: "Payment cleared. We're packing your order.",
    confirming: "We're confirming your payment now. This page updates itself in a few seconds.",
    pending: "We're waiting for your payment to be confirmed. Reload this page for the latest status.",
  },
  order: "Order",
  placed: "Placed",
  items: "What's in the box",
  delivery: "Delivery",
  free: "Free",
  totalPaid: "Total paid",
  total: "Total",
  parcel: "Your parcel",
  sentBy: "Sent by",
  tracking: "Tracking number",
  latest: "Latest update",
  delivered: "Delivered",
  sent: "Sent",
  next: "What happens next",
  steps: {
    email: "A confirmation email is on its way",
    to: "to",
    packWith: (carrier: string, due: string | null, transit: string) =>
      due
        ? `We pack it and send it by ${carrier} to the address you gave. It's due ${due}.`
        : `We pack it and send it by ${carrier} to the address you gave (${transit}).`,
    pack: "We pack it and send it to the address you gave.",
    ships: (detail: string, day: string) => ` ${detail} It ships on ${day}.`,
    shipped: "A second email lands when it ships, with the tracking number.",
  },
  problem: "Something not right?",
  getInTouch: "Get in touch",
  quoting: "quoting your order number.",
  back: "Back to the shop",
};
