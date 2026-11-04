/**
 * Reserve No.10, the `luxury` brand. A skeleton: the name is a working name,
 * the palette (black and ivory with champagne gold) a placeholder for the
 * design work, and nothing here is live. Empty values render nothing, as
 * everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { PAYPAL_PAYMENT } from "../payment-methods";
import { luxuryCatalogue } from "./catalogue";

export function luxuryProfile(): BrandProfile {
  return {
    id: "luxury",
    name: "Reserve No.10",
    shortCode: "RS",
    // TODO(launch): the brand's https:// apex. Until then, its development host.
    origin: "http://luxury.localhost:3000",
    // TODO(launch): add the apex and www to brands/hosts.json, and to the
    // matcher literal in middleware.ts (npm run test:hosts checks the two agree).
    domains: [...hosts.luxury],
    logo: "/icon.svg",
    colours: {
      paper: "#FBF8F1",
      surface: "#FFFFFF",
      neutral: "#F2EDE2",
      ink: "#0D0D0D",
      inkSoft: "#55504A",
      line: "#E3DBCB",
      primary: "#8C6D2F",
      cta: "#0D0D0D",
      header: "#0D0D0D",
      onHeader: "#F4EBD7",
      onCta: "#FBF8F1",
    },
    email: {
      // TODO(launch): a mailbox on the brand's own domain, verified in Resend.
      from: "Reserve No.10 <hello@luxury.invalid>",
      contact: "",
      inbox: "",
    },
    reviews: { url: "", inviteBcc: null },
    disclaimer:
      "Sold as a laboratory reagent. Not a medicine and not a medical device. No therapeutic claim is made.",
    packingSlipThankYou: "Thank you for your order.",
    legalName: "",
    // TODO(confirm): the wording, with the signup form that shows it.
    mailingList: {
      consentText:
        "By signing up you agree to receive marketing emails from Reserve No.10: news, restocks and new releases. Unsubscribe at any time from any email.",
    },
    // TODO(launch): the final name's statement descriptor.
    statementDescriptor: "RESERVE NO10",
    // PayPal, on this brand's own account (PAYPAL_*__LUXURY; see
    // deploy/BRAND-PAYMENTS.md). A card processor joins once one approves it.
    paymentProviders: ["paypal"],
    payment: PAYPAL_PAYMENT,
    catalogue: luxuryCatalogue,
  };
}
