/**
 * What an Order row is. Stored in Order.kind (prisma/schema.prisma).
 *
 *  - "sale":         something a customer bought. A plan's purchase order is a
 *                    sale too: it is box 1 and carries the whole plan's price.
 *  - "plan_box":     a later box of a prepaid plan, made by the daily cron,
 *                    already paid, £0. A parcel, not a sale.
 *  - "plan_upgrade": the payment that turned a one-off order into box 1 of a
 *                    plan. Money, not a parcel.
 *
 * Pure: imported by finance, fulfilment, emails and the admin alike.
 */
export const ORDER_KINDS = ["sale", "plan_box", "plan_upgrade"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** Rows from before kinds existed, and anything unrecognised, are sales. */
export function orderKind(raw: string | null | undefined): OrderKind {
  return (ORDER_KINDS as readonly string[]).includes(raw ?? "") ? (raw as OrderKind) : "sale";
}

/** Counted in order totals, average order value, pack mix and new/returning. */
export function countsAsOrder(kind: OrderKind): boolean {
  return kind === "sale";
}

/** Brings money in. A plan box was paid for by its plan's purchase. */
export function carriesRevenue(kind: OrderKind): boolean {
  return kind !== "plan_box";
}

/** Goes out in a box: stock, a label, a place in the orders list. */
export function shipsParcel(kind: OrderKind): boolean {
  return kind !== "plan_upgrade";
}

/** For Prisma `where: { kind: { in: PARCEL_KINDS } }` on every fulfilment surface. */
export const PARCEL_KINDS: string[] = ORDER_KINDS.filter((k) => shipsParcel(k));
