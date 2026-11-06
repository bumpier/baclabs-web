/**
 * GymWater, the `gym` brand (name chosen 6 Nov 2026; its domain,
 * gymwater.co.uk, is still to buy). Nothing here is live. The palette is the site's (black, steel and hazard yellow, see
 * brands/gym/styles.css). Empty values render nothing, as everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { OPERATOR } from "../operator";
import { STRIPE_PAYMENT } from "../payment-methods";
import { gymCatalogue } from "./catalogue";

export function gymProfile(): BrandProfile {
  return {
    id: "gym",
    name: "GymWater",
    shortCode: "GW",
    // TODO(launch): https://gymwater.co.uk, the brand's apex. Until then, its development host.
    origin: "http://gym.localhost:3000",
    // TODO(launch): add the apex and www to brands/hosts.json, and to the
    // matcher literal in middleware.ts (npm run test:hosts checks the two agree).
    domains: [...hosts.gym],
    logo: "/icon.svg",
    // Stripe's page shows these (PNG: Stripe takes no SVG), rendered from
    // components/Logo.tsx: the lockup as the header sets it, and the mark,
    // which is also the favicon. Sent once the origin is https.
    paymentPage: { logo: "/payment-logo.png", icon: "/payment-icon.png" },
    // The emails', the packing slip's and the payment page's colours: the
    // site's own on light paper. Hazard yellow is the button (black on it,
    // 12:1), never a link or a text colour on paper, where it cannot be read.
    colours: {
      paper: "#EEEFF0",
      surface: "#FFFFFF",
      neutral: "#E4E5E7",
      ink: "#000000",
      inkSoft: "#45484E",
      line: "#D2D4D8",
      primary: "#000000",
      cta: "#F5C400",
      header: "#000000",
      onHeader: "#F5C400",
      onCta: "#000000",
    },
    email: {
      // TODO(launch): a mailbox on the brand's own domain, verified in Resend.
      from: "GymWater <hello@gym.invalid>",
      contact: "",
      inbox: "",
    },
    reviews: { url: "", inviteBcc: null },
    disclaimer:
      "Sold as a laboratory reagent. Not a medicine and not a medical device. No therapeutic claim is made.",
    packingSlipThankYou: "Thank you for your order.",
    // The business behind the brand, BacLab's (brands/operator.ts): the
    // owner's decision, 5 Nov 2026. Its company details live in config/brand.ts.
    legalName: OPERATOR.legalName,
    company: OPERATOR.company,
    // TODO(confirm): the wording, with the signup form that shows it.
    mailingList: {
      consentText:
        "By signing up you agree to receive marketing emails from GymWater: offers, restocks and new pack sizes. Unsubscribe at any time from any email.",
    },
    statementDescriptor: "GYMWATER",
    // Stripe, on BacLab's own account and key, as every brand is (the
    // owner's decision, 4 Nov 2026): the site is declared to Stripe before
    // it takes a payment, and only neutral words reach Stripe (the line
    // names, the descriptor, the delivery), never this brand's copy. Never
    // PayPal: its Acceptable Use Policy bans what this brand's coded copy
    // alludes to (quoted in deploy/BRAND-PAYMENTS.md).
    paymentProviders: ["stripe"],
    payment: STRIPE_PAYMENT,
    catalogue: gymCatalogue,
  };
}
