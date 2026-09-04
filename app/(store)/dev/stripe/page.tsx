import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice, type Currency } from "@/config/brand";
import { getPaymentConfig } from "@/lib/payments/config";
import { fulfillPaidOrder } from "@/lib/payments/fulfillment";

export const dynamic = "force-dynamic";

// Only available in the Stripe dev-mock state (enabled, no keys, development).
function simulatorEnabled(): boolean {
  return getPaymentConfig().stripe.mock;
}

async function complete(orderId: string, sessionRef: string, confirmed: boolean) {
  "use server";
  if (!simulatorEnabled()) notFound();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();

  if (confirmed) {
    await fulfillPaidOrder(orderId, { paymentRef: sessionRef, provider: "stripe" });
    redirect(`/order-confirmation/${orderId}`);
  }
  redirect("/checkout?cancelled=1");
}

export default async function StripeSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; order?: string }>;
}) {
  if (!simulatorEnabled()) notFound();
  const { session, order: orderId } = await searchParams;
  if (!session || !orderId) notFound();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();

  const payAction = complete.bind(null, orderId, session, true);
  const failAction = complete.bind(null, orderId, session, false);

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Sandbox · not a real payment page</p>
        <h1 className="mt-3 font-display text-2xl font-medium text-brand-deep">
          Card payment simulator
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Simulates the Stripe Checkout page. Choosing an outcome marks the order
          paid through the same code path the real Stripe webhook uses.
        </p>

        <dl className="mt-6 space-y-2 rounded-xl bg-brand-tint p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Order</dt>
            <dd className="font-mono text-xs">{order.id.slice(0, 13)}…</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Method</dt>
            <dd className="font-semibold">Card</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Amount</dt>
            <dd className="font-semibold">
              {formatPrice(order.totalAmount.toString(), order.currency as Currency)}
            </dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-3">
          <form action={payAction}>
            <button type="submit" className="btn-primary w-full">
              Simulate successful payment
            </button>
          </form>
          <form action={failAction}>
            <button
              type="submit"
              className="w-full rounded-full border border-red-200 px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Simulate failed payment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
