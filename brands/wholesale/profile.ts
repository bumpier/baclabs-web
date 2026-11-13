/**
 * BulkBac, the `wholesale` brand: a trade supplier's site (name chosen
 * 6 Nov 2026; on bulkbac.co.uk from 13 Nov 2026). Spruce and white with one signal
 * yellow, the vial-rack mark (brands/wholesale/components/logo.tsx); the
 * stylesheet's opening comment holds the whole direction. Empty values
 * render nothing, as everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { OPERATOR } from "../operator";
import { STRIPE_PAYMENT } from "../payment-methods";
import { wholesaleCatalogue } from "./catalogue";
import { MAILBOX } from "./mailbox";

export function wholesaleProfile(): BrandProfile {
  return {
    id: "wholesale",
    name: "BulkBac",
    shortCode: "BK",
    origin: "https://bulkbac.co.uk",
    // brands/hosts.json, and the matcher literal in middleware.ts (npm run
    // test:hosts checks the two agree).
    domains: [...hosts.wholesale],
    logo: "/icon.svg",
    colours: {
      paper: "#FFFFFF",
      surface: "#FFFFFF",
      neutral: "#F3F6F5",
      ink: "#13211F",
      inkSoft: "#4B5D59",
      line: "#D6DEDB",
      primary: "#0D3B35",
      cta: "#FCC72F",
      header: "#0D3B35",
      onHeader: "#FFFFFF",
      onCta: "#0D3B35",
    },
    email: {
      // Sent through Resend from mail.bulkbac.co.uk, which has no mailbox:
      // replies go to the Hostinger one on the apex.
      from: "BulkBac <hello@mail.bulkbac.co.uk>",
      replyTo: MAILBOX,
      contact: MAILBOX,
      inbox: MAILBOX,
      // The lockup in white and signal yellow on its own spruce, for the
      // spruce header band (rendered from components/logo.tsx's shapes).
      logo: { src: "/email-logo.png", width: 200, height: 28 },
    },
    reviews: { url: "", inviteBcc: null },
    disclaimer:
      "Sold as a laboratory reagent. Not a medicine and not a medical device. No therapeutic claim is made.",
    packingSlipThankYou: "Thank you for your order.",
    // The business behind the brand, BacLab's (brands/operator.ts): the
    // owner's decision, 5 Nov 2026. Its company details live in config/brand.ts.
    legalName: OPERATOR.legalName,
    company: OPERATOR.company,
    // No mailingList: the trade site runs no list (no popups, no welcome
    // vial), so its signups are refused.
    statementDescriptor: "BULKBAC",
    // Stripe's page shows these (PNG: Stripe takes no SVG), rendered from
    // the same shapes as the site's lockup and icon.
    paymentPage: { logo: "/stripe-logo.png", icon: "/stripe-icon.png" },
    // Stripe, on BacLab's own account and key, as every brand is: the site
    // is declared to Stripe before it takes a payment. Moving to PayPal is
    // this list and PAYPAL_PAYMENT, plus PAYPAL_*__WHOLESALE
    // (deploy/BRAND-PAYMENTS.md).
    paymentProviders: ["stripe"],
    payment: STRIPE_PAYMENT,
    catalogue: wholesaleCatalogue,
  };
}
