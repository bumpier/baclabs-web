/**
 * Reserve No.10, the `luxury` brand. A skeleton: the name is a working name,
 * the palette (claret and limestone, brands/luxury/styles.css) the house's, and
 * nothing here is live. Empty values render nothing, as
 * everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { STRIPE_PAYMENT } from "../payment-methods";
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
    // Stripe's page shows these (PNG: Stripe takes no SVG), rendered from
    // components/mark-paths.ts: the seal beside the wordmark, and the seal
    // alone as the favicon draws it. Sent once the origin is https.
    paymentPage: { logo: "/payment-logo.png", icon: "/payment-icon.png" },
    colours: {
      paper: "#E4E1DC",
      surface: "#F2EFEB",
      neutral: "#D9D5CF",
      ink: "#1D1819",
      inkSoft: "#5B5456",
      line: "#CBC6C0",
      primary: "#4A1424",
      cta: "#4A1424",
      header: "#4A1424",
      onHeader: "#F1E9E6",
      onCta: "#F1E9E6",
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
    // Stripe, on BacLab's own account and key, as every brand is: the site
    // is declared to Stripe before it takes a payment. Moving to PayPal is
    // this list and PAYPAL_PAYMENT, plus PAYPAL_*__LUXURY
    // (deploy/BRAND-PAYMENTS.md).
    paymentProviders: ["stripe"],
    payment: STRIPE_PAYMENT,
    catalogue: luxuryCatalogue,
  };
}
