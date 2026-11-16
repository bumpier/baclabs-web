/**
 * LuxeVial, the `luxury` brand (name chosen 6 Nov 2026), on luxevial.co.uk from
 * 16 Nov 2026. The palette is claret and limestone
 * (brands/luxury/styles.css). Empty values render
 * nothing, as everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { OPERATOR } from "../operator";
import { STRIPE_PAYMENT } from "../payment-methods";
import { luxuryCatalogue } from "./catalogue";

export function luxuryProfile(): BrandProfile {
  return {
    id: "luxury",
    name: "LuxeVial",
    shortCode: "LV",
    origin: "https://luxevial.co.uk",
    // brands/hosts.json, and the matcher literal in middleware.ts (npm run
    // test:hosts checks the two agree).
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
      // Sent through Resend from mail.luxevial.co.uk, which has no mailbox:
      // replies go to the Hostinger one on the apex.
      from: "LuxeVial <hello@mail.luxevial.co.uk>",
      replyTo: "hello@luxevial.co.uk",
      contact: "hello@luxevial.co.uk",
      inbox: "hello@luxevial.co.uk",
      // The seal inverted (cream wax, claret impression) and the wordmark in
      // cream, on the claret header band (rendered from components/mark-paths.ts).
      logo: { src: "/email-logo.png", width: 200, height: 37 },
      headingFont: "Georgia,'Times New Roman',Times,serif",
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
        "By signing up you agree to receive marketing emails from LuxeVial: news, restocks and new releases. Unsubscribe at any time from any email.",
    },
    // At most ten characters, so it prints whole after any shortened descriptor
    // Stripe allows (10 at most) and its "* ".
    statementDescriptor: "LUXEVIAL",
    // Stripe, on BacLab's own account and key, as every brand is: the site
    // is declared to Stripe before it takes a payment. Moving to PayPal is
    // this list and PAYPAL_PAYMENT, plus PAYPAL_*__LUXURY
    // (deploy/BRAND-PAYMENTS.md).
    paymentProviders: ["stripe"],
    payment: STRIPE_PAYMENT,
    catalogue: luxuryCatalogue,
  };
}
