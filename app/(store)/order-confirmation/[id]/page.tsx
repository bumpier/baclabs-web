import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { brand } from "@/config/brand";
import { deliveryOptionById, formatMinor } from "@/config/funnel";
import { formatDeliveryDay, nextDayDeadline } from "@/lib/delivery-date";
import { paidMinor, purchaseContents, purchaseEventId } from "@/lib/meta-capi-event";
import { parseTrackingNumbers } from "@/lib/shipping/shipments";
import { formatSaleDateTime, formatShopDay, shopDayKey } from "@/lib/saleTime";
import { planDeliveryNote, planFreeLine } from "@/config/plans";
import { orderKind } from "@/lib/plans/kinds";
import { upgradeEligibility, upgradeOffers } from "@/lib/plans/upgrade";
import { PlanSchedule } from "@/components/plans/PlanSchedule";
import { PlanUpgradeOffer, type UpgradeOfferCard } from "@/components/plans/PlanUpgradeOffer";
import { PurchaseTracker } from "./PurchaseTracker";

export const dynamic = "force-dynamic";

/** Pence from a decimal string, so every figure here is integer arithmetic. */
function toMinor(value: string): number {
  return Math.round(Number(value) * 100);
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string; paid?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // Order IDs are UUIDs — unguessable, so showing the summary here is safe.
  if (!z.string().uuid().safeParse(id).success) notFound();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  // What this row is (lib/plans/kinds.ts): a sale, a prepaid plan box, or the
  // payment that turned a one-off order into box 1 of a plan.
  const kind = orderKind(order.kind);
  // The plan this order belongs to, with every box made so far.
  const plan = order.planId
    ? await prisma.plan.findUnique({
        where: { id: order.planId },
        include: {
          orders: {
            where: { planBox: { not: null } },
            select: { id: true, planBox: true, status: true, paidAt: true },
            orderBy: { planBox: "asc" },
          },
        },
      })
    : null;

  const items = JSON.parse(order.items) as {
    name: string;
    qty: number;
    unitPrice: string;
    /** Exact line total. Falls back to unitPrice × qty for orders placed before this field existed. */
    lineTotal?: string;
    bundleName?: string;
    bundleQty?: number;
    /** The mailing-list welcome vial. */
    welcome?: boolean;
    /** A plan's free bonus pack (lib/plans/items.ts). */
    planBonus?: boolean;
    /** "box": a later plan box, already paid for by its plan. */
    planLine?: "plan" | "box" | "bonus";
  }[];

  const paid = order.status !== "pending" && order.status !== "cancelled";
  // A one-off pack paid in the last few days can become box 1 of a plan.
  const verdict = paid && kind === "sale" && !plan ? upgradeEligibility(order, new Date()) : null;
  const upgrade = verdict?.eligible
    ? {
        deadlineText: formatShopDay(shopDayKey(verdict.deadline)),
        offers: upgradeOffers(verdict.packId).flatMap((o): UpgradeOfferCard[] =>
          o.months === 6 || o.months === 12
            ? [
                {
                  months: o.months,
                  priceMinor: o.priceMinor,
                  freeLine: planFreeLine(o.plan),
                  saveMinor: o.plan.saveMinor,
                  label: o.plan.label,
                  deliveryNote: planDeliveryNote(o.plan),
                  bonusInBox2: o.plan.bonusVials > 0,
                },
              ]
            : []
        ),
      }
    : null;
  // Stripe returns the browser here the moment the card clears, which usually
  // beats the webhook. Without this the card customer reads the crypto
  // "we're waiting for your payment" copy at the one moment that must feel
  // finished. Presentation only — the marker is user-typeable, so it drives
  // no data change; the order's real status still comes from the webhook.
  const confirming =
    !paid &&
    order.status === "pending" &&
    order.paymentProvider === "stripe" &&
    (Boolean(sp.session_id) || sp.paid === "stripe");

  const hasEmail = Boolean(brand.contact.email);
  // The delivery the customer chose, once it is recorded: the webhook writes
  // it for cards, so a card customer who beats the webhook reads the general
  // line. Next day's due date counts from when payment cleared.
  const paidFor = deliveryOptionById(order.deliveryOption);
  const nextDayDue =
    paidFor?.id === "next_day" && order.paidAt
      ? formatDeliveryDay(nextDayDeadline(order.paidAt).deliveryDayKey)
      : null;
  // Meta's content ids and item count, built by the same helper as the
  // server-side Purchase so the two reports agree.
  const contents = purchaseContents(order.items);

  // Once it has gone out, the parcel and its latest tracking
  // (lib/shipping/tracking-sync.ts) — what the shipped email points here for.
  const sent = order.status === "shipped" || order.status === "delivered";
  const parcel = sent
    ? await prisma.shipment.findFirst({
        where: { orderId: order.id, status: "CREATED" },
        orderBy: { createdAt: "desc" },
        select: { trackingNumbers: true, carrierName: true, trackingEvent: true, trackingEventAt: true },
      })
    : null;
  const trackingNumber = parcel ? parseTrackingNumbers(parcel.trackingNumbers)[0] : undefined;
  const carrier = parcel?.carrierName || paidFor?.carrier || "";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      {/* Pick up the webhook's result without the customer having to reload. */}
      {confirming ? <meta httpEquiv="refresh" content="5" /> : null}

      {/* Fires `purchase` once, and only for an order that is actually paid.
          A prepaid plan box is not a purchase: it must never report £0. */}
      {paid && kind !== "plan_box" ? (
        <PurchaseTracker
          orderId={order.id}
          eventId={purchaseEventId(order.id)}
          valueMinor={paidMinor(order)}
          contentIds={contents.map((c) => c.id)}
          numItems={contents.reduce((sum, c) => sum + c.quantity, 0)}
          items={items.map((i) => ({
            item_id: i.bundleName ?? "baclab-10ml",
            item_name: i.name,
            // One "item" per line at its exact total, so per-item revenue
            // always sums to the order total regardless of how the bundle's
            // price splits across vials or packs.
            price: Number(i.lineTotal ?? (Number(i.unitPrice) * i.qty).toFixed(2)),
            quantity: 1,
          }))}
        />
      ) : null}

      <h1 className="text-3xl">
        {kind === "plan_box" && plan ? (
          <>
            Box <span className="tabular">{order.planBox}</span> of <span className="tabular">{plan.months}</span> of
            your monthly plan
          </>
        ) : kind === "plan_upgrade" && paid ? (
          plan?.status === "cancelled" ? (
            "Your monthly plan was cancelled"
          ) : (
            "Thank you, your monthly plan has started"
          )
        ) : paid
          ? "Thank you — your order is confirmed"
          : confirming
            ? "Payment received"
            : "Order received"}
      </h1>
      <p className="measure mt-3 text-base text-ink-soft">
        {order.status === "delivered"
          ? "Your order has been delivered."
          : order.status === "shipped"
            ? "Your order is on its way."
            : kind === "plan_box" && paid
              ? "Your box is being prepared."
              : kind === "plan_upgrade" && paid
                ? plan?.status === "cancelled"
                  ? "Payment has cleared. The plan's details are below."
                  : "Payment has cleared. Your boxes and their dates are below."
                : paid
                  ? "Payment has cleared and your order is being prepared."
                  : confirming
                    ? "Your payment went through. We are confirming the order now — this page updates itself in a few seconds."
                    : "We are waiting for your payment to be confirmed. This page shows the latest status whenever you reload it."}
      </p>

      <dl className="panel mt-8 p-5 text-sm sm:p-6">
        <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-4 text-ink-soft">
          <div>
            <dt className="inline">Order </dt>
            <dd className="tabular inline text-ink">{order.id}</dd>
          </div>
          <div>
            <dt className="sr-only">Placed</dt>
            <dd>
              <time dateTime={order.createdAt.toISOString()}>
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(order.createdAt)}
              </time>
            </dd>
          </div>
        </div>

        <div className="divide-y divide-line">
          {kind === "plan_upgrade" && plan ? (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink">
                Monthly plan: <span className="tabular">{plan.vialsPerBox}</span> vials a month for{" "}
                <span className="tabular">{plan.months}</span> months
              </dt>
              <dd className="tabular shrink-0 text-ink">{formatMinor(toMinor(order.totalAmount.toString()))}</dd>
            </div>
          ) : null}
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-4 py-3">
              <dt className="text-ink">
                {item.name} <span className="tabular text-ink-soft">× {item.qty}</span>
                {item.bundleName && item.bundleQty ? (
                  <span className="block text-xs text-ink-soft">
                    <span className="tabular">{item.bundleQty}</span> × {item.bundleName}
                  </span>
                ) : null}
              </dt>
              <dd className="tabular shrink-0 text-ink">
                {item.welcome || item.planBonus
                  ? "Free"
                  : item.planLine === "box"
                    ? "Included"
                    : formatMinor(
                        item.lineTotal ? toMinor(item.lineTotal) : toMinor(item.unitPrice) * item.qty
                      )}
              </dd>
            </div>
          ))}
        </div>

        {kind === "plan_box" ? (
          <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold">
            <dt>Paid</dt>
            <dd>Included in your plan</dd>
          </div>
        ) : (
          <div className="flex justify-between gap-4 border-t border-line pt-4 text-base font-semibold">
            <dt>Total paid</dt>
            <dd className="tabular">{formatMinor(toMinor(order.totalAmount.toString()))}</dd>
          </div>
        )}
      </dl>

      {plan && plan.status !== "pending" ? (
        <PlanSchedule plan={plan} boxes={plan.orders} currentOrderId={order.id} />
      ) : null}

      {upgrade ? (
        <PlanUpgradeOffer orderId={order.id} offers={upgrade.offers} deadlineText={upgrade.deadlineText} />
      ) : null}

      {sent ? (
        <section className="mt-10" aria-labelledby="parcel-heading">
          <h2 id="parcel-heading" className="text-xl">
            Your parcel
          </h2>
          <dl className="measure mt-4 space-y-2 text-base text-ink-soft">
            {carrier ? (
              <div>
                <dt className="inline">Sent by </dt>
                <dd className="inline text-ink">{carrier}</dd>
              </div>
            ) : null}
            {trackingNumber ? (
              <div>
                <dt className="inline">Tracking number </dt>
                <dd className="tabular inline font-medium text-ink">{trackingNumber}</dd>
              </div>
            ) : null}
            {parcel?.trackingEvent ? (
              <div>
                <dt className="inline">Latest update </dt>
                <dd className="inline text-ink">
                  {parcel.trackingEvent}
                  {parcel.trackingEventAt ? `, ${formatSaleDateTime(parcel.trackingEventAt)}` : ""}
                </dd>
              </div>
            ) : null}
            {order.deliveredAt ? (
              <div>
                <dt className="inline">Delivered </dt>
                <dd className="inline text-ink">{formatSaleDateTime(order.deliveredAt)}</dd>
              </div>
            ) : order.shippedAt ? (
              <div>
                <dt className="inline">Sent </dt>
                <dd className="inline text-ink">{formatSaleDateTime(order.shippedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : kind === "plan_upgrade" ? null : (
        <section className="mt-10" aria-labelledby="next-heading">
          <h2 id="next-heading" className="text-xl">
            What happens next
          </h2>
          <ol className="measure mt-4 space-y-3 text-base text-ink-soft">
            {/* A plan box is made by the daily cron: no confirmation email, no Stripe receipt. */}
            {kind === "plan_box" ? null : (
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-brand" />
                <span>
                  A confirmation email is on its way
                  {order.customerEmail ? (
                    <>
                      {" "}
                      to <span className="font-medium text-ink">{order.customerEmail}</span>
                    </>
                  ) : null}
                  . Stripe also emails its own payment receipt.
                </span>
              </li>
            )}
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-brand" />
              <span>
                {paidFor ? (
                  <>
                    We pack your order and send it by {paidFor.carrier} to the address you gave at
                    checkout
                    {nextDayDue ? (
                      <>
                        . It is due <span className="font-medium text-ink">{nextDayDue}</span>
                      </>
                    ) : (
                      <> ({paidFor.transit})</>
                    )}
                    .
                  </>
                ) : (
                  "We pack your order and dispatch it to the address you gave at checkout."
                )}
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-3 h-px w-4 shrink-0 bg-brand" />
              <span>{kind === "plan_box" ? "You get an email when it ships." : "You get a second email when it ships."}</span>
            </li>
          </ol>
        </section>
      )}

      <p className="mt-10 text-sm text-ink-soft">
        Something not right?{" "}
        {hasEmail ? (
          <>
            Email{" "}
            <a href={`mailto:${brand.contact.email}`} className="link">
              {brand.contact.email}
            </a>{" "}
            quoting your order number.
          </>
        ) : (
          <Link href="/contact" className="link">
            Get in touch
          </Link>
        )}
      </p>

      <p className="mt-8">
        <Link href="/" className="link">
          Back to the order page
        </Link>
      </p>
    </div>
  );
}
