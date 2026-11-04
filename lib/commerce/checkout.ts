/**
 * Checkout for every brand but BacLab: app/api/checkout/route.ts hands a
 * request here, straight after its origin and rate-limit checks, when the
 * Host is another brand's. Nothing below that line in the route runs for
 * them, so BacLab's checkout, its Stripe Price allow-list included, is
 * exactly as it was.
 *
 * SERVER ONLY. It reads the brand registry's profile (passed in), Prisma and
 * the brand's payment providers (lib/commerce/payments). It never loads
 * Stripe: BacLab's Stripe account is BacLab's alone, and no brand may reach
 * it by any path, a fallback included (npm run test:brand-checkout traps
 * every Stripe client made).
 *
 * THE CONTRACT the storefronts are built against:
 *   POST /api/checkout
 *   { lines: [{ sku: string, qty: int }], deliveryOption?: string,
 *     method?: string, business?: { company?: string, vatNumber?: string },
 *     consent?: { tracking?: boolean } }
 *   → 200 { url }       the provider's page, to send the browser to
 *   → 4xx { error }     a sentence the storefront can show
 *   → 503 { error }     the brand has no way to pay right now
 *   → 5xx { error }     our fault; "Something went wrong" or similar
 * The request carries no price and no brand: the brand is the Host's, and
 * every line is priced from that brand's catalogue (lib/commerce/pricing.ts).
 * `deliveryOption` is the buyer's choice on our page, one of the options
 * offered for the order; it may be left out only when one is offered.
 * `method` is one of the storefront view's payment.methods ids; it may be
 * left out only when one is offered. `business` is for a trade catalogue
 * (collectBusinessDetails) and refused anywhere else. `consent.tracking` is
 * the cookie banner's answer, as `trackingConsent` is on BacLab's: it decides
 * whether the purchase is reported to Meta from the server
 * (lib/meta-capi-event.ts attributionFor).
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/rateLimit";
import { DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import { LAB_KIT, labKitEnabled } from "@/config/funnel";
import { buildBrandOrderItems } from "@/lib/order-items";
import { catalogueDeliveryOptions } from "@/lib/commerce/catalogue";
import { MAX_BRAND_LINES, MAX_LINE_QTY, priceBrandLines } from "@/lib/commerce/pricing";
import { choosePaymentAdapter } from "@/lib/commerce/payments";
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
    method: z.string().trim().max(40).optional(),
    business: z
      .object({
        company: z.string().max(200).optional(),
        vatNumber: z.string().max(60).optional(),
      })
      .strict()
      .optional(),
    consent: z.object({ tracking: z.boolean().optional() }).strict().optional(),
  })
  .strict();

export type BrandCheckoutInput = z.infer<typeof BrandCheckoutSchema>;

/**
 * The answer while a brand has no way to pay. Names no provider and no
 * method: the storefront shows it as it stands, and shows no checkout
 * button at all while its view lists no method (lib/commerce/storefront.ts).
 */
export const CHECKOUT_UNAVAILABLE = "Checkout is not available right now.";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * A trade buyer's company name and VAT number as lines for the order's notes
 * (there is no column for them), or "" when neither was given. Whitespace is
 * collapsed and each is cut to a sane length; neither is checked further,
 * because anyone may buy and neither is required.
 */
export function businessDetailsNote(business: { company?: string; vatNumber?: string } | undefined): string {
  const clean = (s: string | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const company = clean(business?.company, 100);
  const vat = clean(business?.vatNumber, 30);
  return [company ? `Company: ${company}` : "", vat ? `VAT number: ${vat}` : ""].filter(Boolean).join("\n");
}

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
    if (input.business && !catalogue.collectBusinessDetails) return fail("Invalid order details", 400);

    // ── Pricing: every figure from the catalogue, none from the request.
    const pricing = priceBrandLines(catalogue, input.lines, { labKitOnSale: labKitEnabled() });
    if (!pricing.ok) return fail(pricing.error, 400);
    const priced = pricing.order;

    // ── Delivery: the buyer chooses on our page, so the provider is told
    // the amount. Never a default while there is a choice to make.
    const offered = catalogueDeliveryOptions(catalogue, priced.goodsMinor);
    const delivery =
      input.deliveryOption !== undefined
        ? offered.find((o) => o.option.id === input.deliveryOption)
        : offered.length === 1
          ? offered[0]
          : undefined;
    if (!delivery) {
      return fail(
        input.deliveryOption === undefined && offered.length > 1
          ? "Choose a delivery option."
          : "That delivery option is not available for this order.",
        400
      );
    }

    // ── The provider: listed on the profile and given the brand's own
    // credentials (lib/commerce/payments). Checked before any stock is
    // read or any order is written.
    const choice = choosePaymentAdapter(brand, input.method, CHECKOUT_UNAVAILABLE);
    if (!choice.ok) {
      if (choice.status === 503) console.warn(`[internal] brand checkout (${brand.id}) refused: no payment provider is configured`);
      return fail(choice.error, choice.status);
    }
    const adapter = choice.adapter;

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

    // ── The order, in the brand's name, with the delivery the buyer chose.
    // The provider collects the name and address; its confirmation writes
    // them on before fulfilment, as Stripe's webhook does on BacLab's.
    const total = new Prisma.Decimal((priced.goodsMinor / 100).toFixed(2));
    const rates = await fetchFxRates();
    const subtotalUsd = new Prisma.Decimal(priceIn({ priceGbp: total.toFixed(2) }, "USD", rates).toFixed(2));
    const items = buildBrandOrderItems({
      vial: { productId: product.id, slug: product.slug },
      kitProductId: kitProduct?.id,
      lines: priced.lines,
      goodsUsd: subtotalUsd.toFixed(2),
    });
    const business = businessDetailsNote(input.business);
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
        paymentMethod: adapter.id,
        paymentProvider: adapter.id,
        deliveryOption: delivery.option.id,
        deliveryMinor: delivery.priceMinor,
        notes: [`Payment by ${adapter.label}`, business].filter(Boolean).join("\n"),
        // Read now, as BacLab's checkout does: the provider's confirmation
        // never sees the customer's browser. Kept only with consent.
        ...attributionFor(input.consent?.tracking === true, {
          cookie: req.headers.get("cookie"),
          userAgent: req.headers.get("user-agent"),
          ip: req.headers.get("cf-connecting-ip") ?? clientIp(req),
        }),
      },
    });

    let payment;
    try {
      payment = await adapter.createPayment(
        {
          id: order.id,
          lines: priced.lines,
          goodsMinor: priced.goodsMinor,
          delivery: { id: delivery.option.id, label: delivery.option.label, priceMinor: delivery.priceMinor },
        },
        { brand }
      );
    } catch (err) {
      // The order stays pending with no payment attached; the nightly
      // clear-up removes it after an hour (lib/payments/abandoned.ts).
      console.error(`[internal] brand checkout (${brand.id}): ${adapter.id} refused order ${order.id}`, err);
      return fail("Something went wrong. Please try again.", 502);
    }

    await prisma.order.update({ where: { id: order.id }, data: { paymentRef: payment.ref } });
    return NextResponse.json({ url: payment.url });
  } catch (err) {
    // The route's own catch never sees this: it returns this promise
    // without awaiting it. Log in full; tell the customer nothing.
    console.error(`[internal] brand checkout (${brand.id}) failed`, err);
    return fail("Something went wrong", 500);
  }
}
