import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CheckoutSchema, verifyOrigin, type PlanCheckoutInput } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { originFromHeaders } from "@/lib/site-url";
import {
  createCryptoPayment,
  buildPendingNote,
  type CryptoPaymentMethod,
} from "@/lib/crypto-gateway";
import { createBundleCheckout, createPlanCheckout, assertPriceMatchesConfig } from "@/lib/payments/stripe";
import { planPrice, BONUS_PACK_ID } from "@/config/plans";
import { planPurchaseItems, planRowData } from "@/lib/plans/items";
import type { Product, Subscriber } from "@prisma/client";
import { cleanDeliveryInstructions } from "@/lib/smarttrack/payload";
import { getPaymentConfig, providerForMethod, type PaymentProvider } from "@/lib/payments/config";
import { attributionFor } from "@/lib/meta-capi-event";
import { getInventoryMode } from "@/lib/inventory/mode";
import { canSupply } from "@/lib/inventory/store";
import { VIAL_SKU_CODE } from "@/lib/inventory/demand";
import { buildOrderItems } from "@/lib/order-items";
import {
  SUBSCRIBER_COOKIE,
  cookieFrom,
  isLinkToken,
  welcomeForCheckout,
  welcomeItem,
  welcomeVialCount,
} from "@/lib/mailing-list";
import { priceIn } from "@/lib/fx";
import { fetchFxRates } from "@/lib/fx-rates";
import {
  bundleById,
  allowedPriceIds,
  priceIdFor,
  priceOrder,
  SINGLE_BUNDLE,
  deliveryChoiceEnabled,
  deliveryOptionsFor,
  SHIPPING_COUNTRIES,
  PRODUCT,
  STANDARD_DELIVERY,
  type BundleId,
  type DeliveryOptionId,
} from "@/config/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The single inventory SKU. Created by scripts/stripe-setup.ts. */
const VIAL_SLUG = "baclab-10ml";

/** An item the order takes off the shelves, by SKU code. */
type ShelfLine = { code: string; quantity: number };

/**
 * The mailing-list welcome vial, when this browser (or, for crypto, this
 * email) belongs to a subscriber who has not ordered yet. Only added when
 * the shelves can cover it on top of the order: a missing gift is better
 * than a failed sale. `paidVials` sets the reminder bonus; `shelfVials` is
 * what the order itself takes off the shelf (legacy stock); `paidLines` is
 * the same in warehouse terms.
 */
async function welcomeForOrder(
  req: Request,
  opts: { email?: string; paidLines: ShelfLine[]; paidVials: number; shelfVials: number; product: Product }
): Promise<{ welcome: Subscriber | null; welcomeQty: number }> {
  let welcome = await welcomeForCheckout({
    cookieHeader: req.headers.get("cookie"),
    email: opts.email,
  });
  // One vial, or more with the reminder bonus on a big enough order.
  let welcomeQty = welcome ? welcomeVialCount(welcome, opts.paidVials) : 0;
  if (welcome) {
    if ((await getInventoryMode()) === "warehouse") {
      // The order and the gift together, off the same shelves: a pack made
      // up from loose vials draws on the vial the gift would be.
      const fits = async (n: number) =>
        (await canSupply([...opts.paidLines, { code: VIAL_SKU_CODE, quantity: n }])) === "ok";
      // Short of the bonus vials: the one vial. Short of that: none.
      if (!(await fits(welcomeQty))) welcomeQty = welcomeQty > 1 && (await fits(1)) ? 1 : 0;
    } else {
      const spare = opts.product.stock - opts.shelfVials;
      if (spare < welcomeQty) welcomeQty = spare >= 1 ? 1 : 0;
    }
    if (welcomeQty === 0) welcome = null;
  }
  return { welcome, welcomeQty };
}

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
    if ("plan" in input) return await planCheckout(req, input, provider);

    // ── Pricing. The request carries a tier id and a count, never an amount.
    const bundle = bundleById(input.tierId);
    if (!bundle) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    // The packs plus any loose vials (priceOrder): null for loose vials on
    // the single tier, which a bigger quantity already covers.
    const extraVials = input.extraVials ?? 0;
    const priced = priceOrder(bundle, input.quantity, extraVials);
    if (!priced) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    const totalVials = priced.vials;
    const grandTotalMinor = priced.goodsMinor;
    const paidLines: ShelfLine[] = [
      { code: bundle.sku, quantity: input.quantity },
      ...(extraVials > 0 ? [{ code: SINGLE_BUNDLE.sku, quantity: extraVials }] : []),
    ];

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
    // Which stock count to sell against — see lib/inventory/mode.ts. In
    // warehouse mode a pack is sellable as far as the shelves can make it
    // up: its own stock if pre-packed, its components' if it is a kit.
    // The pack and the loose vials are checked together (canSupply): both
    // can draw on the same shelf of vials.
    if ((await getInventoryMode()) === "warehouse") {
      const supply = await canSupply(paidLines);
      if (supply === "unavailable") {
        console.error(
          `[internal] checkout rejected — no active SKU for ${paidLines.map((l) => `"${l.code}"`).join(" or ")} in warehouse mode. Create it on /admin/inventory.`
        );
        return NextResponse.json(
          { error: "This product is not available for purchase right now" },
          { status: 400 }
        );
      }
      if (supply === "short") {
        return NextResponse.json({ error: "Not enough stock for that quantity" }, { status: 409 });
      }
    } else if (product.stock < totalVials) {
      return NextResponse.json({ error: "Not enough stock for that quantity" }, { status: 409 });
    }

    // The mailing-list welcome vial: see welcomeForOrder.
    const { welcome, welcomeQty } = await welcomeForOrder(req, {
      email: input.method === "card" ? undefined : input.email,
      paidLines,
      paidVials: totalVials,
      shelfVials: totalVials,
      product,
    });

    // Crypto orders choose delivery here; card orders choose it on Stripe's
    // page and the webhook records it. The price is always looked up, never
    // taken from the request.
    let delivery: { option: DeliveryOptionId; minor: number } | null = null;
    if (input.method !== "card") {
      const offered = deliveryOptionsFor(grandTotalMinor);
      if (offered.length > 0) {
        const chosen = offered.find((o) => o.option.id === input.deliveryOption);
        if (!chosen) {
          return NextResponse.json(
            { error: "That delivery option is not available for this order." },
            { status: 400 }
          );
        }
        delivery = { option: chosen.option.id, minor: chosen.priceMinor };
      }
    }

    const total = new Prisma.Decimal((grandTotalMinor / 100).toFixed(2));

    // The crypto gateway settles in USD, so every order records a USD basis
    // whichever way it is paid.
    const rates = await fetchFxRates();
    const subtotalUsd = new Prisma.Decimal(
      priceIn({ priceGbp: total.toFixed(2) }, "USD", rates).toFixed(2)
    );

    const orderItems = [
      ...buildOrderItems({
        productId: product.id,
        slug: product.slug,
        bundle,
        quantity: input.quantity,
        priced,
        goodsUsd: subtotalUsd.toFixed(2),
      }),
      // £0, so every total that sums lineTotal still matches the charge.
      ...(welcome ? [welcomeItem(product.id, product.slug, welcomeQty)] : []),
    ];

    const isCard = input.method === "card";
    // Card orders give theirs on Stripe's page; the webhook records it.
    const instructions =
      input.method !== "card" && deliveryChoiceEnabled() ? cleanDeliveryInstructions(input.deliveryInstructions) : null;

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
        ...(welcome ? { welcomeSubscriberId: welcome.id } : {}),
        ...(delivery ? { deliveryOption: delivery.option, deliveryMinor: delivery.minor } : {}),
        ...(instructions ? { deliveryInstructions: instructions } : {}),
        // Read now: the payment webhook comes from the provider's servers and
        // never sees the customer's IP, browser or Meta cookies. Kept only
        // with consent — see lib/meta-capi-event.ts.
        ...attributionFor(input.trackingConsent === true, {
          cookie: req.headers.get("cookie"),
          userAgent: req.headers.get("user-agent"),
          // Cloudflare's header first: the client can prepend its own
          // X-Forwarded-For entries, but not this.
          ip: req.headers.get("cf-connecting-ip") ?? clientIp(req),
        }),
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

      // Loose vials are charged at the single tier's Price, checked the same
      // way. Only an order that has some needs it.
      const extrasPriceId = extraVials > 0 ? priceIdFor(SINGLE_BUNDLE.id) : null;
      if (extraVials > 0 && (!extrasPriceId || !allowedPriceIds().includes(extrasPriceId))) {
        console.error(
          `[internal] no Stripe Price configured for the single tier, needed for loose vials. Run: npx tsx scripts/stripe-setup.ts`
        );
        return NextResponse.json({ error: "Card payment is not available right now" }, { status: 503 });
      }

      // Confirm Stripe will charge exactly what the page advertised. Skipped
      // only in the keyless dev simulator, which never charges anything.
      if (process.env.STRIPE_SECRET_KEY) {
        await assertPriceMatchesConfig(bundle.id as BundleId, priceId);
        if (extrasPriceId) await assertPriceMatchesConfig(SINGLE_BUNDLE.id, extrasPriceId);
      }

      const checkout = await createBundleCheckout({
        orderId: order.id,
        bundleId: bundle.id as BundleId,
        priceId,
        quantity: input.quantity,
        ...(extrasPriceId ? { extras: { priceId: extrasPriceId, quantity: extraVials } } : {}),
        orderValueMinor: grandTotalMinor,
        shippingCountries: SHIPPING_COUNTRIES,
        origin,
        ...(welcome
          ? {
              welcome: {
                qty: welcomeQty,
                // The subscriber's email is locked onto Stripe's page only
                // for the browser that signed up, never for one that merely
                // followed an email's link: see isLinkToken().
                ...(isLinkToken(cookieFrom(req.headers.get("cookie"), SUBSCRIBER_COOKIE))
                  ? {}
                  : { email: welcome.email }),
              },
            }
          : {}),
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentRef: checkout.paymentRef, notes: "Card payment (Stripe)" },
      });
      return NextResponse.json({ paymentUrl: checkout.paymentUrl, orderId: order.id });
    }

    // Goods plus the chosen delivery, in USD. subtotalUsd stays goods-only,
    // like totalAmount.
    const chargeUsd = delivery
      ? priceIn({ priceGbp: ((grandTotalMinor + delivery.minor) / 100).toFixed(2) }, "USD", rates).toFixed(2)
      : subtotalUsd.toFixed(2);
    const cryptoPayment = await createCryptoPayment({
      orderId: order.id,
      amount: chargeUsd, // USD total
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

/**
 * A prepaid monthly plan (config/plans.ts): box 1 is this order, the
 * Plan row is created pending beside it, and both go live together when
 * the payment lands (lib/plans/activate.ts via fulfillPaidOrder). Card
 * only (PlanCheckoutSchema). Only box 1 is checked against stock: later
 * boxes are a promise the cron keeps.
 */
async function planCheckout(req: Request, input: PlanCheckoutInput, provider: PaymentProvider) {
  const plan = planPrice(input.plan.pack, input.plan.months);
  const bonus = plan.bonusVials > 0 ? bundleById(BONUS_PACK_ID)! : null;

  const product = await prisma.product.findUnique({ where: { slug: VIAL_SLUG } });
  if (!product || !product.active) {
    console.error(`[internal] plan checkout rejected: product "${VIAL_SLUG}" is missing or inactive. Run: npx tsx scripts/stripe-setup.ts`);
    return NextResponse.json({ error: "This product is not available for purchase right now" }, { status: 400 });
  }

  // Box 1: the pack, and the bonus pack on a 12-month plan.
  // Checked together (canSupply): the pack and the bonus pack can both be
  // made up from the same shelf of vials.
  const paidLines: ShelfLine[] = [{ code: plan.pack.sku, quantity: 1 }, ...(bonus ? [{ code: bonus.sku, quantity: 1 }] : [])];
  if ((await getInventoryMode()) === "warehouse") {
    const supply = await canSupply(paidLines);
    if (supply === "unavailable") {
      console.error(
        `[internal] plan checkout rejected: no active SKU for ${paidLines.map((l) => `"${l.code}"`).join(" or ")} in warehouse mode. Create it on /admin/inventory.`
      );
      return NextResponse.json({ error: "This product is not available for purchase right now" }, { status: 400 });
    }
    if (supply === "short") return NextResponse.json({ error: "Not enough stock for that plan" }, { status: 409 });
  } else if (product.stock < plan.pack.vials + plan.bonusVials) {
    return NextResponse.json({ error: "Not enough stock for that plan" }, { status: 409 });
  }

  const { welcome, welcomeQty } = await welcomeForOrder(req, {
    paidLines,
    paidVials: plan.pack.vials,
    shelfVials: plan.pack.vials + plan.bonusVials,
    product,
  });

  const total = new Prisma.Decimal((plan.totalMinor / 100).toFixed(2));
  const rates = await fetchFxRates();
  const subtotalUsd = new Prisma.Decimal(priceIn({ priceGbp: total.toFixed(2) }, "USD", rates).toFixed(2));
  const items = [
    ...planPurchaseItems({ productId: product.id, slug: product.slug, plan, totalUsd: subtotalUsd.toFixed(2) }),
    ...(welcome ? [welcomeItem(product.id, product.slug, welcomeQty)] : []),
  ];

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        status: "pending",
        kind: "sale",
        items: JSON.stringify(items),
        currency: "GBP",
        totalAmount: total,
        subtotalUsd,
        paymentMethod: "card",
        paymentProvider: provider,
        // Every plan box goes Standard (Royal Mail Tracked 48), whatever the pack.
        deliveryOption: STANDARD_DELIVERY.id,
        ...(welcome ? { welcomeSubscriberId: welcome.id } : {}),
        ...attributionFor(input.trackingConsent === true, {
          cookie: req.headers.get("cookie"),
          userAgent: req.headers.get("user-agent"),
          ip: req.headers.get("cf-connecting-ip") ?? clientIp(req),
        }),
      },
    });
    const row = await tx.plan.create({ data: { ...planRowData(plan, "checkout"), purchaseOrderId: created.id } });
    return tx.order.update({ where: { id: created.id }, data: { planId: row.id, planBox: 1 } });
  });

  const checkout = await createPlanCheckout({
    orderId: order.id,
    plan,
    shippingCountries: SHIPPING_COUNTRIES,
    origin: originFromHeaders(req.headers),
    ...(welcome
      ? {
          welcome: {
            qty: welcomeQty,
            ...(isLinkToken(cookieFrom(req.headers.get("cookie"), SUBSCRIBER_COOKIE)) ? {} : { email: welcome.email }),
          },
        }
      : {}),
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentRef: checkout.paymentRef, notes: `Card payment (Stripe), ${plan.months}-month plan` },
  });
  return NextResponse.json({ paymentUrl: checkout.paymentUrl, orderId: order.id });
}
