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
 * Every registered brand. A new brand is added by scripts/new-brand.ts,
 * which also gives it its hosts in brands/hosts.json, its tree in app/<id>/
 * and every other entry that lists the brands. Registered is not live: a
 * brand serves only on the hosts in hosts.json, which are development hosts
 * until it launches (deploy/NEW-BRAND.md).
 */
export const BRAND_IDS = ["baclab", "beauty", "gym", "wholesale", "luxury"] as const;
export type BrandId = (typeof BRAND_IDS)[number];

/** The brand every existing row and unknown host belongs to. */
export const DEFAULT_BRAND: BrandId = "baclab";

/**
 * Every payment provider a brand checkout can take payment through
 * (lib/commerce/payments). "stripe" is BacLab's own Stripe account, which
 * every brand that lists it shares; every other provider is on the brand's
 * own account. A new provider gets an id here and an adapter there.
 */
export const BRAND_PAYMENT_PROVIDERS = ["stripe", "paypal"] as const;
export type BrandPaymentProviderId = (typeof BRAND_PAYMENT_PROVIDERS)[number];

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
    /**
     * Only for a brand that ships in something other than the shared plain
     * box (a box or insert of its own): what to pack it in, for the slip and
     * the packing screen. Unset: nothing to say, the parcel is the plain box.
     */
    packingNote?: string;
  };
  /**
   * The business that trades as the brand, as its legal lines name it
   * ("BeautyBac is a trading name of BacLab"): its registered name once it
   * has one. Every brand's is BacLab's, from brands/operator.ts (the
   * owner's decision, 5 Nov 2026). "" renders nothing.
   */
  legalName: string;
  /**
   * The business's other details, for the brand's legal pages
   * (lib/commerce/legal.ts), footer and contact page. A registered company
   * must show its number and registered office (Trading Disclosures
   * Regulations 2008). Every brand's are BacLab's, from brands/operator.ts,
   * which reads config/brand.ts. Empty or unset renders nothing.
   */
  company?: {
    number?: string;
    registeredAddress?: string;
    vatNumber?: string;
    icoRegistration?: string;
  };
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
   * The brand's own mailing list. `consentText` is stored against each
   * subscriber as the record of what they agreed to (app/api/subscribe), so
   * the brand's signup form must show these exact words. Unset: the brand
   * runs no list and its site's signups are refused. BacLab's is
   * config/funnel.ts MAILING_LIST, as always.
   */
  mailingList?: { consentText: string };
  /**
   * The payment providers the brand's checkout may take payment through, in
   * the order its buy section offers them (lib/commerce/payments), so a
   * provider reaches a brand only by being listed here. Then:
   *  - "stripe" is BacLab's own Stripe account and key, used while BacLab's
   *    card payments are on (STRIPE_ENABLED and both keys). There is no
   *    per-brand key: the brand is one more website of that account, and
   *    must be declared to Stripe before it is listed here
   *    (deploy/BRAND-PAYMENTS.md).
   *  - any other provider is used only while the brand's OWN credentials for
   *    it are set, by the brand's id, with no shared or fallback account.
   * Moving a brand from one to another is this list plus that provider's
   * credentials, and nothing else. The storefront's checkout button follows
   * this list alone, because the pages are built without the runtime env:
   * listed but not configured, the button shows and the checkout answers
   * 503 in neutral words. Empty or unset: the brand takes no payment, its
   * storefront shows no checkout button and its checkout answers 503.
   */
  paymentProviders?: readonly BrandPaymentProviderId[];
  /**
   * How the brand takes payment, as its storefront and its legal pages
   * describe it (lib/commerce/storefront.ts, lib/commerce/legal.ts): one
   * method per provider in paymentProviders, by the same id. Unset: both stay
   * method-neutral ("the payment methods shown at checkout") and name no
   * provider. Nothing on a brand's pages may name a provider except through
   * it.
   */
  payment?: BrandPayment;
  /**
   * What the customer's statement shows for the brand, after the payment
   * provider's own prefix: the brand checkout sends it with every payment
   * (lib/commerce/payments). 22 characters at most, letters required, none of
   * < > \ ' " *. On Stripe it follows the account's shortened descriptor,
   * "<prefix>* <this>", and the whole must fit in 22 (npm run check:brands
   * holds it to that). Neutral, like the line items. Unset: the provider's
   * account default. BacLab sets none: its Stripe sessions are built as they
   * always were.
   */
  statementDescriptor?: string;
  /**
   * The brand's images on a payment provider's own page, in place of the
   * account's: Stripe's Checkout shows BacLab's logo and icon (the account's
   * branding) unless a session sends others, so a Stripe brand needs both
   * before launch. Paths on the brand's origin, served from public/<id>/,
   * PNG or JPG (Stripe takes no SVG, so `logo` cannot stand in), the icon
   * square. Sent only once the origin is https, because Stripe fetches them.
   */
  paymentPage?: { logo?: string; icon?: string };
  /**
   * What the brand sells and how it is delivered (brands/<id>/catalogue.ts):
   * the brand checkout (lib/commerce/checkout.ts) prices every line from it,
   * and its emails and finance read it back. BacLab has none: its packs,
   * prices and Stripe Prices are config/funnel.ts, and its checkout never
   * comes near this.
   */
  catalogue?: BrandCatalogue;
}

/** A way to pay, as the storefront and the terms describe it. */
export interface BrandPaymentMethod {
  /** The provider's id in paymentProviders: the checkout request's `method`. */
  id: string;
  /** "Bank transfer": what the buy section shows. */
  label: string;
  /** One sentence for the terms: how and when payment is taken by this method. */
  terms: string;
  /** One sentence for the returns policy: how a refund goes back by this method. Unset: the neutral wording. */
  refunds?: string;
}

/** Someone who handles payment data for the brand, for its privacy notice. */
export interface BrandPaymentProcessor {
  /** The company, as the privacy notice names it. */
  name: string;
  /** What it does for us, after a colon: "payment processing and refunds". */
  purpose: string;
  /** Its own privacy policy, an https URL. */
  privacyUrl?: string;
  /** It is a controller of the payment data in its own right, not our processor. */
  separateController?: boolean;
  /** Anything else the notice must say about it (its own cookies on its own page). */
  note?: string;
}

export interface BrandPayment {
  methods: readonly BrandPaymentMethod[];
  processors: readonly BrandPaymentProcessor[];
}

// ── Catalogues ──────────────────────────────────────────────────────
// Every brand sells the same neutral 10ml vial, in the same plain box
// (brands/packaging.ts). A pack is therefore one SKU per brand and size, made
// up in the warehouse as a kit: N × the shared vial + 1 × the box
// (scripts/seed-brand-skus.ts). Vial and box stock are shared.

/** One pack a brand sells. */
export interface CataloguePack {
  /** Stable within the brand ("x10"). Never shown. */
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
  /**
   * The box every pack ships in: the one non-vial component of each pack's
   * kit SKU. PLAIN_BOX_SKU (brands/packaging.ts), shared by every brand,
   * unless the brand ships in a box of its own.
   */
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
   * Whether the checkout takes promotion codes. false for every brand. The
   * Stripe sessions never take one whatever this says: the codes on that
   * account are BacLab's, and none may discount another brand's order.
   */
  allowPromotionCodes: boolean;
  /** Ask trade buyers for a company name and VAT number with the order. */
  collectBusinessDetails: boolean;
  /**
   * Offer a gift note with the order: a few words the buyer writes on our
   * page, printed on the packing slip for the packer to put in the box. The
   * checkout keeps it on the order and never sends it to the payment
   * provider (lib/commerce/gift-note.ts), and refuses one wherever this is
   * false.
   */
  collectGiftNote: boolean;
}
