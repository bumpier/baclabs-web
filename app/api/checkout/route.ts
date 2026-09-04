import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CheckoutSchema, verifyOrigin } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { originFromHeaders } from "@/lib/site-url";
import {
  createCryptoPayment,
  buildPendingNote,
  type CryptoPaymentMethod,
} from "@/lib/crypto-gateway";
import { createBundleCheckout, assertPriceMatchesConfig } from "@/lib/payments/stripe";
import { getPaymentConfig, providerForMethod } from "@/lib/payments/config";
import { priceIn } from "@/lib/fx";
import { fetchFxRates } from "@/lib/fx-rates";
import {
  bundleById,
  allowedPriceIds,
  priceIdFor,
  totalMinor,
  SHIPPING_COUNTRIES,
  PRODUCT,
  type BundleId,
} from "@/config/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The single inventory SKU. Created by scripts/stripe-setup.ts. */
const VIAL_SLUG = "baclab-10ml";

export async function POST(req: Request) {
  try {
    if (!verifyOrigin(req)) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 403 });
    }
    if (!rateLimit(`checkout:${clientIp(req)}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const parsed = CheckoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    const input = parsed.data;

    // Is this method switched on for this deployment? This is what makes
    // STRIPE_ENABLED=false reject a forged card body rather than just hiding
    // the button.
    if (!getPaymentConfig().methods.includes(input.method)) {
      return NextResponse.json({ error: "That payment method is not available." }, { status: 400 });
    }
    const provider = providerForMethod(input.method);

    // ── Pricing. The request carries a tier id and a count, never an amount.
    const bundle = bundleById(input.tierId);
    if (!bundle) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    const totalVials = bundle.vials * input.quantity;
    const grandTotalMinor = totalMinor(bundle, input.quantity);

    // Bundles divide exactly into whole pence per vial by construction
    // (750/1, 1950/3, 3000/5, 5000/10, 40000/100), so the packing slip's
    // unitPrice × qty always reconciles to the amount charged.
    const perVialMinorEffective = grandTotalMinor / totalVials;

    const product = await prisma.product.findUnique({ where: { slug: VIAL_SLUG } });
    if (!product || !product.active) {
      console.error(
        `[internal] checkout rejected — product "${VIAL_SLUG}" is missing or inactive. Run: npx tsx scripts/stripe-setup.ts`
      );
      return NextResponse.json(
        { error: "This product is not available for purchase right now" },
        { status: 400 }
      );
    }
    if (product.stock < totalVials) {
      return NextResponse.json({ error: "Not enough stock for that quantity" }, { status: 409 });
    }

    const total = new Prisma.Decimal((grandTotalMinor / 100).toFixed(2));

    // The crypto gateway settles in USD, so every order records a USD basis
    // whichever way it is paid.
    const rates = await fetchFxRates();
    const subtotalUsd = new Prisma.Decimal(
      priceIn({ priceGbp: total.toFixed(2) }, "USD", rates).toFixed(2)
    );

    const orderItems = [
      {
        productId: product.id,
        slug: product.slug,
        name: `${PRODUCT.name} ${PRODUCT.size}`,
        qty: totalVials,
        unitPrice: (perVialMinorEffective / 100).toFixed(2),
        unitPriceUsd: subtotalUsd.div(totalVials).toFixed(2),
        // Kept so the admin and the packing slip can show what was actually
        // bought, rather than an undifferentiated vial count.
        bundleId: bundle.id,
        bundleName: `${bundle.vials}-vial pack`,
        bundleQty: input.quantity,
      },
    ];

    const isCard = input.method === "card";

    const order = await prisma.order.create({
      data: {
        status: "pending",
        // Card orders start blank: Stripe collects the address and the webhook
        // backfills these before fulfilment.
        customerName: isCard ? "" : input.name,
        customerEmail: isCard ? "" : input.email,
        customerPhone: isCard ? "" : input.phone,
        shippingAddress: isCard
          ? ""
          : JSON.stringify({
              line1: input.addressLine1,
              line2: input.addressLine2 || null,
              city: input.city,
              country: input.country,
              postalCode: input.postalCode,
            }),
        items: JSON.stringify(orderItems),
        currency: "GBP",
        totalAmount: total,
        subtotalUsd,
        paymentMethod: input.method,
        paymentProvider: provider,
      },
    });

    const origin = originFromHeaders(req.headers);

    if (isCard) {
      // Resolve the Price from env and check it against the allowlist. A
      // Price ID that is not configured for one of our bundles can never be
      // reached from here.
      const priceId = priceIdFor(bundle.id as BundleId);
      if (!priceId || !allowedPriceIds().includes(priceId)) {
        console.error(
          `[internal] no Stripe Price configured for bundle "${bundle.id}". Run: npx tsx scripts/stripe-setup.ts`
        );
        return NextResponse.json(
          { error: "Card payment is not available right now" },
          { status: 503 }
        );
      }

      // Confirm Stripe will charge exactly what the page advertised. Skipped
      // only in the keyless dev simulator, which never charges anything.
      if (process.env.STRIPE_SECRET_KEY) {
        await assertPriceMatchesConfig(bundle.id as BundleId, priceId);
      }

      const checkout = await createBundleCheckout({
        orderId: order.id,
        bundleId: bundle.id as BundleId,
        priceId,
        quantity: input.quantity,
        shippingCountries: SHIPPING_COUNTRIES,
        origin,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentRef: checkout.paymentRef, notes: "Card payment (Stripe)" },
      });
      return NextResponse.json({ paymentUrl: checkout.paymentUrl, orderId: order.id });
    }

    const cryptoPayment = await createCryptoPayment({
      orderId: order.id,
      amount: subtotalUsd.toFixed(2), // USD total
      method: input.method as CryptoPaymentMethod,
      customerName: input.name,
      customerEmail: input.email,
      origin,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentRef: cryptoPayment.paymentRef,
        // Deposit details for the pay page; overwritten by the audit note on confirm.
        notes: buildPendingNote(cryptoPayment.payment),
      },
    });

    return NextResponse.json({ paymentUrl: cryptoPayment.paymentUrl, orderId: order.id });
  } catch (err) {
    // A price mismatch is a deployment fault, not a customer one. Log it in
    // full; tell the customer nothing about our configuration.
    console.error("[internal] checkout failed", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
