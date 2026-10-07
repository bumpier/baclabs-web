/**
 * What each order status is called and how it looks in the admin.
 *
 * The stored values are unchanged — pending | paid | packed | shipped |
 * delivered | cancelled — because revenue, takings, the nudges and the
 * campaign audiences all filter on them. Only the names shown change:
 *
 *   Paid → Label created → Shipped → Delivered
 *
 * A label is bought the moment an order is paid (lib/shipping/shipments.ts),
 * which is what moves it to packed, so an order still "paid" is one whose
 * label could not be bought. Tracking moves it on from there
 * (lib/shipping/tracking-sync.ts).
 *
 * "packed" is also what the scan station and the packer's button set
 * without a label, so it reads "Label created" only when there is one.
 */

/** Still to leave the building. */
export const OPEN_STATUSES = ["paid", "packed"];

const LABELS: Record<string, string> = {
  pending: "Not paid",
  paid: "Paid",
  packed: "Label created",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_BADGE: Record<string, string> = {
  paid: "bg-brand-tint text-brand-deep",
  packed: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-brand text-white",
  cancelled: "bg-red-50 text-red-600",
};

/** The orders-list tabs, in the order an order moves through them. */
export const STATUS_TABS = ["paid", "packed", "shipped", "delivered", "cancelled"] as const;

export function statusLabel(status: string, opts: { hasLabel?: boolean } = {}): string {
  if (status === "packed" && opts.hasLabel === false) return "Packed";
  return LABELS[status] ?? status;
}

/**
 * Which way an order may be moved by hand. Forward only, so a page left open
 * cannot pull an order back — a delivered order to shipped, say, re-sending
 * the "on its way" email after the "delivered" one.
 */
export const MANUAL_MOVES: Record<string, readonly string[]> = {
  pending: ["cancelled"],
  paid: ["packed", "shipped", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
