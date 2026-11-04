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
  home: "Vialhouse, product page",
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
        { href: "/quote", label: "Request a quote" },
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
  company: "Company",
  number: "Company no.",
  address: "Registered office",
  vat: "VAT no.",
  email: "Email",
};

export const CRUMBS = { catalogue: "Catalogue" };

export const QUOTE = {
  title: "Request a quote",
  description: (sizes: string) =>
    sizes
      ? `Ask for a quote on ${sizes} vials of 10ml bacteriostatic water, or on a standing order.`
      : "Ask for a quote on a large order of 10ml bacteriostatic water, or on a standing order.",
  lede: (sizes: string) =>
    sizes
      ? `For packs of ${sizes} vials, or a standing order. Tell us what you need and we reply by email with a price for the goods and their delivery.`
      : "For large orders, or a standing order. Tell us what you need and we reply by email with a price for the goods and their delivery.",
  packsHeading: "Packs sold by quote",
  packsHead: { code: "Code", size: "Pack" },
  stepsHeading: "How a quote works",
  steps: [
    "Send the pack, how many, the delivery postcode and whether it is a one-off or recurring.",
    "We reply by email with a price for the goods and their delivery.",
    "If it suits you, reply to the email to go ahead.",
  ],
  formHeading: "Your request",
  smaller: "Smaller orders go through the price table:",
  smallerLink: "order online",
};

/** The quote form's fields (app/wholesale/quote/QuoteForm.tsx), and the message they compose. */
export const QUOTE_FORM = {
  pack: "Pack size",
  otherSize: "Another quantity",
  packs: "How many packs",
  vialsWanted: "How many vials",
  postcode: "Delivery postcode",
  frequency: "One-off or recurring",
  oneOff: "One-off",
  recurring: "Recurring",
  often: "How often (optional)",
  oftenHint: "For example, every month.",
  company: "Company name (optional)",
  name: "Your name",
  email: "Email",
  notes: "Anything else (optional)",
  send: "Send request",
  sending: "Sending…",
  privacy: "We use what you send only to reply to you.",
  privacyLink: "Privacy",
  sentHeading: "Request sent",
  sent: (name: string, email: string) =>
    `Thanks${name ? `, ${name}` : ""}. Your request has reached us, and we will reply to ${email} with a price.`,
  again: "Send another request",
  failed: "Your request could not be sent. Please try again.",
  offline: "Your request could not be sent. Check your connection and try again.",
  /** The message /api/contact stores, one fact a line. */
  message: (f: {
    pack: string;
    countLabel: string;
    count: string;
    postcode: string;
    frequency: string;
    often: string;
    company: string;
    notes: string;
  }) =>
    [
      "Quote request",
      `Pack size: ${f.pack}`,
      `${f.countLabel}: ${f.count}`,
      `Delivery postcode: ${f.postcode}`,
      `Order: ${f.frequency}${f.often ? `, ${f.often}` : ""}`,
      f.company ? `Company: ${f.company}` : "",
      f.notes ? `\nNotes:\n${f.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
};

export const CONTACT = {
  title: "Contact",
  description: (name: string) => `Message ${name} about an order, delivery, a return or a question about the product.`,
  lede: "Questions about an order, delivery or a return, complaints, and questions about the product before you order.",
  formHeading: "Send a message",
  sideHeading: "Before you write",
  quoteAside: "Pricing a large or recurring order?",
  quoteLink: "Request a quote",
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
