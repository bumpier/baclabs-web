// TEMPLATE: brands/_template/ is the starting point for a new brand, never a
// brand itself. It is not registered, routed or bundled, and Tailwind never
// scans it (app/globals.css has `@source not "../brands"`). tsc checks it, so
// it keeps up with the platform, and npm run check:brands holds its copy to
// every brand's rules. scripts/new-brand.ts copies it to brands/<id>/,
// app/<id>/ and public/<id>/, fills in the name, id, domain and codes,
// registers the brand and drops these lines. deploy/NEW-BRAND.md is the
// whole procedure.

/**
 * Template Brand, the `_template` brand. A skeleton: the palette is a neutral
 * placeholder for the design work, and nothing here is live. It takes no
 * payment and runs no mailing list until those are set: empty values render
 * nothing, as everywhere else.
 */
import type { BrandId, BrandProfile } from "../types";
import { templateCatalogue } from "./catalogue";

export function templateProfile(): BrandProfile {
  return {
    id: "_template" as BrandId,
    name: "Template Brand",
    shortCode: "TB",
    // TODO(launch): the brand's https:// apex (https://template.invalid). Until then, its development host.
    origin: "http://_template.localhost:3000",
    // TODO(launch): add template.invalid and www.template.invalid to brands/hosts.json, and to the
    // matcher literal in middleware.ts (npm run test:hosts checks the two agree).
    domains: ["_template.localhost"],
    logo: "/icon.svg",
    colours: {
      paper: "#FAFAF9",
      surface: "#FFFFFF",
      neutral: "#F1F1EF",
      ink: "#1C1C1A",
      inkSoft: "#57534E",
      line: "#E2E1DD",
      primary: "#44403C",
      cta: "#1C1C1A",
      header: "#1C1C1A",
      onHeader: "#FAFAF9",
      onCta: "#FFFFFF",
    },
    email: {
      // TODO(launch): verify template.invalid in Resend, and set the contact and inbox addresses.
      from: "Template Brand <hello@template.invalid>",
      contact: "",
      inbox: "",
    },
    reviews: { url: "", inviteBcc: null },
    disclaimer:
      "Sold as a laboratory reagent. Not a medicine and not a medical device. No therapeutic claim is made.",
    packingSlipThankYou: "Thank you for your order.",
    // TODO(launch): the company that trades as the brand, with its number and registered office.
    legalName: "",
    shipping: {
      // TODO(confirm): the sender name on the carrier label (25 characters at most).
      senderCompany: "Template Brand",
      packingNote: "Template Brand box",
    },
    // No mailingList: the brand runs no list until its consent wording is
    // agreed, so its signups are refused. Add { consentText } together with
    // the signup form that shows those exact words.
    //
    // TODO(launch): the final name's statement descriptor (22 characters at most).
    statementDescriptor: "TEMPLATE BRAND",
    // None until the brand has a payment account of its own: its site shows
    // no checkout button and its checkout answers 503. A provider is added
    // here and given the brand's own credentials (deploy/NEW-BRAND.md).
    paymentProviders: [],
    catalogue: templateCatalogue,
  };
}
