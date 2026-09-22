import { prisma } from "@/lib/db";
import { sendOrderConfirmationEmail, sendNewOrderAlert } from "@/lib/customer-email";
import type { PaymentProvider } from "@/lib/payments/config";
import { sendMetaPurchase } from "@/lib/meta-capi";
import { getInventoryMode } from "@/lib/inventory/mode";
import { allocateOrder } from "@/lib/inventory/store";

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

  const claimed = await prisma.$transaction(async (tx) => {
    // Atomic claim: only the delivery that flips pending→paid proceeds. Without
    // this guard two concurrent retries can both decrement stock.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "pending" },
      data: {
        status: "paid",
        paidAt: new Date(),
        paymentRef: opts.paymentRef ?? order.paymentRef,
        paymentProvider: opts.provider,
        amountPaidMinor:
          opts.amountPaidMinor ??
          Math.round(Number(order.totalAmount) * 100) + (opts.deliveryMinor ?? 0),
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      },
    });
    if (count === 0) return false; // another concurrent delivery already claimed it
    // Legacy: decrement the vial counter now that payment is confirmed. In
    // warehouse mode stock is allocated to locations below instead.
    if (mode === "legacy") {
      const items = JSON.parse(order.items) as { productId: string; qty: number }[];
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        });
      }
    }
    return true;
  });

  if (!claimed) return { alreadyPaid: true };

  // Allocation runs after the claim, not inside it: a problem here (a SKU
  // deleted since checkout) must not roll back a payment that has been taken.
  // Only the delivery that won the claim gets here, so it runs once; if it
  // fails the order page shows the order unallocated, with a button to retry.
  if (mode === "warehouse") {
    try {
      const { shortfall } = await allocateOrder(orderId, "system");
      if (shortfall > 0) {
        console.error(`[internal] order ${orderId} paid with ${shortfall} unit(s) short on the shelves`);
      }
    } catch (err) {
      console.error(`[internal] stock allocation failed for order ${orderId}`, err);
    }
  }

  // Order fulfilment hooks go here — shipping label, accounting export,
  // 3PL handoff. Every payment provider funnels through this one function, so
  // anything added here runs for cards and crypto alike. Wrap each in its own
  // try/catch: the order is already claimed as paid, so a throw would fail the
  // webhook, and the provider's retry would then find a non-pending order and
  // no-op — losing the work silently.

  const paidOrder = await prisma.order.findUnique({ where: { id: orderId } });
  if (paidOrder) {
    const emailOpts = { deliveryMinor: opts.deliveryMinor ?? 0 };
    void sendOrderConfirmationEmail(paidOrder, emailOpts); // to the customer
    void sendNewOrderAlert(paidOrder, emailOpts); // to the shop owner (ORDER_NOTIFY_EMAIL)
    // Server-side Purchase for Meta, only if the customer consented. Never
    // throws; still counted if the customer never reaches the confirmation page.
    void sendMetaPurchase(paidOrder);
  }
  return { alreadyPaid: false };
}
