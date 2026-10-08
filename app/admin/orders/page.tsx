import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, getAdminSession } from "@/lib/adminAuth";
import { formatPrice, type Currency } from "@/config/brand";
import { setOrderStatusAction } from "@/app/admin/actions";
import { LabelWarning } from "@/components/admin/LabelWarning";
import { TrackingWarning } from "@/components/admin/TrackingWarning";
import { STATUS_BADGE, STATUS_TABS, statusLabel } from "@/lib/order-status";
import { formatSaleClock, formatSaleDate, saleTime } from "@/lib/saleTime";
import { getInventoryMode } from "@/lib/inventory/mode";
import { PARCEL_KINDS } from "@/lib/plans/kinds";

export const dynamic = "force-dynamic";

// Pending orders are checkouts that were never paid, so they are not listed
// here. The nightly job deletes them once they can no longer be paid
// (lib/payments/abandoned.ts).
const STATUSES = ["all", ...STATUS_TABS] as const;

// What status a packer can advance an order to
const PACKER_NEXT_STATUS: Record<string, string | null> = {
  paid: "packed",
  packed: "shipped",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const session = await getAdminSession();
  const isPacker = session?.role === "PACKER";

  const { status } = await searchParams;
  const filter = STATUSES.includes(status as never) ? status : "all";

  const [orders, inventoryMode] = await Promise.all([
    prisma.order.findMany({
      where: { kind: { in: PARCEL_KINDS }, status: filter && filter !== "all" ? filter : { not: "pending" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      // The active label, if any: "Label created" vs "Packed", and the latest
      // tracking. Never the label PDF.
      include: {
        shipments: { where: { status: "CREATED" }, select: { trackingEvent: true }, take: 1 },
        plan: { select: { months: true } },
      },
    }),
    getInventoryMode(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Fulfilment</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-medium tracking-tight text-brand-deep">
          Orders
        </h1>
        {/* Only once orders have pick lists to scan — see lib/inventory/mode.ts. */}
        {inventoryMode === "warehouse" && (
          <Link href="/admin/orders/scan" className="btn-secondary">
            Scan station
          </Link>
        )}
      </div>

      <LabelWarning />
      <TrackingWarning showCatchUpLink={!isPacker} />

      <div className="mt-8 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/orders" : `/admin/orders?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === s
                ? "bg-brand text-white"
                : "border border-line bg-white text-ink-soft hover:border-brand"
            }`}
          >
            {s === "all" ? "All" : statusLabel(s)}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-sm text-ink-soft">No orders found.</p>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                {!isPacker && <th className="px-5 py-3 font-semibold">Total</th>}
                <th className="px-5 py-3 font-semibold">Method</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => {
                const nextStatus = PACKER_NEXT_STATUS[o.status] ?? null;
                const label = o.shipments[0];
                return (
                  <tr key={o.id} className="hover:bg-brand-tint/40">
                    <td className="px-5 py-3 text-ink-soft">
                      {formatSaleDate(saleTime(o))}
                      <span className="block text-xs">{formatSaleClock(saleTime(o))}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-medium">{o.customerName}</span>
                      <span className="block text-xs text-ink-soft">{o.customerEmail}</span>
                    </td>
                    {!isPacker && (
                      <td className="px-5 py-3 font-medium">
                        {formatPrice(o.totalAmount.toString(), o.currency as Currency)}
                      </td>
                    )}
                    <td className="px-5 py-3 capitalize text-ink-soft">{o.paymentMethod}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                          STATUS_BADGE[o.status] ?? ""
                        }`}
                      >
                        {statusLabel(o.status, { hasLabel: Boolean(label) })}
                      </span>
                      {o.status === "shipped" && label?.trackingEvent && (
                        <span className="mt-1 block max-w-[14rem] truncate text-xs text-ink-soft" title={label.trackingEvent}>
                          {label.trackingEvent}
                        </span>
                      )}
                      {o.status === "paid" && o.labelError && (
                        <span className="mt-1 block text-xs font-semibold text-red-600" title={o.labelError}>
                          No label
                        </span>
                      )}
                      {o.planBox && o.plan ? (
                        <span className="mt-1 block text-xs font-semibold text-brand-deep">
                          Plan box {o.planBox}/{o.plan.months}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {isPacker && nextStatus && (
                          <form action={setOrderStatusAction}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="status" value={nextStatus} />
                            <button
                              type="submit"
                              className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-deep"
                            >
                              Mark {statusLabel(nextStatus, { hasLabel: Boolean(label) }).toLowerCase()} →
                            </button>
                          </form>
                        )}
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-sm font-semibold text-brand hover:text-brand-deep"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
