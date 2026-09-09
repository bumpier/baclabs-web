// ─────────────────────────────────────────────────────────────────
// WHITE-LABEL CONFIG — names, contact details and legal identity.
// To rebrand: edit this file + swap /public/logo.svg (and app/icon.svg,
// which is the same mark served as the favicon).
//
// COLOUR DOES NOT LIVE HERE. It lives in lib/theme.ts, as literal values
// with a measured contrast ratio against every ground they are used on.
// This file used to claim the palette was "derived automatically from
// primaryColor + accentColor" — it never was, and the two fields sat here
// holding a retired blue that still shipped to customers in transactional
// email while the site rendered a different one. They are gone; every
// surface, email included, now reads lib/theme.ts.
//
// Product prices and bundle tiers do NOT live here — see config/funnel.ts.
// ─────────────────────────────────────────────────────────────────

export const brand = {
  name: "BacLab",
  tagline: "Bacteriostatic water for laboratory use.",
  // The vial mark only — the "BacLab" wordmark is rendered as real text
  // in components/Header.tsx so it uses the display typeface. Swap this
  // file to change the mark. SVG loaded via <img> cannot read the page's
  // CSS variables, so the brand colour is hard-coded inside it.
  logo: "/logo.svg",
  // Body font is Inter; the display face is loaded in app/fonts.ts.
  // To change fonts, edit the imports there (next/font needs literal names).
  fontFamily: "Inter",
  currency: {
    // The storefront is GBP-only: one UK seller, one authored price.
    default: "GBP" as const,
    // USD is NOT offered to shoppers. It is here solely because the crypto
    // gateway settles in USD, so lib/fx.ts must be able to convert into it.
    // Never render a currency switcher from this list.
    supported: ["GBP", "USD"] as const,
  },
  /**
   * Brand-name variants people type or search. Emitted as Organization
   * `alternateName` so the entity resolves whichever spelling is used.
   */
  alternateNames: ["Bac Lab", "BacLab UK", "baclab.co.uk"],
  /**
   * Public profiles for Organization `sameAs` (Trustpilot, Google Business
   * Profile, Companies House…). Empty list emits nothing.
   */
  sameAs: [] as string[],
  /**
   * Where a review request sends the customer. Empty means the request email
   * asks them to reply by email instead, and nothing links out.
   */
  reviews: {
    url: "",
  },
  contact: {
    // Leave "" to omit the address everywhere: contact page, footer, order
    // confirmation, FAQ answers, JSON-LD contactPoint and the email footer.
    //
    // THE ONE EXCEPTION to "colour and identity are literals here": this
    // reads an env var first, because it is the fact that unblocks the most
    // surfaces and the operator can set it on the server without a code
    // change. It is NEXT_PUBLIC_ because config/funnel.ts imports this file
    // for GUARANTEE.body and the purchase block is a client component, so a
    // server-only variable would resolve differently on the two sides and
    // desynchronise the guarantee text between the HTML and the hydrated
    // page. Being NEXT_PUBLIC_ also makes it BUILD-time: set it and rebuild,
    // a restart will not pick it up.
    //
    // BEFORE SETTING IT: baclab.co.uk publishes no MX record, so no mailbox
    // exists on the domain yet. An address here that cannot receive mail is
    // worse than none — it turns the price-match guarantee into a promise
    // with a dead letterbox. Set up mail routing first.
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
    // Leave "" to omit the phone from JSON-LD.
    phone: "",
  },
  // Company details for the footer and legal pages. Each renders only when
  // non-empty, so an unfilled entry is invisible rather than a placeholder.
  // Nothing here is ever rendered as a stand-in: an unsupplied fact is left
  // out of the sentence entirely, including on /terms and /privacy.
  company: {
    legalName: "",
    companyNumber: "",
    registeredAddress: "",
    /**
     * The same address, structured, for Organization `address` in the
     * structured data. Renders only when `streetAddress` is set; keep it in
     * step with `registeredAddress` above.
     */
    postalAddress: {
      streetAddress: "",
      addressLocality: "",
      postalCode: "",
      addressCountry: "GB",
    },
    /** Year trading began, "YYYY". Organization `foundingDate`; empty omits it. */
    foundingDate: "",
    vatNumber: "",
    // ICO data-protection register entry, shown on /privacy. Leave "" if the
    // fee exemption applies — the row is then omitted rather than qualified.
    icoRegistration: "",
  },
  // Printed at the bottom of every packing slip
  packingSlipThankYou: "Thank you for your order.",
  trust: {
    // Empty strings render nothing.
    shippingLine: "",
    qualityLine: "UK price match guarantee",
    secureLine: "Payments processed securely by Stripe.",
  },
  // Compliance line shown in the footer. This is the SHORT FORM of the
  // /disclaimer page — if you change one, change the other. It must never
  // state or imply a therapeutic use: doing so turns an unlicensed reagent
  // into an unlicensed medicinal product under the Human Medicines
  // Regulations 2012.
  disclaimer:
    "Sold as a laboratory reagent. Not a medicine and not a medical device. No therapeutic claim is made. See the product disclaimer.",
};

export type Currency = (typeof brand.currency.supported)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: "£",
  USD: "$",
};

const CURRENCY_DECIMALS: Record<Currency, number> = {
  GBP: 2,
  USD: 2,
};

export function formatPrice(amount: number | string, currency: Currency): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const dp = CURRENCY_DECIMALS[currency];
  const formatted = n.toLocaleString("en-GB", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
  return `${CURRENCY_SYMBOLS[currency]}${formatted}`;
}
