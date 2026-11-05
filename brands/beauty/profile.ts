/**
 * Aurelle, the `beauty` brand. The name is a working name, the palette is
 * the storefront's (porcelain and blush with deep plum ink), and nothing
 * here is live. Empty values render nothing, as everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { OPERATOR } from "../operator";
import { STRIPE_PAYMENT } from "../payment-methods";
import { beautyCatalogue } from "./catalogue";

export function beautyProfile(): BrandProfile {
  return {
    id: "beauty",
    name: "Aurelle",
    shortCode: "AU",
    // TODO(launch): the brand's https:// apex. Until then, its development host.
    origin: "http://beauty.localhost:3000",
    // TODO(launch): add the apex and www to brands/hosts.json, and to the
    // matcher literal in middleware.ts (npm run test:hosts checks the two agree).
    domains: [...hosts.beauty],
    logo: "/icon.svg",
    // The wordmark and the mark on Stripe's page, as PNG (Stripe takes no
    // SVG): sent once the origin is https (lib/commerce/payments/stripe.ts).
    paymentPage: { logo: "/payment-logo.png", icon: "/payment-icon.png" },
    // The storefront's own palette (brands/beauty/styles.css): porcelain,
    // blush and plum ink, for the theme colour, the manifest and the emails.
    colours: {
      paper: "#F8F3F3",
      surface: "#FFFCFB",
      neutral: "#F2DFDC",
      ink: "#3B1730",
      inkSoft: "#6A4660",
      line: "#E6D0CC",
      primary: "#3B1730",
      cta: "#3B1730",
      header: "#F2DFDC",
      onHeader: "#3B1730",
      onCta: "#FBF6F5",
    },
    email: {
      // TODO(launch): a mailbox on the brand's own domain, verified in Resend.
      from: "Aurelle <hello@beauty.invalid>",
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
        "By signing up you agree to receive marketing emails from Aurelle: offers, restocks and new sets. Unsubscribe at any time from any email.",
    },
    // TODO(launch): the final name's statement descriptor.
    statementDescriptor: "AURELLE",
    // Stripe, on BacLab's own account and key, as every brand is: the site
    // is declared to Stripe before it takes a payment. Moving to PayPal is
    // this list and PAYPAL_PAYMENT, plus PAYPAL_*__BEAUTY
    // (deploy/BRAND-PAYMENTS.md).
    paymentProviders: ["stripe"],
    payment: STRIPE_PAYMENT,
    catalogue: beautyCatalogue,
  };
}
