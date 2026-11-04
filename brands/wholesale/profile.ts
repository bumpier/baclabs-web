/**
 * Vialhouse, the `wholesale` brand: a trade supplier's site (the name is a
 * working name, and nothing here is live). Spruce and white with one signal
 * yellow, the vial-rack mark (brands/wholesale/components/logo.tsx); the
 * stylesheet's opening comment holds the whole direction. Empty values
 * render nothing, as everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { STRIPE_PAYMENT } from "../payment-methods";
import { wholesaleCatalogue } from "./catalogue";

export function wholesaleProfile(): BrandProfile {
  return {
    id: "wholesale",
    name: "Vialhouse",
    shortCode: "VH",
    // TODO(launch): the brand's https:// apex. Until then, its development host.
    origin: "http://wholesale.localhost:3000",
    // TODO(launch): add the apex and www to brands/hosts.json, and to the
    // matcher literal in middleware.ts (npm run test:hosts checks the two agree).
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
      // TODO(launch): a mailbox on the brand's own domain, verified in Resend.
      from: "Vialhouse <hello@wholesale.invalid>",
      contact: "",
      inbox: "",
    },
    reviews: { url: "", inviteBcc: null },
    disclaimer:
      "Sold as a laboratory reagent. Not a medicine and not a medical device. No therapeutic claim is made.",
    packingSlipThankYou: "Thank you for your order.",
    legalName: "",
    // No mailingList: the trade site runs no list (no popups, no welcome
    // vial), so its signups are refused.
    // TODO(launch): the final name's statement descriptor.
    statementDescriptor: "VIALHOUSE",
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
