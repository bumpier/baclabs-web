/**
 * The shape every storefront brand fills in. One app serves several brands
 * by domain (see brands/registry.ts); everything that differs between them
 * on the backend — emails, packing slips, labels, admin chips — reads it
 * from here rather than from config/brand.ts, which is BacLab's own.
 *
 * Ids are internal and never shown to customers, so a brand can be renamed
 * without touching a single row: Order.brand and friends store the id.
 */

/**
 * Every registered brand. Add the id here when a brand is registered (and,
 * for any brand but BacLab, its hosts to brands/hosts.json and its tree to
 * app/<id>/). Registered is not live: a brand serves only on the hosts in
 * hosts.json, which are development hosts until it launches.
 */
export const BRAND_IDS = ["baclab", "beauty", "gym", "wholesale", "luxury"] as const;
export type BrandId = (typeof BRAND_IDS)[number];

/** The brand every existing row and unknown host belongs to. */
export const DEFAULT_BRAND: BrandId = "baclab";

import type { DeliveryOption } from "@/config/funnel";

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
  /**
   * The brand on Stripe's page and the card statement (lib/commerce/checkout.ts).
   * BacLab sets none: its sessions are built as they always were.
   */
  stripe?: {
    /**
     * After the account's own prefix on the customer's card statement:
     * "PREFIX* SUFFIX", 22 characters at most in all, letters required, none
     * of < > \ ' " *. Neutral, like the line items.
     */
    statementDescriptorSuffix?: string;
    /**
     * Stripe's page shows these instead of the account's own. Paths on the
     * brand's origin, used only once it is https (Stripe fetches them), and
     * PNG or JPG, square, 128px or more: Stripe takes no SVG, so the
     * profile's `logo` cannot stand in.
     */
    logo?: string;
    icon?: string;
  };
  /**
   * What the brand sells and how it is delivered (brands/<id>/catalogue.ts):
   * the brand checkout (lib/commerce/checkout.ts) prices every line from it,
   * and its emails and finance read it back. BacLab has none: its packs,
   * prices and Stripe Prices are config/funnel.ts, and its checkout never
   * comes near this.
   */
  catalogue?: BrandCatalogue;
}

// ── Catalogues ──────────────────────────────────────────────────────
// Every brand sells the same neutral 10ml vial, packed in its own box. A
// pack is therefore one SKU per brand and size, made up in the warehouse as
// a kit: N × the shared vial + 1 × the brand's box (scripts/seed-brand-skus.ts).
// Vial stock is shared; only the box is the brand's.

/** One pack a brand sells. */
export interface CataloguePack {
  /** Stable within the brand ("x10"). Never shown; the stem of its Stripe Product. */
  id: string;
  /**
   * The pack's SKU, `${parentSku}-X${vials}`: what the storefront sends to
   * the checkout, the warehouse kit it ships as, the line's `sku` on the
   * order and the brand's Meta content id. Unique across every brand.
   */
  sku: string;
  vials: number;
  /** One pack, in pence. */
  priceMinor: number;
  /** The storefront's name or badge for it. "" renders nothing. */
  label: string;
  /**
   * false: listed (the storefront may show it, quote only) but never sold.
   * The checkout refuses it, so a pack can be withdrawn by config alone.
   */
  available: boolean;
}

/** Something sold beside the packs, from shared stock. */
export interface CatalogueAddOn {
  id: string;
  /**
   * The brand's own code for it, sent by the storefront and recorded as the
   * line's `sku`. Never another brand's: it reaches the brand's pages and
   * its Meta dataset. What it ships as is `ships`, not this.
   */
  sku: string;
  /** On the order, the receipt and the packing slip. Neutral. */
  name: string;
  priceMinor: number;
  available: boolean;
  /**
   * The shared stock it ships from. "lab-kit": the Lab Kit (config/funnel.ts
   * LAB_KIT), its Product row and its kit SKU, so the packer gets the same
   * parts list as for a BacLab kit. One per vial at most, as there.
   */
  ships: "lab-kit";
}

export interface BrandCatalogue {
  /** The stem of every pack SKU, and Meta's parent id for them ("LUX-10ML"). */
  parentSku: string;
  /** The brand's box: the one non-vial component of every pack's kit SKU. */
  boxSku: string;
  /** In the order the storefront lists them: smallest first. */
  packs: readonly CataloguePack[];
  addOns: readonly CatalogueAddOn[];
  delivery: {
    /**
     * The options offered at checkout, priced for this brand. They are
     * config/funnel.ts DELIVERY_OPTIONS records, so the ids are BacLab's
     * own ("standard", "next_day"): the label buyer (lib/shipping) knows
     * which SmartTrack services fulfil each one only by those ids.
     * `priceMinor` and `overThreshold` are read as in config/funnel.ts.
     */
    options: readonly DeliveryOption[];
    /** Goods value, in pence, at or above which the over-threshold prices apply. null: never. */
    freeFromMinor: number | null;
  };
  /**
   * Most vials one order may hold. The services the label buyer can use
   * today stop at 2 kg, which is why the 250-vial packs and up are not
   * available; this keeps several smaller packs from adding up past it.
   */
  maxVials: number;
  /**
   * The env var naming the brand's persistent Stripe Products
   * (`STRIPE_PRODUCT__<ID>`, printed by `scripts/stripe-setup.ts --brand`).
   * Unset, the checkout names each line inline and says so in the log.
   */
  stripeProductEnv: string;
  /** Whether Stripe's page takes promotion codes. false for every brand in v1. */
  allowPromotionCodes: boolean;
  /** Ask for a company name and VAT number on Stripe's page (trade buyers). */
  collectBusinessDetails: boolean;
}
