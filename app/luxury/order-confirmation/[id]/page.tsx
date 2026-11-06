import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearBasket } from "@/components/commerce/cart";
import { OrderStatusWatcher } from "@/components/commerce/OrderStatusWatcher";
import { PurchaseTracker } from "@/components/commerce/PurchaseTracker";
import { brandOrderView, returnedFromPayment } from "@/lib/commerce/order-view";
import { formatGbp } from "@/lib/commerce/view";
import { Seal } from "@/brands/luxury/components/Marks";
import { ORDER } from "@/brands/luxury/copy/order";
import { brand } from "../../site";

/**
 * The order confirmation, set as a card on the page: the order on chalk,
 * with the drawn seal across its top edge (a web graphic: the parcel itself
 * is a plain box). The order is
 * loaded on the server and shown only if it is this brand's: any other order
 * id, BacLab's included, is this site's 404 (brandOrderView). Per request,
 * never cached: it shows one customer's order.
 *
 * While the order is pending the page keeps itself current
 * (OrderStatusWatcher); once it is paid the purchase is reported once
 * (PurchaseTracker, consent-gated like every tag) and the basket is emptied.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: ORDER.title, robots: { index: false, follow: false } };

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
    ? ORDER.heading.cancelled
    : order.paid
      ? ORDER.heading.paid
      : order.confirming
        ? ORDER.heading.confirming
        : ORDER.heading.received;
  const status = order.cancelled
    ? ORDER.status.cancelled
    : order.delivered
      ? ORDER.status.delivered
      : order.sent
        ? ORDER.status.sent
        : order.paid
          ? ORDER.status.paid
          : order.confirming
            ? ORDER.status.confirming
            : ORDER.status.waiting;
  const deliveryMinor = order.paidMinor !== null ? order.paidMinor - order.goodsMinor : null;
  const parcel = order.parcel;

  return (
    <main id="main" className="lv-wrap lv-page">
      <OrderStatusWatcher orderId={order.id} status={order.status} />
      {order.tracker ? <PurchaseTracker {...order.tracker} /> : null}
      <ClearBasket when={order.paid} />

      <div className="lv-order">
        <div role="status" className="lv-order__head">
          <h1 className="lv-page__heading">{heading}</h1>
          <p className="lv-page__lede">{status}</p>
        </div>

        <div className="lv-card">
          <Seal className="lv-card__seal" />
          <dl>
            <div className="lv-card__meta">
              <div>
                <dt className="inline">{ORDER.number} </dt>
                <dd className="inline">{order.id}</dd>
              </div>
              <div>
                <dt className="sr-only">{ORDER.placed}</dt>
                <dd>
                  <time dateTime={order.placedAt}>{order.placedText}</time>
                </dd>
              </div>
            </div>
            {order.lines.map((line, i) => (
              <div key={i} className="lv-card__row">
                <dt>
                  {line.name} × {line.qty}
                  {line.detail ? <span className="lv-card__detail">{line.detail}</span> : null}
                </dt>
                <dd>{line.totalMinor === null ? ORDER.free : formatGbp(line.totalMinor)}</dd>
              </div>
            ))}
            {deliveryMinor !== null && deliveryMinor >= 0 ? (
              <div className="lv-card__row">
                <dt>{ORDER.delivery}</dt>
                <dd>{deliveryMinor === 0 ? ORDER.free : formatGbp(deliveryMinor)}</dd>
              </div>
            ) : null}
            <div className="lv-card__row lv-card__total">
              <dt>{order.paidMinor !== null ? ORDER.totalPaid : ORDER.total}</dt>
              <dd>{formatGbp(order.paidMinor ?? order.goodsMinor)}</dd>
            </div>
          </dl>
        </div>

        {order.sent && parcel ? (
          <section aria-labelledby="parcel-heading" className="mt-16">
            <h2 id="parcel-heading" className="lv-section-heading">
              {ORDER.parcelHeading}
            </h2>
            <dl className="lv-parcel">
              {parcel.carrier ? (
                <div>
                  <dt className="inline">{ORDER.sentBy} </dt>
                  <dd className="inline">{parcel.carrier}</dd>
                </div>
              ) : null}
              {parcel.trackingNumber ? (
                <div>
                  <dt className="inline">{ORDER.trackingNumber} </dt>
                  <dd className="inline">
                    {parcel.trackingUrl ? (
                      <a href={parcel.trackingUrl} target="_blank" rel="noopener noreferrer" className="lv-link">
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
                  <dt className="inline">{ORDER.latest} </dt>
                  <dd className="inline">{parcel.latest}</dd>
                </div>
              ) : null}
              {parcel.deliveredText ? (
                <div>
                  <dt className="inline">{ORDER.delivered} </dt>
                  <dd className="inline">{parcel.deliveredText}</dd>
                </div>
              ) : parcel.sentText ? (
                <div>
                  <dt className="inline">{ORDER.sent} </dt>
                  <dd className="inline">{parcel.sentText}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : order.paid || order.confirming ? (
          <section aria-labelledby="next-heading" className="mt-16">
            <h2 id="next-heading" className="lv-section-heading">
              {ORDER.nextHeading}
            </h2>
            <ol className="lv-steps">
              <li>
                {ORDER.next.email}
                {order.customerEmail ? (
                  <>
                    {" "}
                    {ORDER.next.to} <span className="font-medium">{order.customerEmail}</span>
                  </>
                ) : null}
                .
              </li>
              <li>
                {order.delivery
                  ? `${ORDER.next.packed(order.delivery.carrier)}${
                      order.delivery.dueText ? ORDER.next.due(order.delivery.dueText) : ORDER.next.transit(order.delivery.transit)
                    }`
                  : ORDER.next.packedPlain}
                {order.shipsOn ? ORDER.next.ships(order.shipsOn.detail, order.shipsOn.text) : ""}
              </li>
              <li>{ORDER.next.tracking}</li>
            </ol>
          </section>
        ) : null}

        <p className="mt-16 text-smoke">
          {ORDER.help}{" "}
          <Link href="/contact" className="lv-link">
            {ORDER.helpLink}
          </Link>{" "}
          {ORDER.helpTail}
        </p>
        <p className="mt-4">
          <Link href="/" className="lv-link">
            {ORDER.home}
          </Link>
        </p>
      </div>
    </main>
  );
}
