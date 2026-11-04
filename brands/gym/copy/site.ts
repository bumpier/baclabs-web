/**
 * The words every page carries (the header, the footer, the cookie banner,
 * the description search engines and link previews show) and the words of
 * the pages that are not the home page: contact, the 404 and the order
 * confirmation. Imports nothing, like copy/home.ts, so client components may
 * read it.
 */

/** "5, 10, 20 or 50" from the packs on sale. */
function sizes(counts: readonly number[]): string {
  if (counts.length <= 1) return counts.join("");
  return `${counts.slice(0, -1).join(", ")} or ${counts[counts.length - 1]}`;
}

export const SITE = {
  /** The meta description, built from the packs on sale so it never names a size that is gone. */
  description: (counts: readonly number[]) =>
    counts.length > 0
      ? `10ml bacteriostatic water by the pack: ${sizes(counts)} vials, boxed and sent tracked to UK addresses.`
      : "10ml bacteriostatic water by the pack, boxed and sent tracked to UK addresses.",
  skip: "Skip to content",
  home: (name: string) => `${name}, home`,
  basket: "Basket",
  basketCount: (n: number) => (n === 1 ? "1 item in the basket" : `${n} items in the basket`),
  footerNav: "Footer",
  links: {
    contact: "Contact",
    terms: "Terms",
    privacy: "Privacy",
    returns: "Returns",
    disclaimer: "Product disclaimer",
  },
  cookieSettings: "Cookie settings",
};

export const COOKIES = {
  heading: "Cookies",
  /** The companies are named by the banner itself, from the trackers the site runs. */
  body: (companies: string) =>
    `${companies} cookies tell us how the site is used and how our adverts do. They stay off unless you accept, and the basket works either way.`,
  reject: "Reject",
  accept: "Accept",
};

export const CONTACT = {
  title: "Contact",
  description: (name: string) => `Message ${name} about an order, delivery, a return or the product.`,
  heading: "Talk to us.",
  lead: "Orders, delivery, returns, complaints, or a question before you buy. Write it here",
  orEmail: "or email",
};

export const NOT_FOUND = {
  code: "404",
  heading: "Wrong room.",
  lead: "Nothing lives at this address.",
  back: "Back to the packs",
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
    delivered: "Delivered. Get stocked up.",
    sent: "On its way.",
    paid: "Payment cleared. We are packing your order.",
    confirming: "We are confirming your payment now. This page updates itself in a few seconds.",
    pending: "We are waiting for your payment to be confirmed. Reload this page for the latest status.",
  },
  order: "Order",
  placed: "Placed",
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
        ? `We pack it and send it by ${carrier} to the address you gave. It is due ${due}.`
        : `We pack it and send it by ${carrier} to the address you gave (${transit}).`,
    pack: "We pack it and send it to the address you gave.",
    ships: (detail: string, day: string) => ` ${detail} It ships on ${day}.`,
    shipped: "A second email lands when it ships, with the tracking number.",
  },
  problem: "Something not right?",
  getInTouch: "Get in touch",
  quoting: "quoting your order number.",
  back: "Back to the packs",
};
