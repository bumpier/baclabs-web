import { prisma } from "@/lib/db";
import { paidMinor } from "@/lib/meta-capi-event";
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
const SOLD_STATUSES = ["paid", "packed", "shipped", "delivered"];

export interface TakingsOrder {
  status: string;
  amountPaidMinor: number | null;
  totalAmount: { toString(): string };
  deliveryMinor: number | null;
}

export interface TakingsSummary {
  /** What customers were charged, in pence. */
  takenMinor: number;
  orders: number;
  /** takenMinor / orders, or 0 on a day with no sales. */
  averageMinor: number;
  /** The part of takenMinor that was delivery. */
  deliveryMinor: number;
  /** Orders paid for that day and cancelled since — not in the figures above. */
  cancelledOrders: number;
  cancelledMinor: number;
}

export function summariseTakings(orders: TakingsOrder[]): TakingsSummary {
  const s: TakingsSummary = {
    takenMinor: 0,
    orders: 0,
    averageMinor: 0,
    deliveryMinor: 0,
    cancelledOrders: 0,
    cancelledMinor: 0,
  };
  for (const o of orders) {
    if (o.status === "cancelled") {
      s.cancelledOrders += 1;
      s.cancelledMinor += paidMinor(o);
      continue;
    }
    s.orders += 1;
    s.takenMinor += paidMinor(o);
    s.deliveryMinor += o.deliveryMinor ?? 0;
  }
  if (s.orders > 0) s.averageMinor = Math.round(s.takenMinor / s.orders);
  return s;
}

/** The day's paid orders, earliest first, and what they add up to. */
export async function dailyTakings(dayKey: string) {
  const { start, end } = shopDayBounds(dayKey);
  const inDay = { gte: start, lt: end };
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: { in: SOLD_STATUSES }, paidAt: inDay },
        // Paid before paidAt was recorded: when checkout began is all there is.
        { status: { in: SOLD_STATUSES }, paidAt: null, createdAt: inDay },
        // paidAt is only set once money arrives, so this is a paid order
        // cancelled afterwards, never an abandoned checkout.
        { status: "cancelled", paidAt: inDay },
      ],
    },
  });
  orders.sort((a, b) => saleTime(a).getTime() - saleTime(b).getTime());
  return { orders, summary: summariseTakings(orders) };
}
