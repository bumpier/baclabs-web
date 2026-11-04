/**
 * Aurelle, the `beauty` brand. A skeleton: the name is a working name, the
 * palette (porcelain and blush with deep plum ink) a placeholder for the
 * design work, and nothing here is live. Empty values render nothing, as
 * everywhere else.
 */
import hosts from "../hosts.json";
import type { BrandProfile } from "../types";
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
    colours: {
      paper: "#FBF7F4",
      surface: "#FFFFFF",
      neutral: "#F5ECE8",
      ink: "#3A1F33",
      inkSoft: "#6E5566",
      line: "#EBDDD7",
      primary: "#7A3B63",
      cta: "#7A3B63",
      header: "#F5ECE8",
      onHeader: "#3A1F33",
      onCta: "#FFFFFF",
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
    legalName: "",
    // TODO(confirm): the wording, with the signup form that shows it.
    mailingList: {
      consentText:
        "By signing up you agree to receive marketing emails from Aurelle: offers, restocks and new sets. Unsubscribe at any time from any email.",
    },
    // TODO(launch): the final name's descriptor, and PNG logo and icon for Stripe's page.
    stripe: { statementDescriptorSuffix: "AURELLE" },
    catalogue: beautyCatalogue,
  };
}
