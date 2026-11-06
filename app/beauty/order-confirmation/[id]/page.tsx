import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearBasket } from "@/components/commerce/cart";
import { OrderStatusWatcher } from "@/components/commerce/OrderStatusWatcher";
import { PurchaseTracker } from "@/components/commerce/PurchaseTracker";
import { brandOrderView, returnedFromPayment } from "@/lib/commerce/order-view";
import { formatGbp } from "@/lib/commerce/view";
import { Photo } from "@/brands/beauty/components/Photo";
import { SealedLine } from "@/brands/beauty/components/Wordmark";
import { ORDER } from "@/brands/beauty/copy/site";
import { BOX_THUMB, IMAGES } from "@/brands/beauty/copy/images";
import { brand } from "../../site";

/**
 * The order, as BeautyBac shows it. The order is loaded on the server and
 * shown only if it is this brand's: any other order id, BacLab's included,
 * is this site's 404 (brandOrderView). Per request, never cached: it shows
 * one customer's order.
 *
 * While the order is pending the page keeps itself current
 * (OrderStatusWatcher); once it is paid the purchase is reported once
 * (PurchaseTracker, consent-gated like every tag) and the basket is emptied.
 * A paid order's thank-you ends on the seal.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: ORDER.metaTitle, robots: { index: false, follow: false } };

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
    <main id="main" className="bb-wrap pt-8 md:pt-14">
      <OrderStatusWatcher orderId={order.id} status={order.status} />
      {order.tracker ? <PurchaseTracker {...order.tracker} /> : null}
      <ClearBasket when={order.paid} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <div role="status">
            <h1 className="bb-display max-w-[14ch] text-[clamp(2.75rem,1.9rem+3vw,4.5rem)]">
              {order.paid && !order.cancelled ? <SealedLine text={`${heading}.`} /> : heading}
            </h1>
            <p className="bb-lead mt-5">{status}</p>
          </div>

          {order.sent && parcel ? (
            <section aria-labelledby="parcel-heading" className="mt-12">
              <h2 id="parcel-heading" className="bb-h3">
                {ORDER.parcel}
              </h2>
              <dl className="mt-4 space-y-2 text-ink-soft">
                {parcel.carrier ? (
                  <div>
                    <dt className="inline">{ORDER.sentBy} </dt>
                    <dd className="inline text-ink">{parcel.carrier}</dd>
                  </div>
                ) : null}
                {parcel.trackingNumber ? (
                  <div>
                    <dt className="inline">{ORDER.tracking} </dt>
                    <dd className="inline text-ink">
                      {parcel.trackingUrl ? (
                        <a href={parcel.trackingUrl} target="_blank" rel="noopener noreferrer" className="bb-link">
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
                    <dd className="inline text-ink">{parcel.latest}</dd>
                  </div>
                ) : null}
                {parcel.deliveredText ? (
                  <div>
                    <dt className="inline">{ORDER.delivered} </dt>
                    <dd className="inline text-ink">{parcel.deliveredText}</dd>
                  </div>
                ) : parcel.sentText ? (
                  <div>
                    <dt className="inline">{ORDER.sentOn} </dt>
                    <dd className="inline text-ink">{parcel.sentText}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : order.paid || order.confirming ? (
            <section aria-labelledby="next-heading" className="mt-12">
              <h2 id="next-heading" className="bb-h3">
                {ORDER.next}
              </h2>
              <ol className="mt-5 space-y-5">
                {[
                  <>
                    {ORDER.stepEmail}
                    {order.customerEmail ? (
                      <>
                        {" "}
                        {ORDER.stepEmailTo} <span className="font-semibold text-ink">{order.customerEmail}</span>
                      </>
                    ) : null}
                    .
                  </>,
                  <>
                    {ORDER.stepPack(
                      order.delivery?.carrier ?? null,
                      order.delivery?.dueText ?? null,
                      order.delivery?.transit ?? null
                    )}
                    {order.shipsOn ? ORDER.stepShips(order.shipsOn.detail, order.shipsOn.text) : ""}
                  </>,
                  <>{ORDER.stepTracking}</>,
                ].map((step, i) => (
                  <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 text-ink-soft">
                    <span className="bb-caption" aria-hidden="true">
                      {["i.", "ii.", "iii."][i]}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <p className="bb-small mt-12">
            {ORDER.help}{" "}
            <Link href="/contact" className="bb-link text-ink">
              {ORDER.helpLink}
            </Link>{" "}
            {ORDER.helpTail}
          </p>
          <p className="mt-5">
            <Link href="/" className="bb-link font-semibold">
              {ORDER.home}
            </Link>
          </p>
        </div>

        <section aria-labelledby="summary-heading" className="bb-panel self-start overflow-hidden">
          <div className="flex items-center gap-4 bg-blush px-6 py-5 sm:px-8">
            <div className="bb-frame aspect-square w-16 shrink-0 rounded-[1rem] bg-surface">
              <Photo image={IMAGES.box} fill sizes="4rem" alt="" className={BOX_THUMB} />
            </div>
            <div className="min-w-0">
              <h2 id="summary-heading" className="bb-h3">
                {ORDER.summary}
              </h2>
              <p className="bb-fine">{ORDER.box}</p>
            </div>
          </div>
          <dl className="px-6 pb-6 pt-4 text-[0.9375rem] sm:px-8 sm:pb-8">
            <div className="flex flex-wrap justify-between gap-2 pb-3 text-ink-soft">
              <div>
                <dt className="inline">{ORDER.orderLabel} </dt>
                <dd className="inline text-ink">{order.id}</dd>
              </div>
              <div>
                <dt className="sr-only">{ORDER.placed}</dt>
                <dd>
                  <time dateTime={order.placedAt}>{order.placedText}</time>
                </dd>
              </div>
            </div>
            {order.lines.map((line, i) => (
              <div key={i} className="flex justify-between gap-4 border-t border-line py-3">
                <dt className="text-ink">
                  {line.name} × {line.qty}
                  {line.detail ? <span className="bb-fine block">{line.detail}</span> : null}
                </dt>
                <dd className="shrink-0 text-ink">{line.totalMinor === null ? ORDER.free : formatGbp(line.totalMinor)}</dd>
              </div>
            ))}
            {deliveryMinor !== null && deliveryMinor >= 0 ? (
              <div className="flex justify-between gap-4 border-t border-line py-3">
                <dt className="text-ink">{ORDER.delivery}</dt>
                <dd className="shrink-0 text-ink">{deliveryMinor === 0 ? ORDER.free : formatGbp(deliveryMinor)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-4 text-ink">
              <dt className="font-semibold">{order.paidMinor !== null ? ORDER.totalPaid : ORDER.total}</dt>
              <dd className="bb-price text-[1.75rem]">{formatGbp(order.paidMinor ?? order.goodsMinor)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
