/**
 * Stripe for the brands: a Checkout Session on BacLab's own Stripe account,
 * made with BacLab's key (lib/payments/stripe.ts getStripe). There is no
 * per-brand key and no STRIPE_*__<ID>: each brand is one more website of
 * that account, declared to Stripe in its business details before it takes
 * a payment (deploy/BRAND-PAYMENTS.md). BacLab's own sessions are built in
 * lib/payments/stripe.ts from its Stripe Prices, exactly as before; nothing
 * here touches them.
 *
 * The session charges exactly the order the brand checkout has priced from
 * the catalogue: each line inline, named neutrally, and the delivery the
 * buyer chose on our page as the one fixed shipping rate. BacLab's webhook
 * (app/api/webhooks/stripe/route.ts) then confirms it as it confirms
 * BacLab's: it finds the order by metadata.orderId, checks the brand and
 * the amount (the goods are amount_total less amount_shipping), writes the
 * address and the delivery instructions, and calls fulfillPaidOrder.
 *
 * Inline lines (price_data) rather than Stripe Products: nothing has to be
 * created in the account before a brand can sell, and with no promotion
 * codes there is nothing a Product would scope. Each line's product carries
 * the brand and SKU in its metadata instead, for Stripe's own records.
 *
 * SERVER ONLY: it reads BacLab's Stripe settings from env and calls Stripe.
 */
import type Stripe from "stripe";
import type { BrandProfile } from "@/brands/types";
import { SHIPPING_COUNTRIES, deliveryDetailAt, dispatchNoticeAt } from "@/config/funnel";
import { brandLineName } from "@/lib/commerce/catalogue";
import type { CreatedPayment, PaymentAdapter, PaymentContext, PaymentOrder } from "@/lib/commerce/payments/types";
import { getPaymentConfig } from "@/lib/payments/config";
import { DELIVERY_INSTRUCTIONS_FIELD, getStripe } from "@/lib/payments/stripe";

/**
 * The shortened descriptor (prefix) set on BacLab's Stripe account, under
 * Settings → Business → Public details. Stripe prints a brand's card
 * payment as "<prefix>* <statementDescriptor>", 22 characters at most in
 * all. The prefix is set there and never sent with a payment; this records
 * what it is set to, so npm run check:brands can hold each brand's
 * descriptor to the room it leaves. null while it has not been chosen: the
 * check then assumes Stripe's longest prefix and calls the brands not ready
 * for launch. Neutral, like the descriptors: BacLab's name here would be on
 * every brand's statements.
 */
export const STRIPE_STATEMENT_PREFIX: string | null = null;

/** Stripe's own limit on a statement descriptor suffix, before the prefix is counted. */
const SUFFIX_MAX = 22;

export interface BrandSessionInput {
  brand: BrandProfile;
  order: PaymentOrder;
  /** When the session is made: the dispatch notice and next day's arrival day depend on it. */
  now: Date;
}

/**
 * Everything a brand's Checkout Session is created with. Pure, so
 * scripts/test-brand-checkout.ts can read every field without Stripe.
 */
export function brandSessionParams({ brand, order, now }: BrandSessionInput): Stripe.Checkout.SessionCreateParams {
  const goods = order.lines.reduce((n, l) => n + l.unitMinor * l.quantity, 0);
  if (goods !== order.goodsMinor) throw new Error(`brandSessionParams: lines sum to ${goods}, the order to ${order.goodsMinor}`);
  const origin = brand.origin;

  // The webhook finds the order by orderId and logs a session whose brand
  // is not the order's. On the PaymentIntent too, where refunds and
  // disputes are worked.
  const metadata = { orderId: order.id, brand: brand.id, kind: "brand" };
  const suffix = brand.statementDescriptor?.trim().slice(0, SUFFIX_MAX);

  // The one rate is the delivery the buyer chose on our page, at its price,
  // so the customer is charged nothing they were not shown there. It
  // carries its option id, which the webhook reads back
  // (lib/payments/stripe.ts chosenDeliveryOption). Next day names the day
  // it arrives, as on BacLab's sessions, in the words of the brand's own
  // buy section ("label: detail"), which have no dash.
  const option = brand.catalogue?.delivery.options.find((o) => o.id === order.delivery.id);
  const dispatchNotice = dispatchNoticeAt(now);

  return {
    mode: "payment",
    // Cards only (Apple Pay and Google Pay included), as on BacLab's: the
    // webhook handles no delayed-notification methods.
    payment_method_types: ["card"],
    line_items: order.lines.map((line) => ({
      price_data: {
        currency: "gbp",
        unit_amount: line.unitMinor,
        product_data: { name: brandLineName(line), metadata: { brand: brand.id, sku: line.sku } },
      },
      quantity: line.quantity,
    })),
    client_reference_id: order.id,
    metadata,
    payment_intent_data: {
      metadata,
      ...(suffix ? { statement_descriptor_suffix: suffix } : {}),
    },
    // Stripe collects the address; the webhook writes it onto the order.
    shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: option ? `${option.label}: ${deliveryDetailAt(option, now)}` : order.delivery.label,
          fixed_amount: { amount: order.delivery.priceMinor, currency: "gbp" },
          metadata: { deliveryOption: order.delivery.id },
        },
      },
    ],
    // Every brand ships from the same warehouse on the same days.
    ...(dispatchNotice
      ? { custom_text: { shipping_address: { message: `${dispatchNotice.title}. ${dispatchNotice.detail}` } } }
      : {}),
    // The customer's note for the carrier, onto the label. 30 characters is
    // SmartTrack's limit for it.
    custom_fields: [
      {
        key: DELIVERY_INSTRUCTIONS_FIELD,
        label: { type: "custom", custom: "Delivery instructions" },
        type: "text",
        optional: true,
        text: { maximum_length: 30 },
      },
    ],
    // Never, whatever the catalogue says: the codes on this account are
    // BacLab's, and none may discount another brand's order.
    allow_promotion_codes: false,
    // Off, as on BacLab's: the price shown is the amount charged.
    automatic_tax: { enabled: false },
    // Stripe fetches the logo and icon, so they must be public https URLs;
    // until the brand is on https its page shows the account's own branding.
    ...(origin.startsWith("https://") ? { branding_settings: brandingSettings(brand) } : {}),
    success_url: `${origin}/order-confirmation/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    // Straight back to the buy section, not the top of the page.
    cancel_url: `${origin}/#buy`,
  };
}

/** The brand's name, colours and images on Stripe's page, over the account's (BacLab's). */
function brandingSettings(brand: BrandProfile): Stripe.Checkout.SessionCreateParams.BrandingSettings {
  const image = (path: string | undefined) =>
    path ? { type: "url" as const, url: path.startsWith("/") ? `${brand.origin}${path}` : path } : undefined;
  const logo = image(brand.paymentPage?.logo);
  const icon = image(brand.paymentPage?.icon);
  return {
    display_name: brand.name,
    background_color: brand.colours.paper,
    button_color: brand.colours.cta,
    ...(logo ? { logo } : {}),
    ...(icon ? { icon } : {}),
  };
}

async function createPayment(order: PaymentOrder, ctx: PaymentContext): Promise<CreatedPayment> {
  const session = await getStripe().checkout.sessions.create(
    brandSessionParams({ brand: ctx.brand, order, now: new Date() }),
    // Keyed on the order, as BacLab's sessions are: a retry reuses the same
    // session instead of making a second one against the same order row.
    { idempotencyKey: `checkout:${order.id}` }
  );
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, ref: session.id };
}

export const stripeAdapter: PaymentAdapter = {
  id: "stripe",
  label: "card",
  paymentMethod: "card",
  // BacLab's own switch and keys, as its card checkout and webhook need
  // them: STRIPE_ENABLED=true, STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
  // Never the keyless dev simulator, which is BacLab's page only.
  configured: () => {
    const stripe = getPaymentConfig().stripe;
    return stripe.enabled && stripe.configured;
  },
  createPayment,
};
