/**
 * A brand's order confirmation page, as data: what BacLab's page
 * (app/(baclab)/(store)/order-confirmation/[id]/page.tsx) works out inline,
 * for an order of another brand, so each brand's page is only its own view.
 * Plain and serialisable: the page may hand any of it to a client component.
 *
 * SERVER CODE (Prisma, config/funnel.ts, the shipping helpers).
 *
 * THE BRAND CHECK. An order id in the URL is the only key to its page, so
 * the order is shown only on its own brand's site: on any other brand's
 * site, BacLab's included, it does not exist (null, and the page calls
 * notFound()). The same rule as /api/order-status (belongsToHost), and it
 * never names the brand the order did belong to.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { brandFor, type BrandProfile } from "@/brands/registry";
import { deliveryOptionById, dispatchNoticeAt, labKitContents } from "@/config/funnel";
import { formatDeliveryDay, nextDayDeadline, ukDayKey } from "@/lib/delivery-date";
import { paidMinor, purchaseContents, purchaseEventId } from "@/lib/meta-capi-event";
import { parseTrackingNumbers } from "@/lib/shipping/shipments";
import { trackingLink } from "@/lib/shipping/carriers";
import { formatSaleDateTime } from "@/lib/saleTime";
import { isKitLine } from "@/lib/order-items";
import { orderKind } from "@/lib/plans/kinds";
import type { PurchaseTrackerProps } from "@/components/commerce/PurchaseTracker";

export interface OrderLineView {
  name: string;
  qty: number;
  /** "2 × 3-vial pack", or a kit's parts. "" for none. */
  detail: string;
  /** The line's total in pence, or null for a free line (a gift). */
  totalMinor: number | null;
}

export interface OrderView {
  id: string;
  /** ISO timestamp the order was placed. */
  placedAt: string;
  /** "Placed 4 November 2026". */
  placedText: string;
  status: string;
  /** Payment has cleared. */
  paid: boolean;
  /**
   * Back from paying before the payment is confirmed to us: the order is not
   * yet marked paid. Presentation only (the marker is in the URL, which
   * anyone can type); the status still comes from the payment's own
   * confirmation.
   */
  confirming: boolean;
  cancelled: boolean;
  /** On its way, or delivered. */
  sent: boolean;
  delivered: boolean;
  lines: OrderLineView[];
  /** The goods total, in pence. */
  goodsMinor: number;
  /** What the card was charged, delivery included, once paid; null before. */
  paidMinor: number | null;
  customerEmail: string | null;
  /** The delivery the customer chose, once the webhook has recorded it. */
  delivery: { label: string; carrier: string; transit: string; dueText: string | null } | null;
  /** Paid over a weekend or bank holiday: the day it ships, and why. */
  shipsOn: { text: string; detail: string } | null;
  parcel: {
    carrier: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    latest: string | null;
    sentText: string | null;
    deliveredText: string | null;
  } | null;
  /** The purchase event's props, once paid; null before. */
  tracker: PurchaseTrackerProps | null;
}

/** Pence from a decimal string, so every figure is integer arithmetic. */
function toMinor(value: string): number {
  return Math.round(Number(value) * 100);
}

interface StoredLine {
  name: string;
  qty: number;
  unitPrice: string;
  lineTotal?: string;
  bundleName?: string;
  bundleQty?: number;
  sku?: string;
  welcome?: boolean;
  gift?: boolean;
}

/**
 * Whether the confirmation page was reached on the way back from paying:
 * the return address carries a marker. `paid` is the one PayPal's return
 * route sends once it has captured (lib/commerce/payments/paypal-settle.ts),
 * as an on-site pay page does (BacLab's PayStatus convention); `session_id`
 * is a Stripe Checkout return's (lib/commerce/payments/stripe.ts success_url).
 * A new provider's return uses `paid` too.
 */
export function returnedFromPayment(searchParams: Record<string, string | string[] | undefined>): boolean {
  return Boolean(searchParams.session_id || searchParams.paid);
}

export async function brandOrderView(
  id: string,
  brand: BrandProfile,
  opts: { returned?: boolean } = {}
): Promise<OrderView | null> {
  // Order ids are UUIDs: unguessable, which is what makes showing one safe.
  if (!z.string().uuid().safeParse(id).success) return null;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || brandFor(order.brand).id !== brand.id) return null;

  const items = JSON.parse(order.items) as StoredLine[];
  const paid = order.status !== "pending" && order.status !== "cancelled";
  const confirming = order.status === "pending" && opts.returned === true;
  const sent = order.status === "shipped" || order.status === "delivered";

  // The option as this brand sells it (luxury's next day is free), by the
  // id the webhook recorded; carrier and transit are the shared service's.
  const chosen =
    brand.catalogue?.delivery.options.find((o) => o.id === order.deliveryOption) ??
    deliveryOptionById(order.deliveryOption);
  const dueText =
    chosen?.id === "next_day" && order.paidAt ? formatDeliveryDay(nextDayDeadline(order.paidAt).deliveryDayKey) : null;

  // Paid from the Friday cutoff until Monday, or over a bank holiday: the
  // day it ships, until it goes.
  const notice = order.paidAt && !sent && order.status !== "packed" ? dispatchNoticeAt(order.paidAt) : null;
  const shipsOn =
    notice && ukDayKey(new Date()) <= notice.dispatchDayKey
      ? { text: formatDeliveryDay(notice.dispatchDayKey), detail: notice.detail }
      : null;

  const shipment =
    sent || order.status === "packed"
      ? await prisma.shipment.findFirst({
          where: { orderId: order.id, status: "CREATED" },
          orderBy: { createdAt: "desc" },
          select: { trackingNumbers: true, carrierName: true, serviceName: true, trackingEvent: true, trackingEventAt: true },
        })
      : null;
  const trackingNumber = shipment ? (parseTrackingNumbers(shipment.trackingNumbers)[0] ?? null) : null;
  const link = trackingNumber
    ? trackingLink(trackingNumber, shipment?.carrierName, shipment?.serviceName, chosen?.carrier)
    : null;

  const contents = purchaseContents(order.items, brand.id);
  const tracker: PurchaseTrackerProps | null =
    paid && orderKind(order.kind) !== "plan_box"
      ? {
          orderId: order.id,
          eventId: purchaseEventId(order.id),
          valueMinor: paidMinor(order),
          contentIds: contents.map((c) => c.id),
          numItems: contents.reduce((n, c) => n + c.quantity, 0),
          items: items
            .filter((i) => !i.gift)
            .map((i) => ({
              item_id: i.sku ?? brand.catalogue?.parentSku ?? i.name,
              item_name: i.name,
              // One item per line at its exact total, so per-item revenue
              // always sums to the order's.
              price: Number(i.lineTotal ?? (Number(i.unitPrice) * i.qty).toFixed(2)),
              quantity: 1,
            })),
        }
      : null;

  return {
    id: order.id,
    placedAt: order.createdAt.toISOString(),
    placedText: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(order.createdAt),
    status: order.status,
    paid,
    confirming,
    cancelled: order.status === "cancelled",
    sent,
    delivered: order.status === "delivered",
    lines: items.map((i) => ({
      name: i.name,
      qty: i.qty,
      detail: isKitLine(i)
        ? labKitContents(i.qty)
        : i.bundleName && i.bundleQty
          ? `${i.bundleQty} × ${i.bundleName}`
          : "",
      totalMinor: i.welcome || i.gift ? null : i.lineTotal ? toMinor(i.lineTotal) : toMinor(i.unitPrice) * i.qty,
    })),
    goodsMinor: toMinor(order.totalAmount.toString()),
    paidMinor: paid ? paidMinor(order) : null,
    customerEmail: order.customerEmail || null,
    delivery: chosen ? { label: chosen.label, carrier: chosen.carrier, transit: chosen.transit, dueText } : null,
    shipsOn,
    parcel: shipment
      ? {
          carrier: link?.carrier || chosen?.carrier || "",
          trackingNumber,
          trackingUrl: link?.url ?? null,
          latest: shipment.trackingEvent
            ? `${shipment.trackingEvent}${shipment.trackingEventAt ? `, ${formatSaleDateTime(shipment.trackingEventAt)}` : ""}`
            : null,
          sentText: order.shippedAt ? formatSaleDateTime(order.shippedAt) : null,
          deliveredText: order.deliveredAt ? formatSaleDateTime(order.deliveredAt) : null,
        }
      : null,
    tracker,
  };
}
