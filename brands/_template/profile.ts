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
import { OPERATOR } from "../operator";
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
    // The business behind the brand, BacLab's (brands/operator.ts): the
    // owner's decision, 5 Nov 2026. Its company details live in config/brand.ts.
    legalName: OPERATOR.legalName,
    company: OPERATOR.company,
    shipping: {
      // No senderCompany: the carrier label names the warehouse's company,
      // as every brand's does (the owner, 5 Nov 2026). A name of the brand's
      // own goes here, 25 characters at most. No packingNote: the brand
      // ships in the shared plain box (brands/packaging.ts), so the packer
      // needs none; set one only for a box or insert of the brand's own.
    },
    // No mailingList: the brand runs no list until its consent wording is
    // agreed, so its signups are refused. Add { consentText } together with
    // the signup form that shows those exact words.
    //
    // TODO(launch): the final name's statement descriptor (22 characters at most).
    statementDescriptor: "TEMPLATE BRAND",
    // None until the site has been declared to Stripe as one of BacLab's
    // account's (or the brand has an account of its own with another
    // provider): its site shows no checkout button and its checkout answers
    // 503. Then ["stripe"] and STRIPE_PAYMENT (deploy/BRAND-PAYMENTS.md).
    paymentProviders: [],
    catalogue: templateCatalogue,
  };
}
