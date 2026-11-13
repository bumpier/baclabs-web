/**
 * The words of every page but the product page: the header and footer, the
 * quote and contact pages, the order acknowledgement and the 404. Plain
 * strings, no imports, so any component may read them.
 *
 * No reply time is promised anywhere: only the operator can make that
 * promise (ContactForm's replyTime), and until then it stays unsaid.
 */

/** The header's links, in the order a buyer reads a product page. */
export const NAV: readonly { href: string; label: string }[] = [
  { href: "/#product", label: "Product" },
  { href: "/#buy", label: "Pricing" },
  { href: "/#delivery", label: "Delivery" },
  { href: "/quote", label: "Quote" },
  { href: "/contact", label: "Contact" },
];

export const HEADER = {
  home: "BulkBac, product page",
  menu: "Menu",
  nav: "Main",
};

export const FOOTER = {
  summary: "Bacteriostatic water in 10ml vials, by the pack and priced per vial. Trade and public orders welcome.",
  columns: [
    {
      heading: "Ordering",
      links: [
        { href: "/#buy", label: "Pricing and order" },
        { href: "/#delivery", label: "Delivery" },
        { href: "/quote", label: "Get a quote" },
      ],
    },
    {
      heading: "Help",
      links: [
        { href: "/contact", label: "Contact" },
        { href: "/returns", label: "Returns" },
        { href: "/#documents", label: "Documents" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { href: "/terms", label: "Terms of sale" },
        { href: "/privacy", label: "Privacy" },
        { href: "/disclaimer", label: "Product disclaimer" },
      ],
    },
  ],
  company: "Operated by",
  number: "Company no.",
  address: "Registered office",
  vat: "VAT no.",
  email: "Email",
};

export const CRUMBS = { catalogue: "Catalogue" };

/** The quote page. Quotes are done by email (brands/wholesale/mailbox.ts). */
export const QUOTE = {
  title: "Get a quote",
  description: (sizes: string) =>
    sizes
      ? `Get a quote on ${sizes} vials of 10ml bacteriostatic water, or on a standing order, by email.`
      : "Get a quote on a large order of 10ml bacteriostatic water, or on a standing order, by email.",
  lede: (sizes: string) =>
    sizes
      ? `For packs of ${sizes} vials, or a standing order. Email us what you need and we reply with a price for the goods and their delivery.`
      : "For large orders, or a standing order. Email us what you need and we reply with a price for the goods and their delivery.",
  packsHeading: "Packs sold by quote",
  packsHead: { code: "Code", size: "Pack", action: "Quote" },
  packAction: "Get a quote",
  stepsHeading: "How a quote works",
  steps: [
    "Email the pack, how many, the delivery postcode and whether it is a one-off or recurring.",
    "We reply by email with a price for the goods and their delivery.",
    "If it suits you, reply to the email to go ahead.",
  ],
  emailHeading: "Email us",
  emailBody: "A pack's \u201cGet a quote\u201d opens an email with its size and the facts we need already written. Or write to us:",
  emailButton: "Email for a quote",
  smaller: "Smaller orders go through the price table:",
  smallerLink: "order online",
};

export const CONTACT = {
  title: "Contact",
  description: (name: string) => `Message ${name} about an order, delivery, a return or a question about the product.`,
  lede: "Questions about an order, delivery or a return, complaints, and questions about the product before you order.",
  formHeading: "Send a message",
  sideHeading: "Before you write",
  quoteAside: "Pricing a large or recurring order?",
  quoteLink: "Get a quote",
  orderAside: "Writing about an order? Include the order number from your confirmation email.",
  emailAside: "Or email",
};

export const ACK = {
  title: "Your order",
  sheet: "Order acknowledgement",
  order: "Order number",
  placed: "Placed",
  status: "Status",
  delivery: "Delivery",
  item: "Item",
  qty: "Qty",
  amount: "Amount",
  free: "Free",
  totalPaid: "Total paid",
  total: "Total",
  parcel: "Your parcel",
  next: "What happens next",
  help: "Something not right?",
  helpLink: "Get in touch",
  helpTail: "quoting your order number.",
  home: "Back to the product page",
};

export const NOT_FOUND = {
  title: "Page not found",
  body: "That address is not in our catalogue. The product page has every pack, price and code.",
  home: "Go to the product page",
  contact: "Contact us",
  code: "Not found",
};
