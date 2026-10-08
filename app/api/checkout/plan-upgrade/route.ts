import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PlanUpgradeSchema, verifyOrigin } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { originFromHeaders } from "@/lib/site-url";
import { getPaymentConfig } from "@/lib/payments/config";
import { attributionFor } from "@/lib/meta-capi-event";
import { checkoutSessionState, createPlanUpgradeCheckout, expireOpenCheckout } from "@/lib/payments/stripe";
import { planPrice } from "@/config/plans";
import { planRowData } from "@/lib/plans/items";
import { earlierUpgradeAction, upgradeEligibility, upgradePriceMinor, type EarlierUpgrade } from "@/lib/plans/upgrade";
import { priceIn } from "@/lib/fx";
import { fetchFxRates } from "@/lib/fx-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JUST_PAID = () =>
  NextResponse.json({ error: "That upgrade has just been paid. Refresh the page." }, { status: 409 });

/**
 * Turn a paid one-off order into box 1 of a 6- or 12-month plan. The order id
 * (an unguessable UUID, the same key as its confirmation page) is the only
 * credential. Eligibility is checked again here, from the database, before
 * any money is asked for.
 *
 * Idempotent per original order (earlierUpgradeAction): a second click for the
 * same term reuses the open Stripe page; choosing the other term closes the
 * first page so only one can be paid; and once any page has been paid, even
 * before its webhook lands, no new page is made. If two are paid anyway,
 * activation lets only the first take box 1 and records the second as a
 * refund due (lib/plans/activate.ts).
 */
export async function POST(req: Request) {
  try {
    if (!verifyOrigin(req)) return NextResponse.json({ error: "Something went wrong" }, { status: 403 });
    if (!rateLimit(`plan-upgrade:${clientIp(req)}`, 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    }
    const parsed = PlanUpgradeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (!getPaymentConfig().methods.includes("card")) {
      return NextResponse.json({ error: "Card payment is not available right now" }, { status: 400 });
    }
    const { orderId, months, trackingConsent } = parsed.data;

    const original = await prisma.order.findUnique({ where: { id: orderId } });
    if (!original) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const verdict = upgradeEligibility(original, new Date());
    if (!verdict.eligible) {
      return NextResponse.json({ error: "This order can no longer be turned into a plan." }, { status: 409 });
    }
    const plan = planPrice(verdict.packId, months);
    const priceMinor = upgradePriceMinor(verdict.packId, months);

    // Upgrades already started for this order whose payment has not landed,
    // newest first, each with one read of its Stripe page.
    const earlier = await prisma.plan.findMany({
      where: { upgradeOfOrderId: original.id, status: "pending" },
      include: { purchaseOrder: { select: { id: true, status: true, paymentRef: true } } },
      orderBy: { createdAt: "desc" },
    });
    const sessions: EarlierUpgrade[] = [];
    for (const p of earlier) {
      const ref = p.purchaseOrder.paymentRef;
      if (p.purchaseOrder.status !== "pending" || !ref) continue;
      const { status, url } = await checkoutSessionState(ref);
      sessions.push({ orderId: p.purchaseOrder.id, months: p.months, sessionId: ref, state: status, url });
    }
    // A page already paid (its webhook still on the way) blocks a second one,
    // whichever term it was for. Other terms' pages are closed BEFORE a
    // same-term page is reused, so only one can ever be paid.
    const next = earlierUpgradeAction(sessions, months);
    if (next.action === "paid") return JUST_PAID();
    for (const sessionId of next.expire) {
      if ((await expireOpenCheckout(sessionId)) === "complete") return JUST_PAID();
    }
    if (next.reuse) return NextResponse.json({ paymentUrl: next.reuse.url, orderId: next.reuse.orderId });

    const total = new Prisma.Decimal((priceMinor / 100).toFixed(2));
    const rates = await fetchFxRates();
    const subtotalUsd = new Prisma.Decimal(priceIn({ priceGbp: total.toFixed(2) }, "USD", rates).toFixed(2));

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          status: "pending",
          kind: "plan_upgrade",
          customerName: original.customerName,
          customerEmail: original.customerEmail,
          customerPhone: original.customerPhone,
          shippingAddress: original.shippingAddress,
          // A payment, not a parcel: no lines, no stock, no label.
          items: "[]",
          currency: "GBP",
          totalAmount: total,
          subtotalUsd,
          paymentMethod: "card",
          paymentProvider: "stripe",
          notes: `Upgrade of order ${original.id.slice(0, 8).toUpperCase()} to a ${months}-month plan`,
          ...attributionFor(trackingConsent === true, {
            cookie: req.headers.get("cookie"),
            userAgent: req.headers.get("user-agent"),
            ip: req.headers.get("cf-connecting-ip") ?? clientIp(req),
          }),
        },
      });
      const row = await tx.plan.create({
        data: {
          ...planRowData(plan, "upgrade"),
          upgradeOfOrderId: original.id,
          purchaseOrderId: created.id,
          email: original.customerEmail,
        },
      });
      return tx.order.update({ where: { id: created.id }, data: { planId: row.id } });
    });

    const checkout = await createPlanUpgradeCheckout({
      orderId: order.id,
      originalOrderId: original.id,
      plan,
      priceMinor,
      email: original.customerEmail,
      origin: originFromHeaders(req.headers),
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentRef: checkout.paymentRef } });
    return NextResponse.json({ paymentUrl: checkout.paymentUrl, orderId: order.id });
  } catch (err) {
    console.error("[internal] plan upgrade checkout failed", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
