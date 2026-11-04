/**
 * Brute Lab, the `gym` brand. A skeleton: the name is a working name, the
 * palette (black and concrete with hazard orange) a placeholder for the
 * design work, and nothing here is live. Empty values render nothing, as
 * everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
import { gymCatalogue } from "./catalogue";

export function gymProfile(): BrandProfile {
  return {
    id: "gym",
    name: "Brute Lab",
    shortCode: "BR",
    // TODO(launch): the brand's https:// apex. Until then, its development host.
    origin: "http://gym.localhost:3000",
    // TODO(launch): add the apex and www to brands/hosts.json, and to the
    // matcher literal in middleware.ts (npm run test:hosts checks the two agree).
    domains: [...hosts.gym],
    logo: "/icon.svg",
    colours: {
      paper: "#F2F1EE",
      surface: "#FFFFFF",
      neutral: "#E4E2DD",
      ink: "#111111",
      inkSoft: "#4A4A4A",
      line: "#D6D3CC",
      primary: "#C2410C",
      cta: "#C2410C",
      header: "#111111",
      onHeader: "#F2F1EE",
      onCta: "#FFFFFF",
    },
    email: {
      // TODO(launch): a mailbox on the brand's own domain, verified in Resend.
      from: "Brute Lab <hello@gym.invalid>",
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
        "By signing up you agree to receive marketing emails from Brute Lab: offers, restocks and new pack sizes. Unsubscribe at any time from any email.",
    },
    // TODO(launch): the final name's statement descriptor.
    statementDescriptor: "BRUTE LAB",
    // None, on purpose: checkout stays off until a specialist high-risk
    // processor takes this brand on, with its copy disclosed. Never PayPal,
    // and never an account another brand uses: PayPal's Acceptable Use
    // Policy bans what this brand's coded copy alludes to (the wording is
    // quoted in deploy/BRAND-PAYMENTS.md), so a freeze over it would take
    // every brand on that account down with it. An empty list wins over any
    // credentials in env.
    paymentProviders: [],
    catalogue: gymCatalogue,
  };
}
