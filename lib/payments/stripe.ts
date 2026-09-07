import Stripe from "stripe";
import { BUNDLES, bundleById, shipsFree, type BundleId } from "@/config/funnel";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  // Pin the API version so an SDK bump can never silently change the wire
  // contract. Keep it in step with the installed SDK's LatestApiVersion.
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  return _stripe;
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

  const price = await retrievePrice(priceId);
  if (!price.active) {
    throw new Error(`Stripe price ${priceId} for bundle ${bundleId} is archived`);
  }
  if (price.currency !== "gbp") {
    throw new Error(
      `Stripe price ${priceId} is in ${price.currency}, expected gbp (bundle ${bundleId})`
    );
  }
  if (price.unit_amount !== bundle.priceMinor) {
    throw new Error(
      `Stripe price ${priceId} charges ${price.unit_amount} but bundle ${bundleId} is configured at ${bundle.priceMinor}. Re-run scripts/stripe-setup.ts and update the env var.`
    );
  }
}

export interface BundleCheckoutParams {
  orderId: string;
  bundleId: BundleId;
  priceId: string;
  quantity: number;
  /**
   * Value of the whole order, in pence (bundle.priceMinor x quantity, post-
   * sale if a sale is live). Decides free delivery via shipsFree() — passed
   * in rather than recomputed so the route and the session agree on one
   * figure.
   */
  orderValueMinor: number;
  /** ISO-3166-1 alpha-2 codes Stripe will collect a shipping address for. */
  shippingCountries: readonly string[];
  origin: string;
}

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
      line_items: [{ price: priceId, quantity }],
      client_reference_id: orderId,
      metadata: { orderId, bundleId: params.bundleId },
      // Also on the PaymentIntent, where refunds and disputes are worked.
      payment_intent_data: { metadata: { orderId, bundleId: params.bundleId } },

      // Stripe collects the delivery address — the funnel deliberately does
      // not ask for one before the customer has decided to buy.
      shipping_address_collection: { allowed_countries: allowedCountries },
      // Delivery is charged ONLY when the order misses the free-delivery
      // threshold. shipsFree() is the same function the purchase block calls,
      // so the customer is never charged for delivery the page showed as free.
      ...(process.env.STRIPE_SHIPPING_RATE_ID && !shipsFree(orderValueMinor)
        ? { shipping_options: [{ shipping_rate: process.env.STRIPE_SHIPPING_RATE_ID }] }
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

/** Verify a Stripe webhook against the raw request body. Throws on mismatch. */
export function verifyStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!signature) throw new Error("Missing stripe-signature header");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** Every bundle whose Price ID is configured. Used by the startup warning. */
export function configuredBundles(): { id: BundleId; priceId: string }[] {
  return BUNDLES.map((b) => ({
    id: b.id,
    priceId: process.env[`STRIPE_PRICE_${b.id.toUpperCase()}`] ?? "",
  })).filter((b) => b.priceId !== "");
}
