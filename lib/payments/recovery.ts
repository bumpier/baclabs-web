import type { Order, Subscriber } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deliveryChoiceEnabled, deliveryDetailAt, deliveryOptionById } from "@/config/funnel";
import { SUBSCRIBER_COOKIE, cookieFrom, isLinkToken, normEmail, subscriberFromCookie } from "@/lib/mailing-list";
import { orderKind } from "@/lib/plans/kinds";
import { reorderOffer } from "@/lib/reorder";
import { sendCheckoutRecoveryEmail } from "@/lib/customer-email";

/**
 * Abandoned-checkout recovery, for card checkouts on Stripe's hosted page.
 *
 * Who can be emailed: only mailing-list subscribers recognised by their
 * cookie when the checkout began (recoverySubscriber). Stripe returns no
 * email for an expired session unless the customer ticked its promotions
 * box, and that box is US-only, so for a UK shop the subscribers, who have
 * already agreed to marketing email, are the whole audience.
 *
 * How: their sessions get Stripe's recovery link and expire after an hour
 * (lib/payments/stripe.ts). When one expires, the webhook calls
 * handleExpiredCheckout, which emails the subscriber once, with a button to
 * /api/checkout/resume. That route (resumeTarget) sends them to Stripe's
 * recovery link, a copy of the session as they left it, or, if the link has
 * lapsed or the price or the next-day date has changed since, to the buy box
 * set to the same order. The pending order is kept while the link can still
 * be paid (lib/payments/abandoned.ts), and a recovered session completes the
 * same order (orderForSession).
 */

/** Recovery emails to one address at most this often. */
const EMAIL_GAP_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The subscriber a card checkout can be recovered for, or null. The cookie
 * must have been set by signing up on this browser: one set by an email's
 * link (isLinkToken) can travel with a forwarded email, and must never send
 * the subscriber mail about someone else's basket.
 */
export async function recoverySubscriber(cookieHeader: string | null): Promise<Subscriber | null> {
  const token = cookieFrom(cookieHeader, SUBSCRIBER_COOKIE);
  if (!token || isLinkToken(token)) return null;
  try {
    const sub = await subscriberFromCookie(cookieHeader);
    return sub?.status === "subscribed" ? sub : null;
  } catch (err) {
    // A lookup failure costs a reminder, never the sale.
    console.error("[recovery] subscriber lookup failed at checkout", err);
    return null;
  }
}

// ── Pure rules (scripts/test-recovery.ts) ─────────────────────────────

export type RecipientVerdict = { to: string } | { skip: string };

/** Whether to email, and whom. Every database fact already looked up. */
export function recoveryRecipient(input: {
  subscriber: { email: string; status: string } | null;
  optedOut: boolean;
  /** A paid order for that email placed since this checkout began. */
  paidSince: boolean;
  /** The same subscriber began another checkout after this one. */
  laterCheckout: boolean;
  /** A recovery email went to that address within EMAIL_GAP_MS. */
  recentlyEmailed: boolean;
}): RecipientVerdict {
  const { subscriber } = input;
  if (!subscriber) return { skip: "no known email" };
  if (subscriber.status !== "subscribed") return { skip: "unsubscribed" };
  if (input.optedOut) return { skip: "opted out of email" };
  if (input.paidSince) return { skip: "has ordered since" };
  if (input.laterCheckout) return { skip: "started a later checkout" };
  if (input.recentlyEmailed) return { skip: "emailed recently" };
  return { to: normEmail(subscriber.email) };
}

export interface ResumableOrder {
  id: string;
  status: string;
  items: string;
  totalAmount: { toString(): string } | number;
  createdAt: Date;
  recoveryUrl: string | null;
  recoveryExpiresAt: Date | null;
}

/**
 * Where the email's button takes someone. Stripe's recovery link only while
 * it still charges what the order says and promises the same delivery;
 * otherwise a fresh checkout from the buy box, set to the same order.
 */
export function resumeTarget(input: { order: ResumableOrder | null; newerPaidOrder: boolean; now: Date }): string {
  const { order, now } = input;
  if (!order) return "/#buy";
  if (order.status !== "pending") return `/order-confirmation/${order.id}`;
  if (input.newerPaidOrder) return "/#buy";

  const offer = reorderOffer(order.items);
  const fresh = offer ? offer.link : "/#buy";
  if (!order.recoveryUrl || !order.recoveryExpiresAt || now.getTime() >= order.recoveryExpiresAt.getTime()) return fresh;

  // Re-priced since: the copied session would charge the old figure.
  if (!offer || offer.goodsMinor !== Math.round(Number(order.totalAmount.toString()) * 100)) return fresh;

  // The copied session's next-day option names the day it would have
  // arrived when the checkout began (deliveryDetailAt). If that day has
  // moved on, start again so the date shown is true.
  const nextDay = deliveryOptionById("next_day");
  if (deliveryChoiceEnabled() && nextDay && deliveryDetailAt(nextDay, order.createdAt) !== deliveryDetailAt(nextDay, now)) {
    return fresh;
  }
  return order.recoveryUrl;
}

// ── Stripe sessions → orders ──────────────────────────────────────────

/** The parts of a Checkout Session this file reads. */
export interface SessionLike {
  id: string;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  recovered_from?: string | null;
  after_expiration?: { recovery?: { url?: string | null; expires_at?: number | null } | null } | null;
}

/**
 * The order a session pays for. A recovered session is a copy of the expired
 * one; if its order id did not come across with it, the expired session it
 * was recovered from is still the order's paymentRef (set at checkout, only
 * replaced on payment).
 */
export async function orderForSession(session: SessionLike): Promise<Order | null> {
  const id = session.metadata?.orderId ?? session.client_reference_id ?? null;
  if (id) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (order) return order;
  }
  if (session.recovered_from) {
    return prisma.order.findFirst({ where: { paymentRef: session.recovered_from } });
  }
  return null;
}

/**
 * A paid order for this email placed at or after `since`. Raw SQL for the
 * case-insensitive email match (as previousOrderCount); the date goes in as
 * epoch milliseconds, which is how Prisma stores DateTime in SQLite: a Date
 * would bind as text, and SQLite orders every integer before any text.
 */
export async function paidOrderSince(email: string, since: Date, inclusive = true): Promise<boolean> {
  const at = since.getTime();
  const rows = inclusive
    ? await prisma.$queryRaw<{ n: bigint | number }[]>`
        SELECT COUNT(*) AS n FROM "Order"
        WHERE lower("customerEmail") = ${normEmail(email)}
          AND "status" NOT IN ('pending', 'cancelled')
          AND "createdAt" >= ${at}`
    : await prisma.$queryRaw<{ n: bigint | number }[]>`
        SELECT COUNT(*) AS n FROM "Order"
        WHERE lower("customerEmail") = ${normEmail(email)}
          AND "status" NOT IN ('pending', 'cancelled')
          AND "createdAt" > ${at}`;
  return Number(rows[0]?.n ?? 0) > 0;
}

/**
 * A Checkout Session expired (webhook: checkout.session.expired). Emails the
 * subscriber behind it once, when the rules allow. Returns what it did, for
 * the log. Database errors propagate, so the webhook asks Stripe to retry.
 */
export async function handleExpiredCheckout(session: SessionLike, now = new Date()): Promise<string> {
  const url = session.after_expiration?.recovery?.url ?? null;
  const expiresAtSec = session.after_expiration?.recovery?.expires_at ?? null;
  if (!url || !expiresAtSec) return "no recovery link";

  const order = await orderForSession(session);
  if (!order) return "unknown order";
  if (order.status !== "pending" || orderKind(order.kind) !== "sale" || order.planId) return "not a pending sale";
  const expiresAt = new Date(expiresAtSec * 1000);

  // A recovered copy that expired in turn: keep the newest link, so the
  // order is kept while it can be paid, and never email twice.
  if (order.recoveryEmailSentAt) {
    if (!order.recoveryExpiresAt || expiresAt > order.recoveryExpiresAt) {
      await prisma.order.update({ where: { id: order.id }, data: { recoveryUrl: url, recoveryExpiresAt: expiresAt } });
    }
    return "already emailed";
  }

  if (!order.checkoutSubscriberId) return "no known email";
  const subscriber = await prisma.subscriber.findUnique({ where: { id: order.checkoutSubscriberId } });
  const email = subscriber ? normEmail(subscriber.email) : null;
  const verdict = recoveryRecipient({
    subscriber,
    optedOut: email ? (await prisma.emailOptOut.findUnique({ where: { email } })) !== null : false,
    paidSince: email ? await paidOrderSince(email, order.createdAt) : false,
    laterCheckout:
      (await prisma.order.count({
        where: { checkoutSubscriberId: order.checkoutSubscriberId, createdAt: { gt: order.createdAt } },
      })) > 0,
    recentlyEmailed: email
      ? (await prisma.order.count({
          where: { recoveryEmail: email, recoveryEmailSentAt: { gte: new Date(now.getTime() - EMAIL_GAP_MS) } },
        })) > 0
      : false,
  });
  if ("skip" in verdict) return verdict.skip;

  // Claimed before sending: a second delivery of the same event finds the
  // slot taken. The link is stored with the claim, so the order is kept.
  const claim = await prisma.order.updateMany({
    where: { id: order.id, status: "pending", recoveryEmailSentAt: null },
    data: { recoveryUrl: url, recoveryExpiresAt: expiresAt, recoveryEmail: verdict.to, recoveryEmailSentAt: now },
  });
  if (claim.count === 0) return "already emailed";
  const sent = await sendCheckoutRecoveryEmail(order, verdict.to, expiresAt);
  return sent ? "sent" : "send failed";
}
