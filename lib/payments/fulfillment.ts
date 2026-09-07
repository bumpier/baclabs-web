import { prisma } from "@/lib/db";
import { sendOrderConfirmationEmail, sendNewOrderAlert } from "@/lib/customer-email";
import type { PaymentProvider } from "@/lib/payments/config";

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
  }
): Promise<{ alreadyPaid: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { alreadyPaid: false }; // unknown order — caller acknowledges
  if (order.status !== "pending") return { alreadyPaid: true };

  const claimed = await prisma.$transaction(async (tx) => {
    // Atomic claim: only the delivery that flips pending→paid proceeds. Without
    // this guard two concurrent retries can both decrement stock.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "pending" },
      data: {
        status: "paid",
        paymentRef: opts.paymentRef ?? order.paymentRef,
        paymentProvider: opts.provider,
        ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      },
    });
    if (count === 0) return false; // another concurrent delivery already claimed it
    // Decrement stock now that payment is confirmed.
    const items = JSON.parse(order.items) as { productId: string; qty: number }[];
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.qty } },
      });
    }
    return true;
  });

  if (!claimed) return { alreadyPaid: true };

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
  }
  return { alreadyPaid: false };
}
