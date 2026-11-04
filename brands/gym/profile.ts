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
    // TODO(launch): the final name's descriptor, and PNG logo and icon for Stripe's page.
    stripe: { statementDescriptorSuffix: "BRUTE LAB" },
    catalogue: gymCatalogue,
  };
}
