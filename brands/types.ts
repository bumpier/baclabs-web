/**
 * The shape every storefront brand fills in. One app serves several brands
 * by domain (see brands/registry.ts); everything that differs between them
 * on the backend — emails, packing slips, labels, admin chips — reads it
 * from here rather than from config/brand.ts, which is BacLab's own.
 *
 * Ids are internal and never shown to customers, so a brand can be renamed
 * without touching a single row: Order.brand and friends store the id.
 */

/** Every registered brand. Add the id here when a brand is registered. */
export const BRAND_IDS = ["baclab"] as const;
export type BrandId = (typeof BRAND_IDS)[number];

/** The brand every existing row and unknown host belongs to. */
export const DEFAULT_BRAND: BrandId = "baclab";

/** Literal hex colours, for surfaces that cannot read CSS variables (email, print). */
export interface BrandColours {
  paper: string;
  surface: string;
  neutral: string;
  ink: string;
  inkSoft: string;
  line: string;
  primary: string;
  cta: string;
}

export interface BrandProfile {
  id: BrandId;
  /** The public name, as customers see it. */
  name: string;
  /** Two letters for staff: admin chips and the short order reference. */
  shortCode: string;
  /** Canonical origin, `https://host` with no trailing slash. Email links use it. */
  origin: string;
  /** Hosts that serve this brand (apex and www). Lower-case, no port. */
  domains: string[];
  /** Logo path, served on the brand's own domain. */
  logo: string;
  colours: BrandColours;
  email: {
    /** `Name <address>`, on a domain verified in Resend. */
    from: string;
    /** The address shown to customers. "" renders nothing. */
    contact: string;
  };
  /** Compliance line in the email footer. */
  disclaimer: string;
  /** Printed at the foot of every packing slip. */
  packingSlipThankYou: string;
  /** Registered company name for legal lines. "" renders nothing. */
  legalName: string;
}
