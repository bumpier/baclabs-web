import Stripe from "stripe";
import {
  BUNDLES,
  bundleById,
  deliveryChoiceEnabled,
  deliveryDetailAt,
  deliveryOptionById,
  deliveryOptionsFor,
  dispatchNoticeAt,
  shipsFree,
  KIT_PRICES,
  MAILING_LIST,
  STARTER_KIT,
  PRODUCT,
  type BundleId,
  type DeliveryOptionId,
  type KitTier,
} from "@/config/funnel";
import { planFreeLine, type PlanPrice } from "@/config/plans";
import { BRAND_IDS, DEFAULT_BRAND } from "@/brands/types";

let _stripe: Stripe | null = null;

/** Pinned so an SDK bump can never silently change the wire contract. Keep it in step with the installed SDK's LatestApiVersion. */
const API_VERSION = "2026-07-29.dahlia" as const;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: API_VERSION });
  return _stripe;
}

// ── One Stripe account per brand, by config alone ────────────────────
// Every brand shares BacLab's Stripe account until it is given its own:
// set STRIPE_SECRET_KEY__<ID> (and STRIPE_WEBHOOK_SECRET__<ID> for its
// webhook endpoint) and that brand's sessions, lookups and webhook events
// move to that account, with no code change. BacLab is always the shared
// account, so with only the shared env set nothing differs from before.

/** `STRIPE_SECRET_KEY__GYM`: a brand's own value of a shared Stripe setting. */
export function brandStripeEnv(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET", brandId: string): string {
  return `${name}__${brandId.toUpperCase()}`;
}

/** The secret key a brand's Stripe calls use: its own account's when set, else the shared one. */
export function stripeKeyFor(brandId: string): string | undefined {
  if (brandId !== DEFAULT_BRAND) {
    const own = process.env[brandStripeEnv("STRIPE_SECRET_KEY", brandId)]?.trim();
    if (own) return own;
  }
  return process.env.STRIPE_SECRET_KEY;
}

const brandClients = new Map<string, Stripe>();

/**
 * The Stripe client for a brand's account. The shared account's is
 * getStripe() itself, so BacLab, and every brand without its own key, gets
 * the very same client as before.
 */
export function stripeFor(brand: { id: string }): Stripe {
  const key = stripeKeyFor(brand.id);
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (key === process.env.STRIPE_SECRET_KEY) return getStripe();
  let client = brandClients.get(key);
  if (!client) {
    client = new Stripe(key, { apiVersion: API_VERSION });
    brandClients.set(key, client);
  }
  return client;
}

/** Convert a pence figure to the major-unit string Stripe reports back. */
export function minorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

// Price lookups are cached per process: the Price is immutable once created,
// so a hit can never go stale within a deployment.
const priceCache = new Map<string, Stripe.Price>();

async function retrievePrice(priceId: string): Promise<Stripe.Price> {
  const hit = priceCache.get(priceId);
  if (hit) return hit;
  const price = await getStripe().prices.retrieve(priceId);
  priceCache.set(priceId, price);
  return price;
}

/**
 * Confirm the configured Stripe Price actually charges what config/funnel.ts
 * says it does, before a customer is sent to it.
 *
 * This exists because the Price ID lives in an env var while the price lives
 * in code. Point STRIPE_PRICE_STARTER at the wrong Price and, without this,
 * the page would advertise £39.00 and the card would be charged something
 * else. There is no tolerance: a failed checkout always beats a wrong charge.
 */
export async function assertPriceMatchesConfig(bundleId: BundleId, priceId: string): Promise<void> {
  const bundle = bundleById(bundleId);
  if (!bundle) throw new Error(`Unknown bundle ${bundleId}`);
  await assertPriceCharges(priceId, bundle.priceMinor, `bundle ${bundleId}`);
}

/** The same check for a Lab Kit tier's Price (KIT_PRICES). */
export async function assertKitPriceMatchesConfig(tier: KitTier, priceId: string): Promise<void> {
  await assertPriceCharges(priceId, KIT_PRICES[tier], `kit tier ${tier}`);
}

/** The same check for the Starter Kit's Price (STARTER_KIT). */
export async function assertStarterKitPriceMatchesConfig(priceId: string): Promise<void> {
  await assertPriceCharges(priceId, STARTER_KIT.priceMinor, "the Starter Kit");
}

async function assertPriceCharges(priceId: string, expectedMinor: number, what: string): Promise<void> {
  const price = await retrievePrice(priceId);
  if (!price.active) {
    throw new Error(`Stripe price ${priceId} for ${what} is archived`);
  }
  if (price.currency !== "gbp") {
    throw new Error(`Stripe price ${priceId} is in ${price.currency}, expected gbp (${what})`);
  }
  if (price.unit_amount !== expectedMinor) {
    throw new Error(
      `Stripe price ${priceId} charges ${price.unit_amount} but ${what} is configured at ${expectedMinor}. Re-run scripts/stripe-setup.ts and update the env var.`
    );
  }
}

export interface BundleCheckoutParams {
  orderId: string;
  bundleId: BundleId;
  priceId: string;
  quantity: number;
  /**
   * Loose single vials on top of the packs (priceOrder), charged at the
   * single tier's Price, which the caller has reconciled like the pack's.
   */
  extras?: { priceId: string; quantity: number };
  /** Lab Kits, at the pack's kit tier Price, reconciled by the caller the same way. */
  kits?: { priceId: string; quantity: number };
  /**
   * Value of the whole order, in pence: the packs plus any loose vials
   * (priceOrder's goodsMinor, post-sale if a sale is live). Decides the
   * delivery prices — passed
   * in rather than recomputed so the route and the session agree on one
   * figure.
   */
  orderValueMinor: number;
  /** ISO-3166-1 alpha-2 codes Stripe will collect a shipping address for. */
  shippingCountries: readonly string[];
  origin: string;
  /**
   * The mailing-list welcome vials (lib/mailing-list.ts), shown on Stripe's
   * page as a £0 line of `qty`. With `email`, the subscriber's address is
   * pre-filled and locked, so the paid order matches them; it is left out
   * for a browser that only followed an email's link. Changes nothing that
   * is charged.
   */
  welcome?: { qty: number; email?: string };
  /**
   * A mailing-list subscriber started this checkout (lib/payments/recovery.ts),
   * so it can be recovered if they leave: the session carries Stripe's
   * recovery link and expires after RECOVERABLE_SESSION_MINUTES, when the
   * reminder goes. Every other session keeps Stripe's 24 hours, since nobody
   * could be reminded sooner.
   */
  recoverable?: boolean;
}

/** How long a recoverable Checkout Session stays open (Stripe's minimum is 30). */
export const RECOVERABLE_SESSION_MINUTES = 60;

/**
 * Create a Checkout Session for one bundle tier.
 *
 * The client sends only a tier id and a quantity. The amount comes from the
 * Stripe Price, which the caller has already reconciled against config — so
 * there is no path by which a client-supplied figure reaches the charge.
 */
export async function createBundleCheckout(
  params: BundleCheckoutParams
): Promise<{ paymentUrl: string; paymentRef: string }> {
  const { orderId, priceId, quantity, orderValueMinor, shippingCountries, origin } = params;

  // Dev simulator: STRIPE_ENABLED=true with no keys, in development only.
  // Guarded again by getPaymentConfig().stripe.mock at the page itself.
  if (!process.env.STRIPE_SECRET_KEY) {
    const ref = `cs_sim_${orderId.slice(0, 12)}`;
    return {
      paymentUrl: `${origin}/dev/stripe?session=${ref}&order=${orderId}`,
      paymentRef: ref,
    };
  }

  const allowedCountries =
    shippingCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  const dispatchNotice = dispatchNoticeAt(new Date());

  // The customer picks a delivery option on Stripe's page. The options and
  // their prices come from deliveryOptionsFor(), the same function the
  // purchase block calls, so the customer is never charged for delivery the
  // page showed as free. Each rate carries its option id so the webhook can
  // record the choice (chosenDeliveryOption). Next day's name carries the
  // day it arrives, as of when the session is made (deliveryDetailAt).
  //
  // While the choice is switched off (deliveryChoiceEnabled), delivery is
  // the one Stripe rate, charged only below the free-delivery threshold —
  // exactly as before there was a choice.
  let shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[];
  if (deliveryChoiceEnabled()) {
    const now = new Date();
    shippingOptions = deliveryOptionsFor(orderValueMinor).map(({ option, priceMinor }) => ({
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: `${option.label} — ${deliveryDetailAt(option, now)}`,
        fixed_amount: { amount: priceMinor, currency: "gbp" },
        metadata: { deliveryOption: option.id },
      },
    }));
  } else {
    const rate = process.env.STRIPE_SHIPPING_RATE_ID;
    shippingOptions = rate && !shipsFree(orderValueMinor) ? [{ shipping_rate: rate }] : [];
  }

  // BacLab's checkout: other brands build their sessions elsewhere. The
  // webhook checks the brand against the order's (app/api/webhooks/stripe).
  const metadata = {
    orderId,
    brand: DEFAULT_BRAND,
    bundleId: params.bundleId,
    extraVials: String(params.extras?.quantity ?? 0),
    kits: String(params.kits?.quantity ?? 0),
  };

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      // Cards only — which also covers Apple Pay and Google Pay, since both
      // present as card payment methods in Checkout. Without pinning this,
      // the account's automatic payment methods apply and routinely include
      // delayed-notification methods (SEPA debit, Bancontact, Klarna) that
      // settle later via checkout.session.async_payment_succeeded, an event
      // this app does not handle.
      payment_method_types: ["card"],
      line_items: [
        { price: priceId, quantity },
        ...(params.extras && params.extras.quantity > 0
          ? [{ price: params.extras.priceId, quantity: params.extras.quantity }]
          : []),
        ...(params.kits && params.kits.quantity > 0
          ? [{ price: params.kits.priceId, quantity: params.kits.quantity }]
          : []),
        // Stripe supports no-cost line items when the session total is above
        // zero (docs.stripe.com/payments/checkout/no-cost-orders).
        ...(params.welcome
          ? [
              {
                price_data: {
                  currency: "gbp",
                  unit_amount: 0,
                  product_data: { name: MAILING_LIST.welcomeLineName },
                },
                quantity: params.welcome.qty,
              },
            ]
          : []),
      ],
      ...(params.welcome?.email ? { customer_email: params.welcome.email } : {}),
      ...(params.recoverable
        ? {
            expires_at: Math.floor(Date.now() / 1000) + RECOVERABLE_SESSION_MINUTES * 60,
            after_expiration: { recovery: { enabled: true, allow_promotion_codes: true } },
          }
        : {}),
      client_reference_id: orderId,
      metadata,
      // Also on the PaymentIntent, where refunds and disputes are worked.
      payment_intent_data: { metadata },

      // Stripe collects the delivery address — the funnel deliberately does
      // not ask for one before the customer has decided to buy.
      shipping_address_collection: { allowed_countries: allowedCountries },
      // Delivery: see shippingOptions above.
      ...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {}),
      // From 3pm Friday until Monday, and over bank holidays, a line under the
      // address form saying when the order ships. Shown whether or not the
      // delivery choice is on: it is true of every order.
      ...(dispatchNotice
        ? { custom_text: { shipping_address: { message: `${dispatchNotice.title}. ${dispatchNotice.detail}` } } }
        : {}),
      // The customer's note for the carrier, onto the label. 30 characters is
      // SmartTrack's limit for it. Tested alongside the delivery choice.
      ...(deliveryChoiceEnabled()
        ? {
            custom_fields: [
              {
                key: DELIVERY_INSTRUCTIONS_FIELD,
                label: { type: "custom", custom: "Delivery instructions" },
                type: "text",
                optional: true,
                text: { maximum_length: 30 },
              },
            ],
          }
        : {}),

      allow_promotion_codes: true,

      // Stripe Tax is off. To turn it on once VAT registration is confirmed:
      // (1) activate Tax in the Stripe Dashboard and set the
      // origin address, (2) set each Price's product tax_code and whether the
      // amount is tax-inclusive, (3) change this to
      //     automatic_tax: { enabled: true }
      // and add `customer_update: { shipping: "auto" }`, which Stripe requires
      // once automatic_tax is on alongside shipping_address_collection.
      // Until then the displayed price is the exact amount charged.
      automatic_tax: { enabled: false },

      success_url: `${origin}/order-confirmation/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
      // Straight back to the purchase block, not the top of the page.
      cancel_url: `${origin}/#buy`,
    },
    // Keyed on the order, so a double-submit or a retry reuses the same
    // session instead of creating a second one against the same order row.
    { idempotencyKey: `checkout:${orderId}` }
  );

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { paymentUrl: session.url, paymentRef: session.id };
}

export interface PlanCheckoutParams {
  orderId: string;
  plan: PlanPrice;
  shippingCountries: readonly string[];
  origin: string;
  /** The mailing-list welcome vials, as on createBundleCheckout. */
  welcome?: { qty: number; email?: string };
}

/**
 * What the plan is, on Stripe's page. Plain words: no em dashes, no
 * exclamation marks. `bonusBox` is 1 for a checkout plan, 2 for an upgrade.
 */
function planDescription(plan: PlanPrice, bonusBox: number): string {
  const free = planFreeLine(plan);
  const delivery = plan.boxDeliveryMinor > 0 ? "Delivery on every box is included." : "Every box ships free.";
  return [
    `${plan.months} boxes, one a month, paid once. It never renews.`,
    free ? `You pay for ${plan.paidMonths}: ${free}.` : "",
    plan.bonusVials > 0 ? `The free ${plan.bonusVials}-pack comes in box ${bonusBox}.` : "",
    delivery,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * A Checkout Session for a prepaid monthly plan: ONE payment of the plan's
 * total, priced here from config (planPrice), never from the request. No
 * shipping rate: delivery for every box is inside the total. No promotion
 * codes: a code would cut the plan's price and break the refund arithmetic.
 */
export async function createPlanCheckout(params: PlanCheckoutParams): Promise<{ paymentUrl: string; paymentRef: string }> {
  const { orderId, plan, shippingCountries, origin } = params;

  if (!process.env.STRIPE_SECRET_KEY) {
    const ref = `cs_sim_${orderId.slice(0, 12)}`;
    return { paymentUrl: `${origin}/dev/stripe?session=${ref}&order=${orderId}`, paymentRef: ref };
  }

  const allowedCountries =
    shippingCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  const metadata = { orderId, brand: DEFAULT_BRAND, plan: plan.key, kind: "plan" };

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: plan.totalMinor,
            product_data: {
              name: `${PRODUCT.name} ${PRODUCT.size}: ${plan.pack.vials} vials a month for ${plan.months} months`,
              description: planDescription(plan, 1),
            },
          },
          quantity: 1,
        },
        ...(plan.bonusVials > 0
          ? [{ price_data: { currency: "gbp", unit_amount: 0, product_data: { name: `Free ${plan.bonusVials}-vial pack in box 1` } }, quantity: 1 }]
          : []),
        ...(params.welcome
          ? [{ price_data: { currency: "gbp", unit_amount: 0, product_data: { name: MAILING_LIST.welcomeLineName } }, quantity: params.welcome.qty }]
          : []),
      ],
      ...(params.welcome?.email ? { customer_email: params.welcome.email } : {}),
      client_reference_id: orderId,
      metadata,
      payment_intent_data: { metadata },
      shipping_address_collection: { allowed_countries: allowedCountries },
      ...(deliveryChoiceEnabled()
        ? {
            custom_fields: [
              {
                key: DELIVERY_INSTRUCTIONS_FIELD,
                label: { type: "custom", custom: "Delivery instructions" },
                type: "text",
                optional: true,
                text: { maximum_length: 30 },
              },
            ],
          }
        : {}),
      allow_promotion_codes: false,
      automatic_tax: { enabled: false },
      success_url: `${origin}/order-confirmation/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
      // Back to the plan picker, on the plan they had chosen.
      cancel_url: `${origin}/?plan=${plan.key}#buy`,
    },
    { idempotencyKey: `checkout:${orderId}` }
  );

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { paymentUrl: session.url, paymentRef: session.id };
}

/** A session from the keyless dev simulator: there is nothing at Stripe to read or close. */
const simulated = (id: string) => !process.env.STRIPE_SECRET_KEY || id.startsWith("cs_sim_");

export interface CheckoutSessionState {
  /**
   * "open": can still be paid, at `url`. "complete": already paid, though the
   * webhook may not have landed yet. "gone": expired, unreadable, or a
   * simulator session with nothing at Stripe.
   */
  status: "open" | "complete" | "gone";
  url: string | null;
}

/** One read of a Checkout Session. Simulator-safe; never throws. */
export async function checkoutSessionState(sessionId: string): Promise<CheckoutSessionState> {
  if (simulated(sessionId)) return { status: "gone", url: null };
  try {
    const s = await getStripe().checkout.sessions.retrieve(sessionId);
    if (s.status === "complete") return { status: "complete", url: null };
    if (s.status === "open") return { status: "open", url: s.url };
    return { status: "gone", url: null };
  } catch (err) {
    console.error(`[stripe] could not read session ${sessionId}`, err);
    return { status: "gone", url: null };
  }
}

/** Close a session nobody should pay any more. "complete" means it was paid first. Never throws. */
export async function expireOpenCheckout(sessionId: string): Promise<"expired" | "complete" | "gone"> {
  const before = await checkoutSessionState(sessionId);
  if (before.status !== "open") return before.status;
  try {
    await getStripe().checkout.sessions.expire(sessionId);
    return "expired";
  } catch (err) {
    // Stripe refuses to expire a session that stopped being open, as one
    // paid between the read above and now has. Find out which it was.
    const after = await checkoutSessionState(sessionId);
    if (after.status === "complete") return "complete";
    console.error(`[stripe] could not expire session ${sessionId}`, err);
    return "gone";
  }
}

/**
 * Turning a paid one-off order into box 1 of a plan: ONE payment of the
 * difference (lib/plans/upgrade.ts upgradePriceMinor), priced here, never from
 * the request. Nothing ships, so no address and no shipping rate. The email is
 * locked to the original order's. No promotion codes.
 */
export async function createPlanUpgradeCheckout(params: {
  orderId: string;
  originalOrderId: string;
  plan: PlanPrice;
  priceMinor: number;
  email: string;
  origin: string;
}): Promise<{ paymentUrl: string; paymentRef: string }> {
  const { orderId, originalOrderId, plan, priceMinor, origin } = params;
  if (!process.env.STRIPE_SECRET_KEY) {
    const ref = `cs_sim_${orderId.slice(0, 12)}`;
    return { paymentUrl: `${origin}/dev/stripe?session=${ref}&order=${orderId}`, paymentRef: ref };
  }
  const ref = originalOrderId.slice(0, 8).toUpperCase();
  const metadata = { orderId, brand: DEFAULT_BRAND, upgradeOf: originalOrderId, plan: plan.key, kind: "plan_upgrade" };
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: priceMinor,
            product_data: {
              name: `Make order ${ref} box 1 of a ${plan.months}-month plan`,
              // An upgrade's box 1 has already been bought, so its bonus pack rides in box 2.
              description: planDescription(plan, 2),
            },
          },
          quantity: 1,
        },
      ],
      ...(params.email ? { customer_email: params.email } : {}),
      client_reference_id: orderId,
      metadata,
      payment_intent_data: { metadata },
      allow_promotion_codes: false,
      automatic_tax: { enabled: false },
      success_url: `${origin}/order-confirmation/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/order-confirmation/${originalOrderId}#plan-upgrade`,
    },
    { idempotencyKey: `checkout:${orderId}` }
  );
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { paymentUrl: session.url, paymentRef: session.id };
}

/** Stripe Checkout custom field carrying the customer's delivery instructions. Brand sessions use it too. */
export const DELIVERY_INSTRUCTIONS_FIELD = "deliveryinstructions";

/** What the customer typed in the delivery instructions box, or "". */
export function deliveryInstructionsFrom(session: Stripe.Checkout.Session): string {
  const field = session.custom_fields?.find((f) => f.key === DELIVERY_INSTRUCTIONS_FIELD);
  return field?.text?.value ?? "";
}

/**
 * The delivery option the customer picked on Stripe's page, read from the
 * metadata createBundleCheckout put on each rate. Null when the session
 * charged no delivery, or the rate is not one of ours. Never throws: the
 * order is paid either way, and label buying copes with an unknown choice.
 */
export async function chosenDeliveryOption(
  session: Stripe.Checkout.Session,
  // The account the session lives in: the webhook passes the one whose
  // signing secret verified the event (verifyStripeWebhook).
  stripe: Stripe = getStripe()
): Promise<DeliveryOptionId | null> {
  const rate = session.shipping_cost?.shipping_rate;
  if (!rate) return null;
  try {
    const resolved = typeof rate === "string" ? await stripe.shippingRates.retrieve(rate) : rate;
    return deliveryOptionById(resolved.metadata?.deliveryOption)?.id ?? null;
  } catch (err) {
    console.error(`[stripe] could not read the delivery option of session ${session.id}`, err);
    return null;
  }
}

/** Verify a Stripe webhook against the raw request body. Throws on mismatch. */
export function verifyStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!signature) throw new Error("Missing stripe-signature header");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

/**
 * The webhook signing secrets in force, the shared account's first: one
 * entry per STRIPE_WEBHOOK_SECRET__<ID> that is set, each with the secret
 * key of the account it belongs to (stripeKeyFor). `env` names the key, for
 * the log.
 */
export function webhookAccounts(brandIds: readonly string[] = BRAND_IDS): { secret: string; key: string; env: string; brandId: string }[] {
  const out: { secret: string; key: string; env: string; brandId: string }[] = [];
  const shared = process.env.STRIPE_WEBHOOK_SECRET;
  const sharedKey = process.env.STRIPE_SECRET_KEY;
  if (shared && sharedKey) out.push({ secret: shared, key: sharedKey, env: "STRIPE_SECRET_KEY", brandId: DEFAULT_BRAND });
  for (const id of brandIds) {
    if (id === DEFAULT_BRAND) continue;
    const secret = process.env[brandStripeEnv("STRIPE_WEBHOOK_SECRET", id)]?.trim();
    const key = stripeKeyFor(id);
    if (!secret || !key) continue;
    const own = key !== sharedKey;
    out.push({ secret, key, env: own ? brandStripeEnv("STRIPE_SECRET_KEY", id) : "STRIPE_SECRET_KEY", brandId: id });
  }
  return out;
}

/**
 * Verify a webhook against every configured signing secret, the shared one
 * first, and say which account sent it: its secret key (for the livemode
 * check), the env var that holds it, and its client (for any lookup the
 * handler makes, such as the shipping rate). Throws, with the shared
 * secret's own error, when none matches. With only the shared secret set
 * this is verifyStripeEvent exactly.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signature: string | null
): { event: Stripe.Event; secretKey: string; keyEnv: string; stripe: Stripe } {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!signature) throw new Error("Missing stripe-signature header");
  let first: unknown = null;
  for (const account of webhookAccounts()) {
    const stripe = stripeFor({ id: account.key === process.env.STRIPE_SECRET_KEY ? DEFAULT_BRAND : account.brandId });
    try {
      return { event: stripe.webhooks.constructEvent(rawBody, signature, account.secret), secretKey: account.key, keyEnv: account.env, stripe };
    } catch (err) {
      first ??= err;
    }
  }
  throw first ?? new Error("STRIPE_SECRET_KEY is not configured");
}

/** Every bundle whose Price ID is configured. Used by the startup warning. */
export function configuredBundles(): { id: BundleId; priceId: string }[] {
  return BUNDLES.map((b) => ({
    id: b.id,
    priceId: process.env[`STRIPE_PRICE_${b.id.toUpperCase()}`] ?? "",
  })).filter((b) => b.priceId !== "");
}
