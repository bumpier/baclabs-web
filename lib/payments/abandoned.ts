import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/payments/stripe";
import { GATEWAY_PROVIDER, parsePendingNote } from "@/lib/crypto-gateway";
import { getPayPalOrder, paypalCredentials } from "@/lib/commerce/payments/paypal";

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
 *   never landed — that is logged and the order kept. The other brands'
 *   card orders are sessions on the same account (lib/commerce/payments/
 *   stripe.ts), so they are asked about in exactly the same way.
 * - Crypto: the gateway sets a payment window, kept in the order's notes. The
 *   order clears a day after it closes, so a deposit sent in time can still
 *   confirm.
 * - PayPal (a brand moved to PayPal; never Stripe): money moves only when
 *   we capture, so PayPal is asked about its order with the brand's own
 *   credentials. One it no longer has clears; one it has completed is paid
 *   with our side unconfirmed, logged and kept. Otherwise it is kept until
 *   PayPal's longest window has passed (an order can be captured for at
 *   most 72 hours, per its docs), then cleared: by then nothing can take
 *   payment for it. Without the brand's credentials nothing can capture it
 *   either, so the same 72 hours apply.
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

/** A brand's PayPal order as the clear-up reads it (paypalOrderState). */
export type PayPalOrderState = "completed" | "approved" | "open" | "gone" | "unconfigured";

export type Verdict = { clear: true } | { clear: false; reason: string };

const CLEAR: Verdict = { clear: true };
const keep = (reason: string): Verdict => ({ clear: false, reason });

export interface PendingOrder {
  id: string;
  /** Order.brand: whose PayPal account a PayPal order is asked of. */
  brand?: string;
  paymentProvider: string | null;
  paymentRef: string | null;
  notes: string | null;
  createdAt: Date;
  /** Set when a recovery email went out, with when its link stops working. */
  recoveryEmailSentAt?: Date | null;
  recoveryExpiresAt?: Date | null;
}

/**
 * Whether one pending order can be cleared. `stripeStatus` looks up a
 * Checkout Session; `paypalStatus` a brand's PayPal order, and is only ever
 * asked about one (paymentProvider "paypal").
 */
export async function abandonedVerdict(
  order: PendingOrder,
  now: Date,
  stripeStatus: (sessionId: string) => Promise<StripeSessionStatus>,
  paypalStatus: (order: PendingOrder & { paymentRef: string }) => Promise<PayPalOrderState> = async () => "unconfigured"
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

  if (order.paymentProvider === "paypal") {
    let state: PayPalOrderState;
    try {
      state = await paypalStatus({ ...order, paymentRef: order.paymentRef });
    } catch (err) {
      console.error(`[internal] could not check PayPal for pending order ${order.id}`, err);
      return keep("could not check with PayPal");
    }
    if (state === "gone") return CLEAR;
    if (state === "completed") {
      console.error(`[internal] order ${order.id} is paid at PayPal but still pending here — check the PayPal webhook`);
      return keep("paid at PayPal but not confirmed here");
    }
    return age > FALLBACK_AGE_MS ? CLEAR : keep("PayPal order still open");
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
      brand: true,
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
  // Asked of the order's own brand's PayPal account, and only for a PayPal
  // order: Stripe is never asked about one, nor PayPal about Stripe's.
  const paypalStatus = async (o: PendingOrder & { paymentRef: string }): Promise<PayPalOrderState> => {
    const creds = paypalCredentials(o.brand ?? "");
    if (!creds) return "unconfigured";
    const pp = await getPayPalOrder(creds, o.paymentRef);
    if (!pp || pp.status === "VOIDED") return "gone";
    if (pp.status === "COMPLETED") return "completed";
    return pp.status === "APPROVED" ? "approved" : "open";
  };

  const ids: string[] = [];
  const kept: Record<string, number> = {};
  // Ten Stripe lookups at a time: the first run can meet a long backlog.
  for (let i = 0; i < pending.length; i += 10) {
    const batch = pending.slice(i, i + 10);
    const verdicts = await Promise.all(batch.map((o) => abandonedVerdict(o, now, stripeStatus, paypalStatus)));
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
