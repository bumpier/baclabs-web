import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { verifyStripeEvent } from "@/lib/payments/stripe";
import { fulfillPaidOrder } from "@/lib/payments/fulfillment";

// Stripe SDK (crypto) + Prisma (DB) — Edge can't run these.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pull the delivery address out of a Checkout Session.
 *
 * Stripe moved this from `session.shipping_details` to
 * `session.collected_information.shipping_details`. Both are read so the
 * handler keeps working across an API-version bump, falling back to the
 * billing address when no shipping address was collected.
 */
function extractShipping(session: Stripe.Checkout.Session) {
  const withCollected = session as Stripe.Checkout.Session & {
    collected_information?: {
      shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null;
    } | null;
    shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null;
  };
  const details =
    withCollected.collected_information?.shipping_details ?? withCollected.shipping_details ?? null;

  const address = details?.address ?? session.customer_details?.address ?? null;
  const name = details?.name ?? session.customer_details?.name ?? "";
  return { name, address };
}

export async function POST(req: Request) {
  // Raw body BEFORE parsing — the signature is over these bytes.
  const raw = await req.text();

  // Both keys must be configured — verifyStripeEvent needs the webhook secret
  // to check the signature and the secret key to build the client. A missing
  // key is a server misconfiguration (500, so Stripe keeps retrying until the
  // operator recovers), never a forged-signature 400.
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error(
      "[stripe] STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET is not set — refusing to process. Set STRIPE_ENABLED=false to disable cards; do not delete the keys."
    );
    return NextResponse.json({ error: "Stripe keys not configured" }, { status: 500 });
  }

  // Signature over the raw bytes. A genuine mismatch — and only that — is 400.
  const signature = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = verifyStripeEvent(raw, signature);
  } catch (err) {
    console.warn("[stripe] webhook signature verification failed", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // A test-mode event arriving on a live deployment (a test endpoint's signing
  // secret configured in production) would otherwise fulfil real orders for
  // free. Unrecognised key prefixes are treated as live, so a restricted live
  // key never blocks genuine events.
  const expectLive = !/^(sk|rk)_test_/.test(secretKey);
  if (event.livemode !== expectLive) {
    console.error(
      `[stripe] livemode mismatch: event.livemode=${event.livemode} but STRIPE_SECRET_KEY is a ${expectLive ? "live" : "test"} key — ignoring event ${event.id}`
    );
    return NextResponse.json({ received: true, ignored: "livemode-mismatch" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Guard against async payment methods that complete later as "unpaid".
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true, ignored: "not-paid" });
      }

      const orderId = session.metadata?.orderId ?? session.client_reference_id ?? undefined;
      if (!orderId) {
        console.warn(`[stripe] session ${session.id} carried no orderId — acknowledging`);
        return NextResponse.json({ received: true, ignored: "no-order-id" });
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        console.warn(`[stripe] unknown order ${orderId} — acknowledging`);
        return NextResponse.json({ received: true, ignored: "unknown-order" });
      }

      // Reconcile what Stripe actually captured against what we recorded.
      // This does not block fulfilment — the money is already taken, and
      // refusing here would only strand a paid order — but a mismatch means
      // a Price drifted from config and must be investigated.
      const expectedMinor = Math.round(Number(order.totalAmount) * 100);
      if (typeof session.amount_total === "number" && session.amount_total !== expectedMinor) {
        console.error(
          `[stripe] AMOUNT MISMATCH on order ${orderId}: Stripe captured ${session.amount_total} but the order records ${expectedMinor}. A promotion code explains a lower figure; anything else means STRIPE_PRICE_* has drifted from config/funnel.ts.`
        );
      }

      // Stripe collected the address, not us — write it onto the order BEFORE
      // fulfilling, so the confirmation email and packing slip have somewhere
      // to ship to.
      const { name, address } = extractShipping(session);
      const email = session.customer_details?.email ?? "";
      const phone = session.customer_details?.phone ?? "";

      await prisma.order.update({
        where: { id: orderId },
        data: {
          ...(email ? { customerEmail: email } : {}),
          ...(name ? { customerName: name } : {}),
          ...(phone ? { customerPhone: phone } : {}),
          ...(address
            ? {
                shippingAddress: JSON.stringify({
                  line1: address.line1 ?? "",
                  line2: address.line2 ?? null,
                  city: address.city ?? "",
                  country: address.country ?? "",
                  postalCode: address.postal_code ?? "",
                }),
              }
            : {}),
        },
      });

      const paymentRef =
        typeof session.payment_intent === "string" ? session.payment_intent : session.id;

      const { alreadyPaid } = await fulfillPaidOrder(orderId, {
        paymentRef,
        provider: "stripe",
      });

      // The customer confirmation and the owner alert are sent from
      // fulfillPaidOrder(). Hook shipping-label creation, accounting export
      // or a 3PL handoff in there, not here — that keeps every payment
      // provider on one code path.
      console.log(
        `[stripe] order ${orderId} ${alreadyPaid ? "was already paid (duplicate delivery)" : "marked paid"} — ref ${paymentRef}, ${session.amount_total} ${session.currency}`
      );
    }

    // Unknown orders and duplicates are acknowledged so Stripe stops retrying.
    return NextResponse.json({ received: true });
  } catch (err) {
    // Unexpected failure — let Stripe retry.
    console.error("[stripe] webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
