import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import type { LedgerRow } from "@/lib/finance/ledger";
import { loadFinance } from "@/lib/finance/query";
import { statusLabel } from "@/lib/order-status";
import { formatSaleClock, formatShopDay, parseDayKey, shiftDayKey, shopDayKey } from "@/lib/saleTime";
import { describeDelivery, FinanceWarningsPanel, gbp, plural, Stat } from "@/components/admin/finance/parts";

export const dynamic = "force-dynamic";

const dayHref = (dayKey: string) => `/admin/takings?date=${dayKey}`;
const signed = (minor: number) => (minor < 0 ? `−${gbp(-minor)}` : gbp(minor));

const DAY_LINK =
  "rounded-full border border-line bg-white px-4 py-1.5 text-ink-soft transition-colors hover:border-brand";

/** Why an order's postage is not a figure yet, in a couple of words. */
function postageGap(r: LedgerRow): string | null {
  if (r.postageStatus === "pending") return "label being bought";
  if (r.postageStatus === "no_rate") return "service has no price";
  if (r.postageStatus === "no_label") return r.status === "paid" ? "no label yet" : "no label";
  return null;
}

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

  const f = await loadFinance(day, day, { compare: false });
  const t = f.totals;
  const orders = f.rows;
  const showVat = t.vatMinor > 0;

  const figures = [
    { label: isToday ? "Taken so far" : "Taken", value: gbp(t.takenMinor), highlight: true },
    { label: "Order value excl. delivery", value: gbp(t.goodsMinor) },
    { label: "Of which delivery", value: gbp(t.deliveryMinor) },
    { label: "Postage paid", value: gbp(t.postageMinor + t.cancelledLabelMinor) },
    { label: "Fulfilment", value: gbp(t.fulfilmentMinor), note: plural(t.packages, "package") },
    { label: "After shipping costs", value: signed(t.afterCostsMinor), highlight: true },
    { label: "Orders", value: String(t.orders) },
    { label: "Average order", value: t.orders > 0 ? gbp(t.averageMinor) : "—" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Finance</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-medium tracking-tight text-brand-deep">Daily takings</h1>
        <Link href="/admin/finance" className="btn-secondary">
          Finance overview
        </Link>
      </div>

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
        {figures.map((fig) => (
          <Stat key={fig.label} {...fig} />
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-sm text-ink-soft">
        What customers were charged — delivery included, discount codes taken off — on orders whose payment went
        through between midnight and midnight, UK time. After shipping costs takes off postage
        {showVat ? ", VAT" : ""} and the fulfilment fee; product cost and card fees are not taken off. Prices are set
        on the{" "}
        <Link href="/admin/finance/costs" className="link">
          Costs
        </Link>{" "}
        page.
      </p>

      {t.cancelledOrders > 0 && (
        <p className="alert-note mt-4 max-w-3xl">
          {plural(t.cancelledOrders, "order")} paid for on this day {t.cancelledOrders === 1 ? "was" : "were"}{" "}
          cancelled afterwards and {t.cancelledOrders === 1 ? "is" : "are"} not counted: {gbp(t.cancelledMinor)}.
        </p>
      )}

      <FinanceWarningsPanel warnings={f.warnings} serviceNames={f.serviceNames} />

      {f.delivery.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-medium text-brand-deep">Delivery by option</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {f.delivery.map((line) => {
              const { name, detail } = describeDelivery(line);
              return (
                <div key={`${line.option}:${line.priceMinor}`} className="card p-5">
                  <p className="font-semibold text-brand-deep">{name}</p>
                  {detail && <p className="text-xs text-ink-soft">{detail}</p>}
                  <p className="mt-3 font-display text-2xl font-medium text-brand-deep">{gbp(line.chargedMinor)}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {plural(line.orders, "order")}
                    {line.priceMinor > 0 ? ` at ${gbp(line.priceMinor)}` : ", no delivery charge"}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Postage {gbp(line.postageMinor)}
                    {line.postageUnknown > 0 ? ` (${line.postageUnknown} not known yet)` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
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
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Order value</th>
                <th className="px-4 py-3 text-right font-semibold">Delivery</th>
                <th className="px-4 py-3 text-right font-semibold">Charged</th>
                <th className="px-4 py-3 text-right font-semibold">Postage</th>
                <th className="px-4 py-3 text-right font-semibold">Fulfilment</th>
                <th className="px-4 py-3 text-right font-semibold">After costs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => {
                const money = `px-4 py-3 text-right tabular-nums ${o.cancelled ? "text-ink-soft line-through" : ""}`;
                const gap = postageGap(o);
                return (
                  <tr key={o.id} className="hover:bg-brand-tint/40">
                    <td className="px-4 py-3 text-ink-soft">{formatSaleClock(o.saleTime)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{o.customerName}</span>
                      <span className="block text-xs text-ink-soft">{o.customerEmail}</span>
                    </td>
                    <td className={`px-4 py-3 ${o.cancelled ? "text-red-600" : "text-ink-soft"}`}>
                      {statusLabel(o.status)}
                    </td>
                    <td className={money}>{gbp(o.goodsMinor)}</td>
                    <td className={money}>
                      {gbp(o.deliveryMinor)}
                      <span className="block text-xs text-ink-soft">
                        {describeDelivery({ option: o.deliveryOption, priceMinor: o.deliveryMinor }).name}
                      </span>
                    </td>
                    <td className={`${money} font-medium`}>{gbp(o.takenMinor)}</td>
                    {/* Postage on a cancelled order was still paid: not struck through. */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {gap && o.postageMinor === 0 ? "—" : gbp(o.postageMinor)}
                      {gap && <span className="block text-xs text-ink-soft">{gap}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{gbp(o.fulfilmentMinor)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        o.afterCostsMinor < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {signed(o.afterCostsMinor)}
                    </td>
                    <td className="px-4 py-3 text-right">
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
              <tr className="border-t border-line font-semibold tabular-nums text-brand-deep">
                <td colSpan={3} className="px-4 py-3 text-xs uppercase tracking-wider text-ink-soft">
                  Taken
                </td>
                <td className="px-4 py-3 text-right">{gbp(t.goodsMinor)}</td>
                <td className="px-4 py-3 text-right">{gbp(t.deliveryMinor)}</td>
                <td className="px-4 py-3 text-right">{gbp(t.takenMinor)}</td>
                <td className="px-4 py-3 text-right">{gbp(t.postageMinor + t.cancelledLabelMinor)}</td>
                <td className="px-4 py-3 text-right">{gbp(t.fulfilmentMinor)}</td>
                <td className="px-4 py-3 text-right">{signed(t.afterCostsMinor)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
