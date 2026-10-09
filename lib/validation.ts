import { z } from "zod";
import { PLAN_PACK_IDS } from "@/config/plans";
import {
  BUNDLES,
  DELIVERY_OPTIONS,
  MAX_EXTRA_VIALS,
  MAX_QUANTITY,
  MIN_QUANTITY,
  type DeliveryOptionId,
} from "@/config/funnel";

// Every form input and API body is validated with these schemas
// server-side before touching the database. All .strict().

/** Tier ids, derived from config so a new bundle cannot be forgotten here. */
const bundleIdEnum = z.enum(BUNDLES.map((b) => b.id) as [string, ...string[]]);

const bundleOrderFields = {
  tierId: bundleIdEnum,
  /** Number of BUNDLES, not vials. 2 × starter = 6 vials. */
  quantity: z.number().int().min(MIN_QUANTITY).max(MAX_QUANTITY),
  /**
   * Loose single vials on top of the packs. Absent means none. The route
   * prices them (priceOrder) and refuses them on the single tier.
   */
  extraVials: z.number().int().min(0).max(MAX_EXTRA_VIALS).optional(),
  /**
   * Whether the visitor had accepted tracking on the cookie banner. Decides
   * whether the purchase is reported to Meta from the server
   * (lib/meta-capi.ts). Absent means no.
   */
  trackingConsent: z.boolean().optional(),
};

/**
 * Card path. Deliberately carries no address: Stripe Checkout collects the
 * delivery address, and the webhook backfills it onto the order.
 */
export const CardCheckoutSchema = z
  .object({ ...bundleOrderFields, method: z.literal("card") })
  .strict();

/**
 * Crypto path. The gateway returns only a wallet and a QR — there is no
 * hosted page to collect an address — so this path must gather one itself.
 */
export const CryptoCheckoutSchema = z
  .object({
    ...bundleOrderFields,
    method: z.enum(["btc", "eth", "usdt", "xmr"]),
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().max(254),
    phone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/),
    addressLine1: z.string().min(3).max(200).trim(),
    addressLine2: z.string().max(200).trim().optional().or(z.literal("")),
    city: z.string().min(2).max(100).trim(),
    postalCode: z.string().min(2).max(20).trim(),
    country: z.string().length(2).toUpperCase(),
    /**
     * Required by the route whenever options are offered. The price is not
     * taken from here: the route looks it up.
     */
    deliveryOption: z.enum(DELIVERY_OPTIONS.map((o) => o.id) as [DeliveryOptionId, ...DeliveryOptionId[]]).optional(),
    /** For the carrier, onto the label. SmartTrack takes 30 characters. */
    deliveryInstructions: z.string().max(30).trim().optional().or(z.literal("")),
  })
  .strict();

/**
 * Monthly plan (config/plans.ts). Card only: a plan is one Stripe payment.
 * Carries a pack and a term, never an amount; the route prices it.
 */
export const PlanCheckoutSchema = z
  .object({
    method: z.literal("card"),
    plan: z
      .object({
        pack: z.enum(PLAN_PACK_IDS),
        months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
      })
      .strict(),
    trackingConsent: z.boolean().optional(),
  })
  .strict();

export const CheckoutSchema = z.union([CardCheckoutSchema, CryptoCheckoutSchema, PlanCheckoutSchema]);

/** Turning a paid one-off order into box 1 of a plan (lib/plans/upgrade.ts). Never an amount. */
export const PlanUpgradeSchema = z
  .object({
    orderId: z.string().uuid(),
    months: z.union([z.literal(6), z.literal(12)]),
    trackingConsent: z.boolean().optional(),
  })
  .strict();
export type PlanUpgradeInput = z.infer<typeof PlanUpgradeSchema>;

export type CardCheckoutInput = z.infer<typeof CardCheckoutSchema>;
export type CryptoCheckoutInput = z.infer<typeof CryptoCheckoutSchema>;
export type PlanCheckoutInput = z.infer<typeof PlanCheckoutSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/**
 * Mailing-list signup. `website` is the honeypot: a hidden field people never
 * see, so anything in it is a bot. Accepted as any string so the route can
 * answer a bot exactly as it answers a person.
 */
export const SubscribeSchema = z
  .object({
    email: z.string().trim().email().max(254),
    source: z.enum(["popup", "footer", "inline"]),
    website: z.string().max(200).optional(),
  })
  .strict();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const LoginSchema = z
  .object({
    email: z.string().email().max(254).toLowerCase(),
    password: z.string().min(1).max(128),
  })
  .strict();

// Positive, not just non-negative: a blank box coerces to 0, and a zero price
// would become the amount charged.
const priceField = z.coerce.number().positive("Enter a price above 0").max(1_000_000);

/**
 * Admin product form. Bundle rows are normally managed by
 * scripts/stripe-setup.ts; this exists for stock and packing corrections.
 */
export const ProductSchema = z
  .object({
    name: z.string().min(2).max(150).trim(),
    slug: z
      .string()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
    description: z.string().min(10).max(5000).trim(),
    priceGbp: priceField,
    stock: z.coerce.number().int().min(0).max(1_000_000),
    weightGrams: z.coerce.number().int().min(0).max(1_000_000),
    supplyDays: z.coerce.number().int().min(0).max(3650),
    active: z.coerce.boolean(),
  })
  .strict();

/** CSRF protection: mutating API routes must come from our own origin. */
export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("host");
  try {
    const o = new URL(origin);
    if (host && o.host === host) return true;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site && o.origin === new URL(site).origin) return true;
    return false;
  } catch {
    return false;
  }
}
