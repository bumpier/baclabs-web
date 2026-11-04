/**
 * Vialhouse, the `wholesale` brand. A skeleton: the name is a working name,
 * the palette (slate and navy with one signal green) a placeholder for the
 * design work, and nothing here is live. Empty values render nothing, as
 * everywhere else.
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
      neutral: "#F1F4F7",
      ink: "#0F1B2D",
      inkSoft: "#4A5A70",
      line: "#DCE2EA",
      primary: "#1E3A5F",
      cta: "#12784A",
      header: "#1E2A38",
      onHeader: "#FFFFFF",
      onCta: "#FFFFFF",
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
    // Stripe, on BacLab's own account and key, as every brand is: the site
    // is declared to Stripe before it takes a payment. Moving to PayPal is
    // this list and PAYPAL_PAYMENT, plus PAYPAL_*__WHOLESALE
    // (deploy/BRAND-PAYMENTS.md).
    paymentProviders: ["stripe"],
    payment: STRIPE_PAYMENT,
    catalogue: wholesaleCatalogue,
  };
}
