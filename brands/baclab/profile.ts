/**
 * BacLab's profile. It wraps config/brand.ts and lib/theme.ts rather than
 * copying them, so BacLab's storefront and its backend can never disagree:
 * change the name or a colour there and the emails follow.
 *
 * A function, not a constant, because the sender reads EMAIL_FROM at call
 * time exactly as lib/email.ts always has.
 */
import { brand } from "@/config/brand";
import { LITERAL } from "@/lib/theme";
import { canonicalOrigin } from "@/lib/site-url";
import type { BrandProfile } from "../types";

export function baclabProfile(): BrandProfile {
  return {
    id: "baclab",
    name: brand.name,
    shortCode: "BL",
    origin: canonicalOrigin(),
    domains: ["baclab.co.uk", "www.baclab.co.uk"],
    logo: brand.logo,
    colours: {
      paper: LITERAL.paper,
      surface: LITERAL.surface,
      neutral: LITERAL.neutral,
      ink: LITERAL.ink,
      inkSoft: LITERAL.inkSoft,
      line: LITERAL.line,
      primary: LITERAL.primary,
      cta: LITERAL.cta,
      header: LITERAL.abyss,
    },
    email: {
      from: process.env.EMAIL_FROM || `${brand.name} <noreply@example.com>`,
      contact: brand.contact.email,
      inbox: brand.contact.published,
    },
    reviews: {
      url: brand.reviews.url,
      // BacLab's AFS address is a runtime secret, as it always was.
      inviteBcc: process.env.TRUSTPILOT_BCC_EMAIL ?? null,
    },
    disclaimer: brand.disclaimer,
    packingSlipThankYou: brand.packingSlipThankYou,
    legalName: brand.company.legalName,
  };
}
