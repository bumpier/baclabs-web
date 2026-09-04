import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, getAdminSession } from "@/lib/adminAuth";
import { formatPrice, type Currency } from "@/config/brand";
import { setOrderStatusAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "pending", "paid", "packed", "shipped", "delivered", "cancelled"] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-brand-tint text-brand-deep",
  packed: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-brand text-white",
  cancelled: "bg-red-50 text-red-600",
};

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

  const orders = await prisma.order.findMany({
    where: filter && filter !== "all" ? { status: filter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Fulfilment</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Orders
      </h1>

      <div className="mt-8 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/orders" : `/admin/orders?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === s
                ? "bg-brand text-white"
                : "border border-line bg-white text-ink-soft hover:border-brand"
            }`}
          >
            {s}
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
                return (
                  <tr key={o.id} className="hover:bg-brand-tint/40">
                    <td className="px-5 py-3 text-ink-soft">
                      {o.createdAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
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
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          STATUS_STYLES[o.status] ?? ""
                        }`}
                      >
                        {o.status}
                      </span>
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
                              Mark {nextStatus} →
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
