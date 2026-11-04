import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearBasket } from "@/components/commerce/cart";
import { OrderStatusWatcher } from "@/components/commerce/OrderStatusWatcher";
import { PurchaseTracker } from "@/components/commerce/PurchaseTracker";
import { brandOrderView, returnedFromPayment } from "@/lib/commerce/order-view";
import { formatGbp } from "@/lib/commerce/view";
import { CONFIRMATION as C } from "@/brands/gym/copy/site";
import { brand } from "../../site";

/**
 * The order confirmation. The order is loaded on the server and shown only
 * if it is this brand's: any other order id, BacLab's included, is this
 * site's 404 (brandOrderView). Per request, never cached: it shows one
 * customer's order.
 *
 * While the order is pending the page keeps itself current
 * (OrderStatusWatcher); once it is paid the purchase is reported once
 * (PurchaseTracker, consent-gated like every tag) and the basket is emptied.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: C.title, robots: { index: false, follow: false } };

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
    ? C.heading.cancelled
    : order.paid
      ? C.heading.paid
      : order.confirming
        ? C.heading.confirming
        : C.heading.pending;
  const status = order.cancelled
    ? C.status.cancelled
    : order.delivered
      ? C.status.delivered
      : order.sent
        ? C.status.sent
        : order.paid
          ? C.status.paid
          : order.confirming
            ? C.status.confirming
            : C.status.pending;
  const deliveryMinor = order.paidMinor !== null ? order.paidMinor - order.goodsMinor : null;
  const parcel = order.parcel;

  return (
    <main id="main" tabIndex={-1} className="gym-page outline-none">
      <OrderStatusWatcher orderId={order.id} status={order.status} />
      {order.tracker ? <PurchaseTracker {...order.tracker} /> : null}
      <ClearBasket when={order.paid} />

      <div className="gym-wrap">
        <div className="gym-narrow">
          <div role="status">
            <h1 className="gym-page-title">{heading}</h1>
            <p className="gym-page-lead">{status}</p>
          </div>

          <dl className="gym-receipt">
            <div className="gym-receipt-head">
              <div>
                <dt className="inline">{C.order} </dt>
                <dd className="inline font-semibold text-ink">{order.id}</dd>
              </div>
              <div>
                <dt className="sr-only">{C.placed}</dt>
                <dd>
                  <time dateTime={order.placedAt}>{order.placedText}</time>
                </dd>
              </div>
            </div>
            {order.lines.map((line, i) => (
              <div key={i} className="gym-receipt-row">
                <dt>
                  <span className="font-semibold">
                    {line.name} × {line.qty}
                  </span>
                  {line.detail ? <span className="block text-sm text-ink-soft">{line.detail}</span> : null}
                </dt>
                <dd className="gym-figure shrink-0 text-xl">{line.totalMinor === null ? C.free : formatGbp(line.totalMinor)}</dd>
              </div>
            ))}
            {deliveryMinor !== null && deliveryMinor >= 0 ? (
              <div className="gym-receipt-row">
                <dt>{C.delivery}</dt>
                <dd className="gym-figure shrink-0 text-xl">{deliveryMinor === 0 ? C.free : formatGbp(deliveryMinor)}</dd>
              </div>
            ) : null}
            <div className="gym-receipt-total">
              <dt>{order.paidMinor !== null ? C.totalPaid : C.total}</dt>
              <dd className="gym-figure">{formatGbp(order.paidMinor ?? order.goodsMinor)}</dd>
            </div>
          </dl>

          {order.sent && parcel ? (
            <section aria-labelledby="parcel-heading" className="mt-12">
              <h2 id="parcel-heading" className="gym-h3">
                {C.parcel}
              </h2>
              <dl className="mt-4 space-y-2 text-ink-soft">
                {parcel.carrier ? (
                  <div>
                    <dt className="inline">{C.sentBy} </dt>
                    <dd className="inline text-ink">{parcel.carrier}</dd>
                  </div>
                ) : null}
                {parcel.trackingNumber ? (
                  <div>
                    <dt className="inline">{C.tracking} </dt>
                    <dd className="inline text-ink">
                      {parcel.trackingUrl ? (
                        <a href={parcel.trackingUrl} target="_blank" rel="noopener noreferrer" className="gym-link">
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
                    <dt className="inline">{C.latest} </dt>
                    <dd className="inline text-ink">{parcel.latest}</dd>
                  </div>
                ) : null}
                {parcel.deliveredText ? (
                  <div>
                    <dt className="inline">{C.delivered} </dt>
                    <dd className="inline text-ink">{parcel.deliveredText}</dd>
                  </div>
                ) : parcel.sentText ? (
                  <div>
                    <dt className="inline">{C.sent} </dt>
                    <dd className="inline text-ink">{parcel.sentText}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : order.paid || order.confirming ? (
            <section aria-labelledby="next-heading" className="mt-12">
              <h2 id="next-heading" className="gym-h3">
                {C.next}
              </h2>
              <ol className="gym-steps">
                <li>
                  <span>
                    {C.steps.email}
                    {order.customerEmail ? (
                      <>
                        {" "}
                        {C.steps.to} <span className="font-semibold text-ink">{order.customerEmail}</span>
                      </>
                    ) : null}
                    .
                  </span>
                </li>
                <li>
                  <span>
                    {order.delivery
                      ? C.steps.packWith(order.delivery.carrier, order.delivery.dueText || null, order.delivery.transit)
                      : C.steps.pack}
                    {order.shipsOn ? C.steps.ships(order.shipsOn.detail, order.shipsOn.text) : ""}
                  </span>
                </li>
                <li>
                  <span>{C.steps.shipped}</span>
                </li>
              </ol>
            </section>
          ) : null}

          <p className="mt-12 text-ink-soft">
            {C.problem}{" "}
            <Link href="/contact" className="gym-link">
              {C.getInTouch}
            </Link>{" "}
            {C.quoting}
          </p>
          <p className="mt-6">
            <Link href="/" className="gym-btn gym-btn-ghost">
              {C.back}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
