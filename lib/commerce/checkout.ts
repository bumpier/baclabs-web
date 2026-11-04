/**
 * Checkout for every brand but BacLab: app/api/checkout/route.ts hands a
 * request here, straight after its origin and rate-limit checks, when the
 * Host is another brand's. Nothing below that line in the route runs for
 * them, so BacLab's checkout, its Stripe Price allow-list included, is
 * exactly as it was.
 *
 * SERVER ONLY. It reads the brand registry's profile (passed in), Prisma
 * and Stripe.
 *
 * THE CONTRACT the storefronts are built against:
 *   POST /api/checkout
 *   { lines: [{ sku: string, qty: int }], deliveryOption?: string,
 *     consent?: { tracking?: boolean } }
 *   → 200 { url }       Stripe's page, to send the browser to
 *   → 4xx { error }     a sentence the storefront can show
 *   → 5xx { error }     our fault; "Something went wrong" or similar
 * The request carries no price and no brand: the brand is the Host's, and
 * every line is priced from that brand's catalogue (lib/commerce/pricing.ts).
 * `deliveryOption` only preselects one of the options offered on Stripe's
 * page; the customer still chooses there and the webhook records it.
 * `consent.tracking` is the cookie banner's answer, as `trackingConsent` is
 * on BacLab's: it decides whether the purchase is reported to Meta from the
 * server (lib/meta-capi-event.ts attributionFor).
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/rateLimit";
import { DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import type { BrandCatalogue } from "@/brands/types";
import {
  LAB_KIT,
  SHIPPING_COUNTRIES,
  deliveryDetailAt,
  dispatchNoticeAt,
  labKitEnabled,
  type DeliveryOptionId,
} from "@/config/funnel";
import { buildBrandOrderItems } from "@/lib/order-items";
import { brandLineName, brandStripeProductId, catalogueDeliveryOptions } from "@/lib/commerce/catalogue";
import { MAX_BRAND_LINES, MAX_LINE_QTY, priceBrandLines, type PricedBrandOrder } from "@/lib/commerce/pricing";
import { DELIVERY_INSTRUCTIONS_FIELD, stripeFor, stripeKeyFor } from "@/lib/payments/stripe";
import { getPaymentConfig, providerForMethod } from "@/lib/payments/config";
import { attributionFor } from "@/lib/meta-capi-event";
import { getInventoryMode } from "@/lib/inventory/mode";
import { canSupply } from "@/lib/inventory/store";
import { LAB_KIT_SKU_CODE } from "@/lib/inventory/demand";
import { priceIn } from "@/lib/fx";
import { fetchFxRates } from "@/lib/fx-rates";

/** The shared vial every brand's packs sell from (its Product row, as on BacLab's checkout). */
const VIAL_SLUG = "baclab-10ml";

export const BrandCheckoutSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            sku: z.string().trim().min(1).max(40),
            qty: z.number().int().min(1).max(MAX_LINE_QTY),
          })
          .strict()
      )
      .min(1)
      .max(MAX_BRAND_LINES),
    deliveryOption: z.string().trim().max(40).optional(),
    consent: z.object({ tracking: z.boolean().optional() }).strict().optional(),
  })
  .strict();

export type BrandCheckoutInput = z.infer<typeof BrandCheckoutSchema>;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function brandCheckout(req: Request, brand: BrandProfile): Promise<Response> {
  try {
    // Never BacLab's: the route only sends other brands here, and a brand
    // with no catalogue has nothing to sell.
    const catalogue = brand.catalogue;
    if (brand.id === DEFAULT_BRAND || !catalogue) return fail("Not found", 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid order details", 400);
    }
    const parsed = BrandCheckoutSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid order details", 400);
    const input = parsed.data;

    if (!getPaymentConfig().methods.includes("card")) return fail("Card payment is not available right now.", 400);
    // The keyless dev simulator (/dev/stripe) is BacLab's page; a brand's
    // host has none, so without a key there is nowhere to send the customer.
    // Checked before any order is written.
    if (!stripeKeyFor(brand.id)) {
      console.error(`[internal] brand checkout (${brand.id}) needs a Stripe secret key: the dev simulator is BacLab's only`);
      return fail("Card payment is not available right now.", 503);
    }

    // ── Pricing: every figure from the catalogue, none from the request.
    const pricing = priceBrandLines(catalogue, input.lines, { labKitOnSale: labKitEnabled() });
    if (!pricing.ok) return fail(pricing.error, 400);
    const priced = pricing.order;

    let preselect: DeliveryOptionId | null = null;
    if (input.deliveryOption !== undefined) {
      const offered = catalogueDeliveryOptions(catalogue, priced.goodsMinor).find((o) => o.option.id === input.deliveryOption);
      if (!offered) return fail("That delivery option is not available for this order.", 400);
      preselect = offered.option.id;
    }

    // ── Stock, exactly as BacLab's checkout counts it (lib/inventory/mode.ts).
    const product = await prisma.product.findUnique({ where: { slug: VIAL_SLUG } });
    if (!product || !product.active) {
      console.error(`[internal] brand checkout (${brand.id}) rejected: product "${VIAL_SLUG}" is missing or inactive. Run: npx tsx scripts/stripe-setup.ts`);
      return fail("This product is not available for purchase right now.", 400);
    }
    const kitProduct = priced.kits > 0 ? await prisma.product.findUnique({ where: { slug: LAB_KIT.sku } }) : null;
    if (priced.kits > 0 && (!kitProduct || !kitProduct.active)) {
      console.error(`[internal] brand checkout (${brand.id}) rejected: product "${LAB_KIT.sku}" is missing or inactive.`);
      return fail(`${LAB_KIT.name}s are not available right now.`, 400);
    }
    if ((await getInventoryMode()) === "warehouse") {
      // Each pack is its kit SKU (scripts/seed-brand-skus.ts); a kit add-on
      // is the shared Lab Kit. Checked together: every pack draws on the
      // same shelf of vials.
      const shelf = priced.lines.map((l) => ({ code: l.kind === "pack" ? l.sku : LAB_KIT_SKU_CODE, quantity: l.quantity }));
      const supply = await canSupply(shelf);
      if (supply === "unavailable") {
        console.error(
          `[internal] brand checkout (${brand.id}) rejected: no active SKU for ${shelf.map((l) => `"${l.code}"`).join(" or ")} in warehouse mode. Run: npm run db:seed:brand-skus -- --apply`
        );
        return fail("This product is not available for purchase right now.", 400);
      }
      if (supply === "short") return fail("Not enough stock for that quantity.", 409);
    } else if (product.stock < priced.vials) {
      return fail("Not enough stock for that quantity.", 409);
    } else if (kitProduct && kitProduct.stock < priced.kits) {
      return fail(`Not enough ${LAB_KIT.name}s in stock for that quantity.`, 409);
    }

    // ── The order, in the brand's name. Card only: Stripe collects the
    // address and the webhook backfills it, as on BacLab's card path.
    const total = new Prisma.Decimal((priced.goodsMinor / 100).toFixed(2));
    const rates = await fetchFxRates();
    const subtotalUsd = new Prisma.Decimal(priceIn({ priceGbp: total.toFixed(2) }, "USD", rates).toFixed(2));
    const items = buildBrandOrderItems({
      vial: { productId: product.id, slug: product.slug },
      kitProductId: kitProduct?.id,
      lines: priced.lines,
      goodsUsd: subtotalUsd.toFixed(2),
    });
    const order = await prisma.order.create({
      data: {
        brand: brand.id,
        status: "pending",
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        shippingAddress: "",
        items: JSON.stringify(items),
        currency: "GBP",
        totalAmount: total,
        subtotalUsd,
        paymentMethod: "card",
        paymentProvider: providerForMethod("card"),
        // Read now, as BacLab's checkout does: the webhook never sees the
        // customer's browser. Kept only with consent.
        ...attributionFor(input.consent?.tracking === true, {
          cookie: req.headers.get("cookie"),
          userAgent: req.headers.get("user-agent"),
          ip: req.headers.get("cf-connecting-ip") ?? clientIp(req),
        }),
      },
    });

    const productStem = process.env[catalogue.stripeProductEnv]?.trim() || null;
    if (!productStem) {
      console.warn(
        `[stripe] ${catalogue.stripeProductEnv} is not set: ${brand.id}'s lines are named inline. Run: npx tsx scripts/stripe-setup.ts --brand ${brand.id} --apply`
      );
    }
    const params = brandSessionParams({ brand, catalogue, orderId: order.id, order: priced, productStem, preselect, now: new Date() });
    // Keyed on the order, as BacLab's sessions are: a retry reuses the same
    // session instead of making a second one against the same order row.
    const session = await stripeFor(brand).checkout.sessions.create(params, { idempotencyKey: `checkout:${order.id}` });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");

    await prisma.order.update({ where: { id: order.id }, data: { paymentRef: session.id, notes: "Card payment (Stripe)" } });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // The route's own catch never sees this: it returns this promise
    // without awaiting it. Log in full; tell the customer nothing.
    console.error(`[internal] brand checkout (${brand.id}) failed`, err);
    return fail("Something went wrong", 500);
  }
}

// ── The Stripe session, pure ───────────────────────────────────────

/** The company-name field on a trade buyer's Stripe page (collectBusinessDetails). */
export const COMPANY_FIELD = "companyname";

export interface BrandSessionInput {
  brand: BrandProfile;
  catalogue: BrandCatalogue;
  orderId: string;
  order: PricedBrandOrder;
  /** STRIPE_PRODUCT__<ID>, or null to name every line inline. */
  productStem: string | null;
  /** The option to list first, which Stripe's page preselects. */
  preselect?: DeliveryOptionId | null;
  now: Date;
}

/**
 * Everything the brand's Checkout Session is created with. Pure, so
 * scripts/test-brand-checkout.ts can read every field without Stripe.
 */
export function brandSessionParams(input: BrandSessionInput): Stripe.Checkout.SessionCreateParams {
  const { brand, catalogue, orderId, order, productStem, now } = input;
  const origin = brand.origin;
  const catalogueId = (sku: string) =>
    catalogue.packs.find((p) => p.sku === sku)?.id ?? catalogue.addOns.find((a) => a.sku === sku)?.id ?? sku.toLowerCase();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.lines.map((line) => ({
    price_data: {
      currency: "gbp",
      unit_amount: line.unitMinor,
      ...(productStem
        ? { product: brandStripeProductId(productStem, catalogueId(line.sku)) }
        : { product_data: { name: brandLineName(line), metadata: { brand: brand.id, sku: line.sku } } }),
    },
    quantity: line.quantity,
  }));

  // Each rate carries its option id, which the webhook reads back
  // (lib/payments/stripe.ts chosenDeliveryOption) and the label buyer sends
  // it by. The same display as BacLab's: next day names the day it arrives.
  const offered = catalogueDeliveryOptions(catalogue, order.goodsMinor);
  const first = input.preselect ? offered.filter((o) => o.option.id === input.preselect) : [];
  const shippingOptions = [...first, ...offered.filter((o) => !first.includes(o))].map(({ option, priceMinor }) => ({
    shipping_rate_data: {
      type: "fixed_amount" as const,
      display_name: `${option.label} — ${deliveryDetailAt(option, now)}`,
      fixed_amount: { amount: priceMinor, currency: "gbp" },
      metadata: { deliveryOption: option.id },
    },
  }));

  const metadata = { orderId, brand: brand.id, kind: "brand" };
  const suffix = brand.stripe?.statementDescriptorSuffix?.trim();
  const dispatchNotice = dispatchNoticeAt(now);

  const customFields: Stripe.Checkout.SessionCreateParams.CustomField[] = [
    ...(catalogue.collectBusinessDetails
      ? [
          {
            key: COMPANY_FIELD,
            label: { type: "custom" as const, custom: "Company name" },
            type: "text" as const,
            // Anyone can buy: a company is asked for, never required.
            optional: true,
            text: { maximum_length: 100 },
          },
        ]
      : []),
    {
      key: DELIVERY_INSTRUCTIONS_FIELD,
      label: { type: "custom", custom: "Delivery instructions" },
      type: "text",
      optional: true,
      // SmartTrack's limit for the label.
      text: { maximum_length: 30 },
    },
  ];

  return {
    mode: "payment",
    // Cards only (Apple Pay and Google Pay included), as on BacLab's: the
    // webhook handles no delayed-notification methods.
    payment_method_types: ["card"],
    line_items: lineItems,
    client_reference_id: orderId,
    metadata,
    payment_intent_data: {
      metadata,
      ...(suffix ? { statement_descriptor_suffix: suffix } : {}),
    },
    shipping_address_collection: {
      allowed_countries: SHIPPING_COUNTRIES as unknown as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
    },
    ...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {}),
    // Every brand ships from the same warehouse on the same days.
    ...(dispatchNotice
      ? { custom_text: { shipping_address: { message: `${dispatchNotice.title}. ${dispatchNotice.detail}` } } }
      : {}),
    custom_fields: customFields,
    // VAT numbers for trade buyers; Stripe also asks for the business name
    // with one (customer_details.business_name). No Customer is needed: both
    // are on the completed session, where the webhook reads them.
    ...(catalogue.collectBusinessDetails ? { tax_id_collection: { enabled: true } } : {}),
    allow_promotion_codes: catalogue.allowPromotionCodes,
    // Off, as on BacLab's: the price shown is the amount charged.
    automatic_tax: { enabled: false },
    // Stripe fetches the logo and icon, so they must be public https URLs;
    // until the brand is on https its page shows the account's own branding.
    ...(origin.startsWith("https://") ? { branding_settings: brandingSettings(brand) } : {}),
    success_url: `${origin}/order-confirmation/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#buy`,
  };
}

function brandingSettings(brand: BrandProfile): Stripe.Checkout.SessionCreateParams.BrandingSettings {
  const image = (path: string | undefined) =>
    path ? { type: "url" as const, url: path.startsWith("/") ? `${brand.origin}${path}` : path } : undefined;
  const logo = image(brand.stripe?.logo);
  const icon = image(brand.stripe?.icon);
  return {
    display_name: brand.name,
    background_color: brand.colours.paper,
    button_color: brand.colours.cta,
    ...(logo ? { logo } : {}),
    ...(icon ? { icon } : {}),
  };
}

// ── Back from Stripe ───────────────────────────────────────────────

/**
 * The trade buyer's company name and VAT number from a completed brand
 * session, as lines for the order's notes (there is no column for them), or
 * "" when there are none. Read by the webhook for brand sessions only.
 */
export function businessDetailsNote(
  session: Pick<Stripe.Checkout.Session, "custom_fields"> & {
    customer_details?: Pick<Stripe.Checkout.Session.CustomerDetails, "business_name" | "tax_ids"> | null;
  }
): string {
  const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  const typed = clean(session.custom_fields?.find((f) => f.key === COMPANY_FIELD)?.text?.value);
  const company = typed || clean(session.customer_details?.business_name);
  const vat = (session.customer_details?.tax_ids ?? [])
    .map((t) => clean(t.value))
    .filter(Boolean);
  return [company ? `Company: ${company}` : "", vat.length ? `VAT number: ${vat.join(", ")}` : ""].filter(Boolean).join("\n");
}
