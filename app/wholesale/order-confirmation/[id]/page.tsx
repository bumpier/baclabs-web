import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearBasket } from "@/components/commerce/cart";
import { OrderStatusWatcher } from "@/components/commerce/OrderStatusWatcher";
import { PurchaseTracker } from "@/components/commerce/PurchaseTracker";
import { brandOrderView, returnedFromPayment } from "@/lib/commerce/order-view";
import { formatGbp } from "@/lib/commerce/view";
import { ACK } from "@/brands/wholesale/copy/pages";
import { Lockup } from "@/brands/wholesale/components/logo";
import { Bars } from "@/brands/wholesale/components/bars";
import { brand } from "../../site";

/**
 * The order acknowledgement, set as the brand's shipping label: the spruce
 * band with the lockup and the yellow block, the order number large in the
 * label's mono, the date, status and delivery in ruled fields, the lines,
 * and the total beside the label's bars (decoration, drawn from the order
 * number). The order is loaded on the server and shown only if it is this
 * brand's: any other order id, BacLab's included, is this site's 404
 * (brandOrderView). Per request, never cached: it shows one customer's
 * order.
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
    <main id="main" className="vh-page vh-wrap pt-6 md:pt-12">
      <OrderStatusWatcher orderId={order.id} status={order.status} />
      {order.tracker ? <PurchaseTracker {...order.tracker} /> : null}
      <ClearBasket when={order.paid} />

      <div className="mx-auto max-w-3xl">
        <div role="status" className="mb-7">
          <h1 className="vh-page-title">{heading}</h1>
          <p className="vh-page-lede">{status}</p>
        </div>

        <section aria-labelledby="ack-heading" className="vh-label">
          <div className="vh-label-band">
            <Lockup className="vh-lockup-footer" />
            <h2 id="ack-heading" className="vh-label-band-title">
              {ACK.sheet}
            </h2>
            <span className="vh-label-block" aria-hidden="true" />
          </div>
          <dl className="vh-label-id">
            <dt>{ACK.order}</dt>
            <dd>{order.id}</dd>
          </dl>
          <dl className="vh-label-fields">
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
            {order.delivery ? (
              <div>
                <dt>{ACK.delivery}</dt>
                <dd>{order.delivery.carrier}</dd>
              </div>
            ) : null}
          </dl>

          <table className="vh-table">
            <thead>
              <tr>
                <th scope="col">{ACK.item}</th>
                <th scope="col" className="vh-num">
                  {ACK.qty}
                </th>
                <th scope="col" className="vh-num">
                  {ACK.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line, i) => (
                <tr key={i}>
                  <th scope="row">
                    {line.name}
                    {line.detail ? <span className="block text-xs font-normal text-ink-soft">{line.detail}</span> : null}
                  </th>
                  <td className="vh-num">{line.qty}</td>
                  <td className="vh-num font-bold">{line.totalMinor === null ? ACK.free : formatGbp(line.totalMinor)}</td>
                </tr>
              ))}
              {deliveryMinor !== null && deliveryMinor >= 0 ? (
                <tr>
                  <th scope="row">{ACK.delivery}</th>
                  <td className="vh-num" />
                  <td className="vh-num font-bold">{deliveryMinor === 0 ? ACK.free : formatGbp(deliveryMinor)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="vh-label-foot">
            <Bars seed={order.id} className="vh-bars" />
            <dl className="vh-label-total">
              <dt>{order.paidMinor !== null ? ACK.totalPaid : ACK.total}</dt>
              <dd>{formatGbp(order.paidMinor ?? order.goodsMinor)}</dd>
            </dl>
          </div>
        </section>

        {order.sent && parcel ? (
          <section aria-labelledby="parcel-heading" className="vh-panel mt-6">
            <h2 id="parcel-heading" className="vh-panel-head">
              {ACK.parcel}
            </h2>
            <div className="vh-panel-body">
              <table className="vh-table vh-spec">
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
            </div>
          </section>
        ) : order.paid || order.confirming ? (
          <section aria-labelledby="next-heading" className="vh-panel mt-6">
            <h2 id="next-heading" className="vh-panel-head">
              {ACK.next}
            </h2>
            <div className="vh-panel-body">
              <ol className="vh-steps mt-0">
                <li>
                  A confirmation email is on its way
                  {order.customerEmail ? (
                    <>
                      {" "}
                      to <span className="font-semibold">{order.customerEmail}</span>
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
            </div>
          </section>
        ) : null}

        <p className="mt-8 text-sm text-ink-soft">
          {ACK.help}{" "}
          <Link href="/contact" className="link font-semibold text-spruce">
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
