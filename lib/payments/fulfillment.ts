import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendOrderConfirmationEmail, sendNewOrderAlert, type ShippedTracking } from "@/lib/customer-email";
import type { PaymentProvider } from "@/lib/payments/config";
import { sendMetaPurchase } from "@/lib/meta-capi";
import { getInventoryMode } from "@/lib/inventory/mode";
import { settleWelcomeVial } from "@/lib/mailing-list";
import { autoBuyLabel } from "@/lib/shipping/shipments";
import { orderTracking } from "@/lib/shipping/tracking-sync";
import { allocateAfterPayment, takeStockInTransaction } from "@/lib/payments/stock";
import { activatePlanForPaidOrder } from "@/lib/plans/activate";
import { orderKind, shipsParcel } from "@/lib/plans/kinds";

// Single post-payment code path shared by every provider's webhook.
// Idempotent: only the pending → paid transition does work; retries are no-ops.
export async function fulfillPaidOrder(
  orderId: string,
  opts: {
    paymentRef?: string | null;
    provider: PaymentProvider;
    notes?: string;
    /** Shipping actually charged, in pence — order.totalAmount is goods-only,
     * so this is needed to show a correct total in the confirmation/alert
     * emails. Omit when unknown (e.g. crypto orders never charge delivery
     * through Stripe). */
    deliveryMinor?: number;
    /** The amount actually charged, in pence, when the provider reports it.
     * Omitted, it is the goods total plus deliveryMinor. */
    amountPaidMinor?: number;
  }
): Promise<{ alreadyPaid: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { alreadyPaid: false }; // unknown order — caller acknowledges
  if (order.status !== "pending") return { alreadyPaid: true };

  // Which stock count this sale comes off — see lib/inventory/mode.ts.
  const mode = await getInventoryMode();
  // A plan upgrade is a payment, not a parcel: no welcome vial, no stock, no
  // label (lib/plans/kinds.ts).
  const parcel = shipsParcel(orderKind(order.kind));
  // One moment and one amount, shared by the claim and the plan.
  const paidAt = new Date();
  const amountPaidMinor =
    opts.amountPaidMinor ?? Math.round(Number(order.totalAmount) * 100) + (opts.deliveryMinor ?? 0);

  const claimed = await prisma.$transaction(async (tx) => {
    // Atomic claim: only the delivery that flips pending→paid proceeds. Without
    // this guard two concurrent retries can both decrement stock.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "pending" },
      data: {
        status: "paid",
        paidAt,
        paymentRef: opts.paymentRef ?? order.paymentRef,
        paymentProvider: opts.provider,
        amountPaidMinor,
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      },
    });
    if (count === 0) return false; // another concurrent delivery already claimed it

    if (parcel) {
      // The mailing-list welcome vial: claim the one checkout added, or add it
      // now for a subscriber who signed up on another device. Before any stock
      // is taken, so the vial is decremented, allocated and picked with the
      // rest. See lib/mailing-list.ts.
      const welcome = await settleWelcomeVial(tx, order, { legacyStockCheck: mode === "legacy" });
      if (welcome.items !== order.items || welcome.subscriberId !== order.welcomeSubscriberId) {
        const notes = opts.notes !== undefined ? opts.notes : order.notes;
        await tx.order.update({
          where: { id: orderId },
          data: {
            items: welcome.items,
            welcomeSubscriberId: welcome.subscriberId,
            ...(welcome.note ? { notes: notes ? `${notes}\n${welcome.note}` : welcome.note } : {}),
          },
        });
      }

      // Legacy: decrement the vial counter now that payment is confirmed. In
      // warehouse mode stock is allocated to locations below instead
      // (lib/payments/stock.ts).
      await takeStockInTransaction(tx, mode, welcome.items);
    }

    // Box 1 of a plan, or an upgrade's payment: the plan goes live in this
    // same write, so a paid plan is never left pending.
    await activatePlanForPaidOrder(tx, order, { at: paidAt, amountMinor: amountPaidMinor });
    return true;
  });

  if (!claimed) return { alreadyPaid: true };

  // Allocation runs after the claim, not inside it: a problem here (a SKU
  // deleted since checkout) must not roll back a payment that has been taken.
  // Only the delivery that won the claim gets here, so it runs once; if it
  // fails the order page shows the order unallocated, with a button to retry.
  if (parcel) await allocateAfterPayment(orderId, mode);

  // Order fulfilment hooks go here — accounting export, 3PL handoff; the
  // shipping label is the last one. Every payment provider funnels through this one function, so
  // anything added here runs for cards and crypto alike. Wrap each in its own
  // try/catch: the order is already claimed as paid, so a throw would fail the
  // webhook, and the provider's retry would then find a non-pending order and
  // no-op — losing the work silently.

  const paidOrder = await prisma.order.findUnique({ where: { id: orderId } });
  const emailOpts = { deliveryMinor: opts.deliveryMinor ?? 0 };
  if (paidOrder) {
    void sendNewOrderAlert(paidOrder, emailOpts); // to the shop owner (ORDER_NOTIFY_EMAIL)
    // Server-side Purchase for Meta, only if the customer consented. Never
    // throws; still counted if the customer never reaches the confirmation page.
    void sendMetaPurchase(paidOrder);
  }

  // The carrier label, bought now so the order reaches SmartTrack without
  // anyone pressing a button. After allocation, because the label's sender is
  // the warehouse the stock was picked from. Not awaited: SmartTrack can take
  // seconds and the payment provider is waiting on this webhook. Never
  // throws; a label it cannot buy shows in the admin warning.
  const label = parcel ? autoBuyLabel(orderId) : null;

  // To the customer, once that label is bought, so it carries the tracking number.
  if (paidOrder) void confirmToCustomer(paidOrder, emailOpts, label);
  return { alreadyPaid: false };
}

/**
 * How long the customer's confirmation waits for the label. SmartTrack
 * usually answers in a few seconds; a label not bought by then does not hold
 * the email up any longer, and the shipped email carries the number later.
 */
const LABEL_WAIT_MS = 20_000;

/**
 * The confirmation email, with the parcel's tracking number and a link to
 * the carrier's page when the label is bought in time. No label (switched
 * off, UAT, refused, or slow) sends it without, as before.
 */
async function confirmToCustomer(order: Order, emailOpts: { deliveryMinor: number }, label: Promise<void> | null) {
  let tracking: ShippedTracking | null = null;
  try {
    if (label && (await settlesWithin(label, LABEL_WAIT_MS))) tracking = await orderTracking(order);
  } catch (err) {
    console.error(`[email] tracking for the confirmation of order ${order.id} could not be read`, err);
  }
  await sendOrderConfirmationEmail(order, { ...emailOpts, tracking });
}

/** Whether the promise settles within `ms`. Its timer is cleared either way, so it never holds the process open. */
function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([promise.then(() => true), timeout]).finally(() => clearTimeout(timer));
}
