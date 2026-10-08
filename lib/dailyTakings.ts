import type { Prisma } from "@prisma/client";
import { DELIVERY_OPTIONS } from "@/config/funnel";
import { prisma } from "@/lib/db";
import { paidMinor } from "@/lib/meta-capi-event";
import { orderKind } from "@/lib/plans/kinds";
import { saleTime, shopDayBounds } from "@/lib/saleTime";

/**
 * How much money the shop took on one UK day, for /admin/takings and the
 * dashboard's "Taken today" card.
 *
 * Money taken is what customers were charged — delivery included, promotion
 * codes applied — not the goods total, and not profit: the shop records no
 * costs. An order belongs to the day its payment went through.
 */

/** Paid for, and still standing. */
export const SOLD_STATUSES = ["paid", "packed", "shipped", "delivered"];

/**
 * The orders whose sale falls in [start, end): sold ones, and ones paid for
 * then cancelled. Shared with /admin/finance so the two always agree.
 */
export function takingsWhere(start: Date, end: Date): Prisma.OrderWhereInput {
  const inRange = { gte: start, lt: end };
  return {
    OR: [
      { status: { in: SOLD_STATUSES }, paidAt: inRange },
      // Paid before paidAt was recorded: when checkout began is all there is.
      { status: { in: SOLD_STATUSES }, paidAt: null, createdAt: inRange },
      // paidAt is only set once money arrives, so this is a paid order
      // cancelled afterwards, never an abandoned checkout.
      { status: "cancelled", paidAt: inRange },
    ],
  };
}

export interface TakingsOrder {
  /** sale | plan_box | plan_upgrade; absent = sale (lib/plans/kinds.ts). */
  kind?: string;
  status: string;
  amountPaidMinor: number | null;
  totalAmount: { toString(): string };
  deliveryMinor: number | null;
  deliveryOption: string | null;
}

/** The orders that went out one way, at one delivery price. */
export interface DeliveryLine {
  /** A DELIVERY_OPTIONS id, or null on orders from before there was a choice. */
  option: string | null;
  /** What each of these orders paid for delivery, in pence. 0 = free. */
  priceMinor: number;
  orders: number;
  totalMinor: number;
}

export interface TakingsSummary {
  /** What customers were charged, in pence. */
  takenMinor: number;
  orders: number;
  /** takenMinor / sales: a plan upgrade adds money to the sale it grew. 0 on a day with no sales. */
  averageMinor: number;
  /** The part of takenMinor that was delivery. */
  deliveryMinor: number;
  /** takenMinor less delivery: what the goods sold for, discount codes off. */
  goodsMinor: number;
  /** deliveryMinor by option and price: checkout's order, dearest first. */
  delivery: DeliveryLine[];
  /** Orders paid for that day and cancelled since — not in the figures above. */
  cancelledOrders: number;
  cancelledMinor: number;
}

/** What one order's goods sold for: the amount charged less its delivery. */
export function goodsMinor(o: TakingsOrder): number {
  return paidMinor(o) - (o.deliveryMinor ?? 0);
}

/** Options in checkout's order; one the config no longer lists, or none, last. */
export function optionRank(option: string | null): number {
  const i = DELIVERY_OPTIONS.findIndex((o) => o.id === option);
  return i === -1 ? DELIVERY_OPTIONS.length : i;
}

export function summariseTakings(orders: TakingsOrder[]): TakingsSummary {
  const s: TakingsSummary = {
    takenMinor: 0,
    orders: 0,
    averageMinor: 0,
    deliveryMinor: 0,
    goodsMinor: 0,
    delivery: [],
    cancelledOrders: 0,
    cancelledMinor: 0,
  };
  const lines = new Map<string, DeliveryLine>();
  for (const o of orders) {
    const kind = orderKind(o.kind);
    // A prepaid box brings no money and is no order; its costs are on the finance ledger.
    if (kind === "plan_box") continue;
    if (o.status === "cancelled") {
      s.cancelledOrders += kind === "sale" ? 1 : 0;
      s.cancelledMinor += paidMinor(o);
      continue;
    }
    if (kind === "sale") s.orders += 1;
    s.takenMinor += paidMinor(o);
    s.deliveryMinor += o.deliveryMinor ?? 0;
    s.goodsMinor += goodsMinor(o);
    // An upgrade is money added to a sale: no delivery line of its own.
    if (kind !== "sale") continue;

    // Free next day and paid next day are separate lines: same carrier,
    // different money.
    const option = o.deliveryOption;
    const priceMinor = o.deliveryMinor ?? 0;
    const key = `${option ?? ""}:${priceMinor}`;
    const line = lines.get(key) ?? { option, priceMinor, orders: 0, totalMinor: 0 };
    line.orders += 1;
    line.totalMinor += priceMinor;
    lines.set(key, line);
  }
  if (s.orders > 0) s.averageMinor = Math.round(s.takenMinor / s.orders);
  s.delivery = [...lines.values()].sort(
    (a, b) => optionRank(a.option) - optionRank(b.option) || b.priceMinor - a.priceMinor
  );
  return s;
}

/** The day's paid orders, earliest first, and what they add up to. */
export async function dailyTakings(dayKey: string) {
  const { start, end } = shopDayBounds(dayKey);
  const orders = await prisma.order.findMany({ where: takingsWhere(start, end) });
  orders.sort((a, b) => saleTime(a).getTime() - saleTime(b).getTime());
  return { orders, summary: summariseTakings(orders) };
}
