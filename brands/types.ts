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
  /** The band behind the name at the top of every email. */
  header: string;
  /** Text on `header`. Defaults to white. */
  onHeader?: string;
  /** Text on `cta` (the email button). Defaults to white. */
  onCta?: string;
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
    /** The address shown to customers in email footers and receipts. "" renders nothing. */
    contact: string;
    /**
     * The address published on the contact page and in the terms, and the
     * inbox contact-form messages are emailed to (CONTACT_FORM_TO overrides
     * the latter for every brand).
     */
    inbox: string;
  };
  reviews: {
    /** Where a review request sends the customer. "" asks for a reply by email instead. */
    url: string;
    /**
     * The brand's own Trustpilot Automatic Feedback Service address, BCC'd on
     * order confirmations; null sends no invitations. Never another brand's:
     * the invitation would tie the two together.
     */
    inviteBcc: string | null;
  };
  /** Compliance line in the email footer. */
  disclaimer: string;
  /** Printed at the foot of every packing slip. */
  packingSlipThankYou: string;
  /**
   * Parcels. Every brand ships from the same warehouse, so the label's
   * address is always the warehouse's; only the name on it can differ.
   */
  shipping?: {
    /**
     * The sender company on the carrier label instead of Warehouse.company.
     * 25 characters or fewer (SmartTrack's limit). Unset: the warehouse's.
     */
    senderCompany?: string;
    /** What the packer puts in with this brand's orders (its box or insert), for the slip and packing screen. */
    packingNote?: string;
  };
  /** Registered company name for legal lines. "" renders nothing. */
  legalName: string;
  /**
   * The brand's own tracking ids. Each brand reports to its own Meta dataset
   * and GA4 property, never another brand's. The Setting
   * `meta_pixel_id:<brand>` beats metaPixelId (lib/settings.ts); the
   * Conversions API token is env META_CAPI_ACCESS_TOKEN__<BRAND>, falling back
   * to META_CAPI_ACCESS_TOKEN (lib/meta-capi.ts). BacLab sets none here: its
   * pixel comes from /admin/settings and NEXT_PUBLIC_META_PIXEL_ID as before.
   */
  analytics?: {
    metaPixelId?: string;
    ga4Id?: string;
  };
}
