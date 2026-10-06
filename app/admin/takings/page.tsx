import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import { formatPrice } from "@/config/brand";
import { dailyTakings } from "@/lib/dailyTakings";
import { paidMinor } from "@/lib/meta-capi-event";
import {
  formatSaleClock,
  formatShopDay,
  parseDayKey,
  saleTime,
  shiftDayKey,
  shopDayKey,
} from "@/lib/saleTime";

export const dynamic = "force-dynamic";

const gbp = (minor: number) => formatPrice(minor / 100, "GBP");
const dayHref = (dayKey: string) => `/admin/takings?date=${dayKey}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const DAY_LINK =
  "rounded-full border border-line bg-white px-4 py-1.5 text-ink-soft transition-colors hover:border-brand";

export default async function AdminTakingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdminRole("ADMIN");

  const today = shopDayKey(new Date());
  const { date } = await searchParams;
  // No date, a mistyped one, or one that has not happened yet: show today.
  const requested = parseDayKey(date);
  const day = requested && requested <= today ? requested : today;
  const isToday = day === today;

  const { orders, summary } = await dailyTakings(day);

  const figures = [
    { label: isToday ? "Taken so far" : "Taken", value: gbp(summary.takenMinor), highlight: true },
    { label: "Orders", value: String(summary.orders) },
    { label: "Average order", value: summary.orders > 0 ? gbp(summary.averageMinor) : "—" },
    { label: "Of which delivery", value: gbp(summary.deliveryMinor) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Sales</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Daily takings
      </h1>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex flex-wrap items-center gap-3 font-display text-xl font-medium text-brand-deep">
            {formatShopDay(day)}
            {isToday && (
              <span className="rounded-full bg-brand-tint px-2.5 py-1 font-sans text-xs font-semibold text-brand-deep">
                Today
              </span>
            )}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
            <Link href={dayHref(shiftDayKey(day, -1))} className={DAY_LINK}>
              ← Previous day
            </Link>
            {!isToday && (
              <>
                <Link href={dayHref(shiftDayKey(day, 1))} className={DAY_LINK}>
                  Next day →
                </Link>
                <Link href="/admin/takings" className={DAY_LINK}>
                  Today
                </Link>
              </>
            )}
          </div>
        </div>

        <form method="get" className="flex items-end gap-2">
          <div>
            <label htmlFor="date" className="label">
              Go to a day
            </label>
            {/* Keyed so the field follows the day when the links above change it. */}
            <input
              key={day}
              id="date"
              name="date"
              type="date"
              defaultValue={day}
              max={today}
              required
              className="field"
            />
          </div>
          <button type="submit" className="btn-secondary">
            View
          </button>
        </form>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className={`card p-5 ${f.highlight ? "border-brand bg-brand-tint" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{f.label}</p>
            <p className="mt-2 font-display text-3xl font-medium text-brand-deep">{f.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-sm text-ink-soft">
        What customers were charged — delivery included, discount codes taken off — on orders whose
        payment went through between midnight and midnight, UK time. Before payment fees and costs.
      </p>

      {summary.cancelledOrders > 0 && (
        <p className="alert-note mt-4 max-w-3xl">
          {plural(summary.cancelledOrders, "order")} paid for on this day{" "}
          {summary.cancelledOrders === 1 ? "was" : "were"} cancelled afterwards and{" "}
          {summary.cancelledOrders === 1 ? "is" : "are"} not counted:{" "}
          {gbp(summary.cancelledMinor)}.
        </p>
      )}

      {orders.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-sm text-ink-soft">
          {isToday ? "No sales yet today." : "No sales on this day."}
        </p>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Method</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Charged</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => {
                const cancelled = o.status === "cancelled";
                return (
                  <tr key={o.id} className="hover:bg-brand-tint/40">
                    <td className="px-5 py-3 text-ink-soft">{formatSaleClock(saleTime(o))}</td>
                    <td className="px-5 py-3">
                      <span className="font-medium">{o.customerName}</span>
                      <span className="block text-xs text-ink-soft">{o.customerEmail}</span>
                    </td>
                    <td className="px-5 py-3 capitalize text-ink-soft">{o.paymentMethod}</td>
                    <td className={`px-5 py-3 capitalize ${cancelled ? "text-red-600" : "text-ink-soft"}`}>
                      {o.status}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-medium tabular-nums ${
                        cancelled ? "text-ink-soft line-through" : ""
                      }`}
                    >
                      {gbp(paidMinor(o))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-sm font-semibold text-brand hover:text-brand-deep"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td colSpan={4} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Taken
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-brand-deep">
                  {gbp(summary.takenMinor)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
