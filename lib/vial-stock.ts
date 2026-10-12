import type { VialDelivery } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SOLD_STATUSES } from "@/lib/dailyTakings";
import { PARCEL_KINDS } from "@/lib/plans/kinds";
import { shopDayBounds, shopDayKey, weekKey } from "@/lib/saleTime";

/**
 * How many vials are left at fulfilment, worked out rather than counted
 * down: every row booked in on /admin/stock (VialDelivery) less every vial
 * on an order paid since the earliest row's day. Nothing is stored, so the
 * figure cannot drift from the orders it comes from, and a cancelled order
 * drops out by itself.
 *
 * "Sent out" is every paid order, not only those a carrier has scanned: the
 * label is bought on payment, and scans have proved unreliable
 * (lib/shipping/tracking-sync.ts). The welcome vial and a plan's boxes and
 * bonus pack are lines on their orders, so they count; a plan upgrade is a
 * payment with no parcel and does not (lib/plans/kinds.ts).
 *
 * Separate from Product.stock, the counter checkout sells against.
 */

/** At or below this many vials, the admin warns that stock is running low. */
export const LOW_STOCK_VIALS = 200;

/** Days of orders the "how long they last" estimate averages over. */
export const RATE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SentOrder {
  paidAt: Date;
  items: string;
}

export interface VialStock {
  /** The day the count starts: the earliest delivery. Null when nothing is booked in. */
  since: string | null;
  received: number;
  sent: number;
  /** Can go below zero when orders took more than was booked in. */
  left: number;
  low: boolean;
  /** Average vials a day over the last RATE_DAYS days (fewer if the count is younger). */
  perDay: number;
  /** How long what is left lasts at perDay. Null when nothing has gone out lately. */
  daysLeft: number | null;
  /** Monday-started UK weeks, newest first. */
  byWeek: { week: string; orders: number; vials: number }[];
}

/** The vials on one order: every line's qty, packs and free lines alike. */
export function vialsOnOrder(itemsJson: string): number {
  let items: unknown;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return 0;
  }
  if (!Array.isArray(items)) return 0;
  let vials = 0;
  for (const item of items) {
    const qty = (item as { qty?: unknown } | null)?.qty;
    if (typeof qty === "number" && Number.isInteger(qty) && qty > 0) vials += qty;
  }
  return vials;
}

/** Pure, so scripts/test-vial-stock.ts can hold it to the day boundaries. */
export function summariseVialStock(
  deliveries: Pick<VialDelivery, "vials" | "receivedOn">[],
  orders: SentOrder[],
  now: Date
): VialStock {
  if (deliveries.length === 0) {
    return { since: null, received: 0, sent: 0, left: 0, low: false, perDay: 0, daysLeft: null, byWeek: [] };
  }

  const since = deliveries.reduce((min, d) => (d.receivedOn < min ? d.receivedOn : min), deliveries[0]!.receivedOn);
  const start = shopDayBounds(since).start;
  const received = deliveries.reduce((sum, d) => sum + d.vials, 0);

  const rateStart = new Date(Math.max(start.getTime(), now.getTime() - RATE_DAYS * DAY_MS));
  let sent = 0;
  let recent = 0;
  const weeks = new Map<string, { orders: number; vials: number }>();
  for (const o of orders) {
    if (o.paidAt < start) continue;
    const vials = vialsOnOrder(o.items);
    sent += vials;
    if (o.paidAt >= rateStart) recent += vials;
    const week = weekKey(shopDayKey(o.paidAt));
    const row = weeks.get(week) ?? { orders: 0, vials: 0 };
    row.orders += 1;
    row.vials += vials;
    weeks.set(week, row);
  }

  const left = received - sent;
  // At least a day, so the first hours of a new count do not read as a rush.
  const rateDays = Math.max(1, (now.getTime() - rateStart.getTime()) / DAY_MS);
  const perDay = recent / rateDays;
  return {
    since,
    received,
    sent,
    left,
    low: left <= LOW_STOCK_VIALS,
    perDay,
    daysLeft: perDay > 0 ? Math.max(0, Math.floor(left / perDay)) : null,
    byWeek: [...weeks]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([week, row]) => ({ week, ...row })),
  };
}

/** Every delivery, newest first. */
export function listVialDeliveries(): Promise<VialDelivery[]> {
  return prisma.vialDelivery.findMany({ orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }] });
}

export async function loadVialStock(now = new Date()): Promise<VialStock> {
  const deliveries = await prisma.vialDelivery.findMany({ select: { vials: true, receivedOn: true } });
  if (deliveries.length === 0) return summariseVialStock([], [], now);
  const since = deliveries.reduce((min, d) => (d.receivedOn < min ? d.receivedOn : min), deliveries[0]!.receivedOn);
  const orders = await prisma.order.findMany({
    where: {
      status: { in: SOLD_STATUSES },
      kind: { in: PARCEL_KINDS },
      paidAt: { gte: shopDayBounds(since).start },
    },
    select: { paidAt: true, items: true },
  });
  return summariseVialStock(
    deliveries,
    orders.flatMap((o) => (o.paidAt ? [{ paidAt: o.paidAt, items: o.items }] : [])),
    now
  );
}
