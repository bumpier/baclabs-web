import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/payments/stripe";
import { GATEWAY_PROVIDER, parsePendingNote } from "@/lib/crypto-gateway";

/**
 * Abandoned checkouts: pending orders that can no longer be paid.
 *
 * Checkout creates the order before the customer reaches the payment page, so
 * every checkout that is never finished leaves a pending order behind. They
 * are deleted once nothing can pay them any more — never on age alone,
 * because a payment that lands on a deleted order is money taken with no
 * order to send: both webhooks acknowledge an unknown order and stop. So each
 * order is judged by what its payment provider says:
 *
 * - Card: Stripe keeps a Checkout page payable for 24 hours and retries a
 *   failed webhook for days after, so Stripe is asked. Only an expired
 *   session clears. A complete one means the customer paid but our webhook
 *   never landed — that is logged and the order kept.
 * - Crypto: the gateway sets a payment window, kept in the order's notes. The
 *   order clears a day after it closes, so a deposit sent in time can still
 *   confirm.
 * - No payment attached (checkout failed before reaching a provider): after
 *   an hour, long enough that the checkout is not still in progress.
 * - Anything else that cannot be asked (the dev Stripe simulator, a crypto
 *   order with no window recorded): after three days.
 * - Whatever the above says: an order whose recovery email has gone out
 *   (lib/payments/recovery.ts) is kept until its link stops working, plus a
 *   day, because Stripe's link opens a copy of the expired session that
 *   pays this order, and that copy can be opened on the link's last day.
 *
 * Run nightly by /api/cron/clear-pending, and on demand from the orders page.
 */

const HOUR_MS = 60 * 60 * 1000;
const NO_PAYMENT_GRACE_MS = HOUR_MS;
const CRYPTO_GRACE_MS = 24 * HOUR_MS;
const FALLBACK_AGE_MS = 72 * HOUR_MS;
/** A recovered session opened on the link's last day stays open 24 hours, then the webhook. */
const RECOVERY_GRACE_MS = 25 * HOUR_MS;

export type StripeSessionStatus = "open" | "complete" | "expired" | null;

export type Verdict = { clear: true } | { clear: false; reason: string };

const CLEAR: Verdict = { clear: true };
const keep = (reason: string): Verdict => ({ clear: false, reason });

export interface PendingOrder {
  id: string;
  paymentProvider: string | null;
  paymentRef: string | null;
  notes: string | null;
  createdAt: Date;
  /** Set when a recovery email went out, with when its link stops working. */
  recoveryEmailSentAt?: Date | null;
  recoveryExpiresAt?: Date | null;
}

/** Whether one pending order can be cleared. `stripeStatus` looks up a Checkout Session. */
export async function abandonedVerdict(
  order: PendingOrder,
  now: Date,
  stripeStatus: (sessionId: string) => Promise<StripeSessionStatus>
): Promise<Verdict> {
  const age = now.getTime() - order.createdAt.getTime();

  if (
    order.recoveryEmailSentAt &&
    order.recoveryExpiresAt &&
    now.getTime() < order.recoveryExpiresAt.getTime() + RECOVERY_GRACE_MS
  ) {
    return keep("recovery link still open");
  }

  if (!order.paymentRef) {
    return age > NO_PAYMENT_GRACE_MS ? CLEAR : keep("checkout still in progress");
  }

  const realStripeSession =
    order.paymentProvider === "stripe" &&
    order.paymentRef.startsWith("cs_") &&
    !order.paymentRef.startsWith("cs_sim_");
  if (realStripeSession) {
    let status: StripeSessionStatus;
    try {
      status = await stripeStatus(order.paymentRef);
    } catch (err) {
      console.error(`[internal] could not check Stripe session for pending order ${order.id}`, err);
      return keep("could not check with Stripe");
    }
    if (status === "expired") return CLEAR;
    if (status === "complete") {
      console.error(
        `[internal] order ${order.id} is paid at Stripe but still pending here — check the Stripe webhook`
      );
      return keep("paid at Stripe but not confirmed here");
    }
    return keep("payment page still open");
  }

  if (order.paymentProvider === GATEWAY_PROVIDER) {
    const closes = Date.parse(parsePendingNote(order.notes)?.expiresAt ?? "");
    if (Number.isFinite(closes)) {
      return now.getTime() > closes + CRYPTO_GRACE_MS ? CLEAR : keep("crypto payment window still open");
    }
  }

  return age > FALLBACK_AGE_MS ? CLEAR : keep("too recent to be sure");
}

export interface ClearResult {
  cleared: number;
  /** Pending orders left alone, counted by reason. */
  kept: Record<string, number>;
}

/** Delete every pending order that can no longer be paid. */
export async function clearAbandonedCheckouts(now = new Date()): Promise<ClearResult> {
  const pending = await prisma.order.findMany({
    where: { status: "pending" },
    select: {
      id: true,
      paymentProvider: true,
      paymentRef: true,
      notes: true,
      createdAt: true,
      recoveryEmailSentAt: true,
      recoveryExpiresAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const stripeStatus = async (sessionId: string): Promise<StripeSessionStatus> =>
    (await getStripe().checkout.sessions.retrieve(sessionId)).status;

  const ids: string[] = [];
  const kept: Record<string, number> = {};
  // Ten Stripe lookups at a time: the first run can meet a long backlog.
  for (let i = 0; i < pending.length; i += 10) {
    const batch = pending.slice(i, i + 10);
    const verdicts = await Promise.all(batch.map((o) => abandonedVerdict(o, now, stripeStatus)));
    verdicts.forEach((v, j) => {
      if (v.clear) ids.push(batch[j]!.id);
      else kept[v.reason] = (kept[v.reason] ?? 0) + 1;
    });
  }
  if (ids.length === 0) return { cleared: 0, kept };

  // Stock movements point at orders without a relation, so the delete below
  // cannot see them. A pending order should never have one; if it does,
  // something unexpected happened to it, and it stays for a person to look at.
  const moved = new Set(
    (
      await prisma.stockMovement.findMany({
        where: { orderId: { in: ids } },
        select: { orderId: true },
      })
    ).map((m) => m.orderId)
  );

  // Status is checked again in the delete itself: an order paid while this
  // ran is no longer pending, and stays. Same for one with anything attached.
  const { count } = await prisma.order.deleteMany({
    where: {
      id: { in: ids.filter((id) => !moved.has(id)) },
      status: "pending",
      emailLogs: { none: {} },
      pickLines: { none: {} },
      shipments: { none: {} },
    },
  });
  if (ids.length > count) kept["paid meanwhile, or has records attached"] = ids.length - count;
  return { cleared: count, kept };
}

/** "Cleared 12 abandoned checkouts. Kept 3: payment page still open (3)." */
export function describeClearResult({ cleared, kept }: ClearResult): string {
  const keptTotal = Object.values(kept).reduce((s, n) => s + n, 0);
  const head =
    cleared === 0
      ? "No abandoned checkouts to clear."
      : `Cleared ${cleared} abandoned checkout${cleared === 1 ? "" : "s"}.`;
  if (keptTotal === 0) return head;
  const reasons = Object.entries(kept)
    .map(([reason, n]) => `${reason} (${n})`)
    .join(", ");
  return `${head} Kept ${keptTotal}: ${reasons}.`;
}
