import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearBasket } from "@/components/commerce/cart";
import { OrderStatusWatcher } from "@/components/commerce/OrderStatusWatcher";
import { PurchaseTracker } from "@/components/commerce/PurchaseTracker";
import { brandOrderView, returnedFromPayment } from "@/lib/commerce/order-view";
import { formatGbp } from "@/lib/commerce/view";
import { ACK } from "@/brands/wholesale/copy/pages";
import { brand } from "../../site";

/**
 * The order acknowledgement, set like the paper one: a sheet with the
 * order number, date and status in ruled fields, the lines as a table and
 * the total under a heavy rule. The order is loaded on the server and shown
 * only if it is this brand's: any other order id, BacLab's included, is
 * this site's 404 (brandOrderView). Per request, never cached: it shows one
 * customer's order.
 *
 * While the order is pending the page keeps itself current
 * (OrderStatusWatcher); once it is paid the purchase is reported once
 * (PurchaseTracker, consent-gated like every tag) and the basket is emptied.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: ACK.title, robots: { index: false, follow: false } };

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
      ? // Not "confirmed": under the terms this page is an acknowledgement,
        // and the contract forms when the order is dispatched.
        "Thank you, we have your order"
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
  const state = order.cancelled
    ? "Cancelled"
    : order.delivered
      ? "Delivered"
      : order.sent
        ? "Sent"
        : order.paid
          ? "Paid"
          : order.confirming
            ? "Confirming payment"
            : "Awaiting payment";
  const deliveryMinor = order.paidMinor !== null ? order.paidMinor - order.goodsMinor : null;
  const parcel = order.parcel;

  return (
    <main id="main" className="wh-wrap py-6 md:py-12">
      <OrderStatusWatcher orderId={order.id} status={order.status} />
      {order.tracker ? <PurchaseTracker {...order.tracker} /> : null}
      <ClearBasket when={order.paid} />

      <div className="mx-auto max-w-3xl">
        <div role="status" className="wh-page-head pt-2">
          <h1 className="wh-page-title">{heading}</h1>
          <p className="wh-page-lede">{status}</p>
        </div>

        <section aria-labelledby="ack-heading" className="wh-label">
          <h2 id="ack-heading" className="wh-label-head">
            {ACK.sheet}
          </h2>
          <dl className="wh-ack-fields">
            <div>
              <dt>{ACK.order}</dt>
              <dd>{order.id}</dd>
            </div>
            <div>
              <dt>{ACK.placed}</dt>
              <dd>
                <time dateTime={order.placedAt}>{order.placedText}</time>
              </dd>
            </div>
            <div>
              <dt>{ACK.status}</dt>
              <dd>{state}</dd>
            </div>
          </dl>

          <table className="wh-table">
            <thead>
              <tr>
                <th scope="col">{ACK.item}</th>
                <th scope="col" className="wh-num">
                  {ACK.qty}
                </th>
                <th scope="col" className="wh-num">
                  {ACK.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line, i) => (
                <tr key={i}>
                  <th scope="row" className="text-left font-medium">
                    {line.name}
                    {line.detail ? <span className="block text-xs font-normal text-ink-soft">{line.detail}</span> : null}
                  </th>
                  <td className="wh-num">{line.qty}</td>
                  <td className="wh-num font-semibold">{line.totalMinor === null ? ACK.free : formatGbp(line.totalMinor)}</td>
                </tr>
              ))}
              {deliveryMinor !== null && deliveryMinor >= 0 ? (
                <tr>
                  <th scope="row" className="text-left font-medium">
                    {ACK.delivery}
                  </th>
                  <td className="wh-num" />
                  <td className="wh-num font-semibold">{deliveryMinor === 0 ? ACK.free : formatGbp(deliveryMinor)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <dl className="wh-totals wh-totals-grand mx-3 mb-4 mt-1 md:mx-5">
            <div>
              <dt>{order.paidMinor !== null ? ACK.totalPaid : ACK.total}</dt>
              <dd>{formatGbp(order.paidMinor ?? order.goodsMinor)}</dd>
            </div>
          </dl>
        </section>

        {order.sent && parcel ? (
          <section aria-labelledby="parcel-heading" className="wh-sheet mt-6">
            <h2 id="parcel-heading" className="wh-sheet-head">
              {ACK.parcel}
            </h2>
            <table className="wh-table wh-facts">
              <tbody>
                {parcel.carrier ? (
                  <tr>
                    <th scope="row">Sent by</th>
                    <td>{parcel.carrier}</td>
                  </tr>
                ) : null}
                {parcel.trackingNumber ? (
                  <tr>
                    <th scope="row">Tracking number</th>
                    <td>
                      {parcel.trackingUrl ? (
                        <a href={parcel.trackingUrl} target="_blank" rel="noopener noreferrer" className="link">
                          {parcel.trackingNumber}
                        </a>
                      ) : (
                        parcel.trackingNumber
                      )}
                    </td>
                  </tr>
                ) : null}
                {parcel.latest ? (
                  <tr>
                    <th scope="row">Latest update</th>
                    <td>{parcel.latest}</td>
                  </tr>
                ) : null}
                {parcel.deliveredText ? (
                  <tr>
                    <th scope="row">Delivered</th>
                    <td>{parcel.deliveredText}</td>
                  </tr>
                ) : parcel.sentText ? (
                  <tr>
                    <th scope="row">Sent</th>
                    <td>{parcel.sentText}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        ) : order.paid || order.confirming ? (
          <section aria-labelledby="next-heading" className="wh-sheet mt-6">
            <h2 id="next-heading" className="wh-sheet-head">
              {ACK.next}
            </h2>
            <ol className="wh-steps px-4 md:px-5">
              <li>
                <span>
                  A confirmation email is on its way
                  {order.customerEmail ? (
                    <>
                      {" "}
                      to <span className="font-semibold">{order.customerEmail}</span>
                    </>
                  ) : null}
                  .
                </span>
              </li>
              <li>
                <span>
                  {order.delivery
                    ? `We pack your order and send it by ${order.delivery.carrier} to the address you gave${
                        order.delivery.dueText ? `. It is due ${order.delivery.dueText}` : ` (${order.delivery.transit})`
                      }.`
                    : "We pack your order and send it to the address you gave."}
                  {order.shipsOn ? ` ${order.shipsOn.detail} It ships on ${order.shipsOn.text}.` : ""}
                </span>
              </li>
              <li>
                <span>You get a second email when it ships, with its tracking number.</span>
              </li>
            </ol>
          </section>
        ) : null}

        <p className="mt-8 text-sm text-ink-soft">
          {ACK.help}{" "}
          <Link href="/contact" className="link font-semibold text-navy">
            {ACK.helpLink}
          </Link>{" "}
          {ACK.helpTail}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/" className="link">
            {ACK.home}
          </Link>
        </p>
      </div>
    </main>
  );
}
