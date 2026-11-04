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
 * The order confirmation, laid out as a docket: the status on black, then
 * the order on a white slip (its number, the date, every line, delivery and
 * the total), and what happens next, or the parcel once it has gone.
 *
 * The order is loaded on the server and shown only if it is this brand's:
 * any other order id, BacLab's included, is this site's 404
 * (brandOrderView). Per request, never cached: it shows one customer's
 * order. While the order is pending the page keeps itself current
 * (OrderStatusWatcher); once it is paid the purchase is reported once
 * (PurchaseTracker, consent-gated like every tag) and the cart is emptied.
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

      <div className="gym-page-band">
        <div className="gym-wrap gym-page-band-inner" role="status">
          <h1 className="gym-page-title">{heading}</h1>
          <p className="gym-page-lead">{status}</p>
        </div>
        <div className="gym-tape" aria-hidden="true" />
      </div>

      <div className="gym-wrap gym-page-body">
        <section aria-labelledby="docket-heading" className="gym-docket">
          <h2 id="docket-heading" className="sr-only">
            {C.items}
          </h2>
          <dl>
            <div className="gym-docket-head">
              <div>
                <dt className="inline">{C.order} </dt>
                <dd className="gym-docket-id inline">{order.id}</dd>
              </div>
              <div>
                <dt className="sr-only">{C.placed}</dt>
                <dd>
                  <time dateTime={order.placedAt}>{order.placedText}</time>
                </dd>
              </div>
            </div>
            {order.lines.map((line, i) => (
              <div key={i} className="gym-docket-row">
                <dt>
                  <span className="font-bold">
                    {line.name} × {line.qty}
                  </span>
                  {line.detail ? <span className="gym-docket-detail">{line.detail}</span> : null}
                </dt>
                <dd className="gym-docket-figure">{line.totalMinor === null ? C.free : formatGbp(line.totalMinor)}</dd>
              </div>
            ))}
            {deliveryMinor !== null && deliveryMinor >= 0 ? (
              <div className="gym-docket-row">
                <dt>
                  {C.delivery}
                  {order.delivery ? <span className="gym-docket-detail">{order.delivery.label}</span> : null}
                </dt>
                <dd className="gym-docket-figure">{deliveryMinor === 0 ? C.free : formatGbp(deliveryMinor)}</dd>
              </div>
            ) : null}
            <div className="gym-docket-total">
              <dt>{order.paidMinor !== null ? C.totalPaid : C.total}</dt>
              <dd>{formatGbp(order.paidMinor ?? order.goodsMinor)}</dd>
            </div>
          </dl>
          <div className="gym-tape gym-tape-thin" aria-hidden="true" />
        </section>

        <div className="mt-12 max-w-[46rem]">
          {order.sent && parcel ? (
            <section aria-labelledby="parcel-heading">
              <h2 id="parcel-heading" className="gym-h3">
                {C.parcel}
              </h2>
              <dl className="gym-facts">
                {parcel.carrier ? (
                  <div>
                    <dt className="inline">{C.sentBy} </dt>
                    <dd className="inline">{parcel.carrier}</dd>
                  </div>
                ) : null}
                {parcel.trackingNumber ? (
                  <div>
                    <dt className="inline">{C.tracking} </dt>
                    <dd className="inline">
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
                    <dd className="inline">{parcel.latest}</dd>
                  </div>
                ) : null}
                {parcel.deliveredText ? (
                  <div>
                    <dt className="inline">{C.delivered} </dt>
                    <dd className="inline">{parcel.deliveredText}</dd>
                  </div>
                ) : parcel.sentText ? (
                  <div>
                    <dt className="inline">{C.sent} </dt>
                    <dd className="inline">{parcel.sentText}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : order.paid || order.confirming ? (
            <section aria-labelledby="next-heading">
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
                        {C.steps.to} <span className="font-bold text-black">{order.customerEmail}</span>
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

          <p className="mt-12 text-[var(--color-ink-soft)]">
            {C.problem}{" "}
            <Link href="/contact" className="gym-link text-black">
              {C.getInTouch}
            </Link>{" "}
            {C.quoting}
          </p>
          <p className="mt-6">
            <Link href="/" className="gym-btn gym-btn-ink">
              {C.back}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
