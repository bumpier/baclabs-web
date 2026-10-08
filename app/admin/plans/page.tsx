import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { formatMinor } from "@/config/funnel";
import { formatSaleDate } from "@/lib/saleTime";

export const dynamic = "force-dynamic";

const FILTERS = ["active", "completed", "cancelled", "pending", "all"] as const;
type Filter = (typeof FILTERS)[number];

const BADGE: Record<string, string> = {
  active: "bg-brand-tint text-brand-deep",
  completed: "bg-brand text-white",
  cancelled: "bg-red-50 text-red-600",
  pending: "bg-line text-ink-soft",
};

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminRole("ADMIN");
  const { status } = await searchParams;
  const filter: Filter = FILTERS.includes(status as Filter) ? (status as Filter) : "active";

  const plans = await prisma.plan.findMany({
    where: filter === "all" ? { status: { not: "pending" } } : { status: filter },
    orderBy: [{ nextBoxAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Fulfilment</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Monthly plans</h1>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "active" ? "/admin/plans" : `/admin/plans?status=${f}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:border-brand"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {plans.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-sm text-ink-soft">No plans found.</p>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 font-semibold">Paid</th>
                <th className="px-5 py-3 font-semibold">Boxes</th>
                <th className="px-5 py-3 font-semibold">Next box</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plans.map((p) => {
                const systemCancelled = p.cancelledBy.startsWith("system:");
                return (
                  <tr key={p.id} className="hover:bg-brand-tint/40">
                    <td className="px-5 py-3 font-medium">{p.email || "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {p.vialsPerBox} vials × {p.months} months
                      {p.source === "upgrade" && <span className="block text-xs">upgrade</span>}
                    </td>
                    <td className="px-5 py-3 font-medium tabular">{formatMinor(p.paidMinor ?? 0)}</td>
                    <td className="px-5 py-3 tabular">
                      {p.boxesSent}/{p.months}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{p.nextBoxAt ? formatSaleDate(p.nextBoxAt) : "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${BADGE[p.status] ?? ""}`}
                      >
                        {p.status}
                      </span>
                      {p.status === "cancelled" && (
                        <span className="mt-1 block text-xs text-ink-soft">
                          {systemCancelled
                            ? `Refund due ${formatMinor(p.refundMinor ?? 0)}`
                            : `Refund ${formatMinor(p.refundMinor ?? 0)} recorded`}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/plans/${p.id}`} className="text-sm font-semibold text-brand hover:text-brand-deep">
                        View →
                      </Link>
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
