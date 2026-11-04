/**
 * Checkout for every brand but BacLab: app/api/checkout/route.ts hands a
 * request here, straight after its origin and rate-limit checks, when the
 * Host is another brand's. Nothing below that line in the route runs for
 * them, so BacLab's checkout, its Stripe Price allow-list included, is
 * exactly as it was.
 *
 * SERVER ONLY. It reads the brand registry's profile (passed in) and the
 * brand's catalogue. It never loads Stripe: BacLab's Stripe account is
 * BacLab's alone, and no brand may reach it by any path, a fallback
 * included (npm run test:brand-checkout traps every Stripe client made).
 *
 * THE CONTRACT the storefronts are built against:
 *   POST /api/checkout
 *   { lines: [{ sku: string, qty: int }], deliveryOption?: string,
 *     consent?: { tracking?: boolean } }
 *   → 200 { url }       where to send the browser to pay
 *   → 4xx { error }     a sentence the storefront can show
 *   → 503 { error }     the brand has no way to pay right now
 *   → 5xx { error }     our fault; "Something went wrong" or similar
 * The request carries no price and no brand: the brand is the Host's, and
 * every line is priced from that brand's catalogue (lib/commerce/pricing.ts).
 * `consent.tracking` is the cookie banner's answer, as `trackingConsent` is
 * on BacLab's: it decides whether the purchase is reported to Meta from the
 * server (lib/meta-capi-event.ts attributionFor).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import { labKitEnabled } from "@/config/funnel";
import { catalogueDeliveryOptions } from "@/lib/commerce/catalogue";
import { MAX_BRAND_LINES, MAX_LINE_QTY, priceBrandLines } from "@/lib/commerce/pricing";

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

/**
 * The answer while a brand has no way to pay. Names no provider and no
 * method: the storefront shows it as it stands, and shows no checkout
 * button at all while its view lists no method (lib/commerce/storefront.ts).
 */
export const CHECKOUT_UNAVAILABLE = "Checkout is not available right now.";

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

    // ── Pricing: every figure from the catalogue, none from the request.
    const pricing = priceBrandLines(catalogue, input.lines, { labKitOnSale: labKitEnabled() });
    if (!pricing.ok) return fail(pricing.error, 400);
    const priced = pricing.order;

    if (input.deliveryOption !== undefined) {
      const offered = catalogueDeliveryOptions(catalogue, priced.goodsMinor).some((o) => o.option.id === input.deliveryOption);
      if (!offered) return fail("That delivery option is not available for this order.", 400);
    }

    // No brand has a way to pay: the brand Stripe path is gone (BacLab's
    // account is BacLab's alone) and nothing has replaced it yet. Refused
    // here, before any stock is read or any order is written.
    console.warn(`[internal] brand checkout (${brand.id}) refused: the brand has no payment provider`);
    return fail(CHECKOUT_UNAVAILABLE, 503);
  } catch (err) {
    // The route's own catch never sees this: it returns this promise
    // without awaiting it. Log in full; tell the customer nothing.
    console.error(`[internal] brand checkout (${brand.id}) failed`, err);
    return fail("Something went wrong", 500);
  }
}
