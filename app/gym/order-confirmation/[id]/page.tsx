import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearBasket } from "@/components/commerce/cart";
import { OrderStatusWatcher } from "@/components/commerce/OrderStatusWatcher";
import { PurchaseTracker } from "@/components/commerce/PurchaseTracker";
import { brandOrderView, returnedFromPayment } from "@/lib/commerce/order-view";
import { formatGbp } from "@/lib/commerce/view";
import { brand } from "../../site";

/**
 * A plain order confirmation until the brand's design lands. The order is
 * loaded on the server and shown only if it is this brand's: any other
 * order id, BacLab's included, is this site's 404 (brandOrderView). Per
 * request, never cached: it shows one customer's order.
 *
 * While the order is pending the page keeps itself current
 * (OrderStatusWatcher); once it is paid the purchase is reported once
 * (PurchaseTracker, consent-gated like every tag) and the basket is emptied.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const order = await brandOrderView(id, brand, { returned: returnedFromPayment(await searchParams) });
  if (!order) notFound();

  const heading = order.cancelled
    ? "This order was cancelled"
    : order.paid
      ? "Thank you, your order is confirmed"
      : order.confirming
        ? "Payment received"
        : "Order received";
  const status = order.cancelled
    ? "It is no longer active."
    : order.delivered
      ? "Your order has been delivered."
      : order.sent
        ? "Your order is on its way."
        : order.paid
          ? "Payment has cleared and your order is being prepared."
          : order.confirming
            ? "We are confirming your payment now. This page updates itself in a few seconds."
            : "We are waiting for your payment to be confirmed. This page shows the latest status whenever you reload it.";
  const deliveryMinor = order.paidMinor !== null ? order.paidMinor - order.goodsMinor : null;
  const parcel = order.parcel;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <OrderStatusWatcher orderId={order.id} status={order.status} />
      {order.tracker ? <PurchaseTracker {...order.tracker} /> : null}
      <ClearBasket when={order.paid} />

      <div role="status">
        <h1 className="font-display text-4xl text-ink">{heading}</h1>
        <p className="mt-3 text-ink-soft">{status}</p>
      </div>

      <dl className="commerce-panel mt-8 p-5 text-sm">
        <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-4 text-ink-soft">
          <div>
            <dt className="inline">Order </dt>
            <dd className="inline text-ink">{order.id}</dd>
          </div>
          <div>
            <dt className="sr-only">Placed</dt>
            <dd>
              <time dateTime={order.placedAt}>{order.placedText}</time>
            </dd>
          </div>
        </div>
        {order.lines.map((line, i) => (
          <div key={i} className="flex justify-between gap-4 py-3">
            <dt className="text-ink">
              {line.name} × {line.qty}
              {line.detail ? <span className="block text-xs text-ink-soft">{line.detail}</span> : null}
            </dt>
            <dd className="shrink-0 text-ink">{line.totalMinor === null ? "Free" : formatGbp(line.totalMinor)}</dd>
          </div>
        ))}
        {deliveryMinor !== null && deliveryMinor >= 0 ? (
          <div className="flex justify-between gap-4 border-t border-line py-3">
            <dt className="text-ink">Delivery</dt>
            <dd className="shrink-0 text-ink">{deliveryMinor === 0 ? "Free" : formatGbp(deliveryMinor)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold text-ink">
          <dt>{order.paidMinor !== null ? "Total paid" : "Total"}</dt>
          <dd>{formatGbp(order.paidMinor ?? order.goodsMinor)}</dd>
        </div>
      </dl>

      {order.sent && parcel ? (
        <section aria-labelledby="parcel-heading" className="mt-10">
          <h2 id="parcel-heading" className="font-display text-2xl text-ink">
            Your parcel
          </h2>
          <dl className="mt-4 space-y-2 text-ink-soft">
            {parcel.carrier ? (
              <div>
                <dt className="inline">Sent by </dt>
                <dd className="inline text-ink">{parcel.carrier}</dd>
              </div>
            ) : null}
            {parcel.trackingNumber ? (
              <div>
                <dt className="inline">Tracking number </dt>
                <dd className="inline text-ink">
                  {parcel.trackingUrl ? (
                    <a href={parcel.trackingUrl} target="_blank" rel="noopener noreferrer" className="link">
                      {parcel.trackingNumber}
                    </a>
                  ) : (
                    parcel.trackingNumber
                  )}
                </dd>
              </div>
            ) : null}
            {parcel.latest ? (
              <div>
                <dt className="inline">Latest update </dt>
                <dd className="inline text-ink">{parcel.latest}</dd>
              </div>
            ) : null}
            {parcel.deliveredText ? (
              <div>
                <dt className="inline">Delivered </dt>
                <dd className="inline text-ink">{parcel.deliveredText}</dd>
              </div>
            ) : parcel.sentText ? (
              <div>
                <dt className="inline">Sent </dt>
                <dd className="inline text-ink">{parcel.sentText}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : order.paid || order.confirming ? (
        <section aria-labelledby="next-heading" className="mt-10">
          <h2 id="next-heading" className="font-display text-2xl text-ink">
            What happens next
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-ink-soft">
            <li>
              A confirmation email is on its way
              {order.customerEmail ? (
                <>
                  {" "}
                  to <span className="font-medium text-ink">{order.customerEmail}</span>
                </>
              ) : null}
              .
            </li>
            <li>
              {order.delivery
                ? `We pack your order and send it by ${order.delivery.carrier} to the address you gave${
                    order.delivery.dueText ? `. It is due ${order.delivery.dueText}` : ` (${order.delivery.transit})`
                  }.`
                : "We pack your order and send it to the address you gave."}
              {order.shipsOn ? ` ${order.shipsOn.detail} It ships on ${order.shipsOn.text}.` : ""}
            </li>
            <li>You get a second email when it ships, with its tracking number.</li>
          </ol>
        </section>
      ) : null}

      <p className="mt-10 text-sm text-ink-soft">
        Something not right?{" "}
        <Link href="/contact" className="link">
          Get in touch
        </Link>{" "}
        quoting your order number.
      </p>
      <p className="mt-6">
        <Link href="/" className="link">
          Back to the home page
        </Link>
      </p>
    </main>
  );
}
