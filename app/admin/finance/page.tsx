import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import type { Bucket, FinanceTotals } from "@/lib/finance/ledger";
import { loadFinance } from "@/lib/finance/query";
import { PRESETS, resolveRange } from "@/lib/finance/range";
import { daysInRange, shopDayKey } from "@/lib/saleTime";
import { ShippingChart, TakingsChart, type FinancePoint } from "@/components/admin/finance/FinanceCharts";
import { describeDelivery, FinanceWarningsPanel, gbp, plural, shortDay, Stat } from "@/components/admin/finance/parts";

export const dynamic = "force-dynamic";

const PILL = "rounded-full border px-4 py-1.5 transition-colors";
const PILL_OFF = `${PILL} border-line bg-white text-ink-soft hover:border-brand`;
const PILL_ON = `${PILL} border-brand bg-brand-tint text-brand-deep`;
const TH = "px-4 py-3 font-semibold";
const TD_MONEY = "px-4 py-3 text-right tabular-nums";

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");
const signed = (minor: number) => (minor < 0 ? `−${gbp(-minor)}` : gbp(minor));

/** "▲ 12% vs previous 30 days", or plain words when there is nothing to compare with. */
function versus(current: number, previous: number | undefined, days: number): string | undefined {
  if (previous === undefined) return undefined;
  const period = `previous ${plural(days, "day")}`;
  if (previous === 0) return current === 0 ? `Same as ${period}` : `None in ${period}`;
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (change === 0) return `Level with ${period}`;
  return `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}% vs ${period}`;
}

function chartPoint(b: Bucket): FinancePoint {
  const t = b.totals;
  return {
    label: b.label,
    goods: t.goodsMinor / 100,
    delivery: t.deliveryMinor / 100,
    afterCosts: t.afterCostsMinor / 100,
    postage: (t.postageMinor + t.cancelledLabelMinor) / 100,
    fulfilment: t.fulfilmentMinor / 100,
  };
}

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireAdminRole("ADMIN");

  const today = shopDayKey(new Date());
  const range = resolveRange(await searchParams, today);
  const f = await loadFinance(range.from, range.to, { compare: true });
  const t = f.totals;
  const p = f.previous?.totals;
  const days = daysInRange(f.from, f.to);
  const soFar = f.to === today;
  const showVat = !!f.vatFrom && f.vatFrom <= f.to;
  const vs = (pick: (x: FinanceTotals) => number) => versus(pick(t), p && pick(p), days);
  const shippingCostMinor = t.postageMinor + t.fulfilmentMinor + t.cancelledLabelMinor;

  const figures = [
    { label: soFar ? "Taken so far" : "Taken", value: gbp(t.takenMinor), note: vs((x) => x.takenMinor), highlight: true },
    { label: "Order value excl. delivery", value: gbp(t.goodsMinor), note: vs((x) => x.goodsMinor) },
    { label: "Delivery charged", value: gbp(t.deliveryMinor), note: vs((x) => x.deliveryMinor) },
    {
      label: "Postage paid",
      value: gbp(t.postageMinor + t.cancelledLabelMinor),
      note: vs((x) => x.postageMinor + x.cancelledLabelMinor),
    },
    { label: "Fulfilment", value: gbp(t.fulfilmentMinor), note: plural(t.packages, "package") },
    {
      label: "After shipping costs",
      value: signed(t.afterCostsMinor),
      note: vs((x) => x.afterCostsMinor),
      highlight: true,
    },
    { label: "Orders", value: String(t.orders), note: vs((x) => x.orders) },
    { label: "Average order", value: t.orders > 0 ? gbp(t.averageMinor) : "—", note: vs((x) => x.averageMinor) },
    {
      label: "Vials sold",
      value: String(t.vials),
      note: t.welcomeVials > 0 ? `Incl. ${t.welcomeVials} free welcome` : vs((x) => x.vials),
    },
    { label: "Discounts given", value: gbp(t.discountMinor), note: "Promotion codes, already off takings" },
  ];

  const points = f.buckets.map(chartPoint);
  const exportHref = (level: "period" | "order") => `/admin/finance/export?from=${f.from}&to=${f.to}&level=${level}`;
  const bucketHref = (b: Bucket) =>
    f.granularity === "day" ? `/admin/takings?date=${b.key}` : `/admin/finance?from=${b.from}&to=${b.to}`;
  const periodWord = f.granularity === "day" ? "Day" : f.granularity === "week" ? "Week" : "Month";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Sales</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-medium tracking-tight text-brand-deep">Finance</h1>
        <Link href="/admin/finance/costs" className="btn-secondary">
          Set costs
        </Link>
      </div>

      {/* Which days */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-medium text-brand-deep">
            {days === 1 ? shortDay(f.from) : `${shortDay(f.from)} to ${shortDay(f.to)}`}
            {soFar && <span className="ml-2 font-sans text-sm text-ink-soft">so far</span>}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
            {PRESETS.map((preset) => (
              <Link
                key={preset.id}
                href={`/admin/finance?range=${preset.id}`}
                className={range.preset === preset.id ? PILL_ON : PILL_OFF}
                aria-current={range.preset === preset.id ? "page" : undefined}
              >
                {preset.label}
              </Link>
            ))}
          </div>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="from" className="label">
              From
            </label>
            {/* Keyed so the fields follow the range when a preset changes it. */}
            <input key={`from-${f.from}`} id="from" name="from" type="date" defaultValue={f.from} max={today} required className="field" />
          </div>
          <div>
            <label htmlFor="to" className="label">
              To
            </label>
            <input key={`to-${f.to}`} id="to" name="to" type="date" defaultValue={f.to} max={today} required className="field" />
          </div>
          <button type="submit" className="btn-secondary">
            View
          </button>
        </form>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {figures.map((fig) => (
          <Stat key={fig.label} {...fig} />
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-sm text-ink-soft">
        Takings are what customers were charged — delivery included, discount codes taken off — on orders paid for
        between midnight and midnight, UK time. After shipping costs is takings less postage
        {showVat ? ", VAT" : ""} and the fulfilment fee. Product cost and card fees are not taken off, so it is not
        profit.
      </p>
      {showVat && f.vatFrom! > f.from && (
        <p className="mt-2 max-w-3xl text-sm text-ink-soft">
          VAT is taken off from {shortDay(f.vatFrom!)}, when the shop registered; days before that carry none.
        </p>
      )}

      <FinanceWarningsPanel warnings={f.warnings} serviceNames={f.serviceNames} />

      {/* Charts */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Takings</h2>
          <TakingsChart data={points} />
        </section>
        <section className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Delivery against what it cost</h2>
          <ShippingChart data={points} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-medium text-brand-deep">Where the money went</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Taken</dt>
              <dd className="tabular-nums">{gbp(t.takenMinor)}</dd>
            </div>
            {showVat && (
              <div className="flex justify-between gap-4 text-ink-soft">
                <dt>VAT in takings</dt>
                <dd className="tabular-nums">−{gbp(t.vatMinor)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 text-ink-soft">
              <dt>Postage</dt>
              <dd className="tabular-nums">−{gbp(t.postageMinor)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-ink-soft">
              <dt>Fulfilment, {plural(t.packages, "package")}</dt>
              <dd className="tabular-nums">−{gbp(t.fulfilmentMinor)}</dd>
            </div>
            {t.cancelledLabelMinor > 0 && (
              <div className="flex justify-between gap-4 text-ink-soft">
                <dt>Postage on cancelled orders</dt>
                <dd className="tabular-nums">−{gbp(t.cancelledLabelMinor)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold text-brand-deep">
              <dt>After shipping costs</dt>
              <dd className="tabular-nums">{signed(t.afterCostsMinor)}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-1 text-xs text-ink-soft">
            {t.takenMinor > 0 && (
              <li>
                Sending orders out took {pct(shippingCostMinor, t.takenMinor)} of takings. Delivery charges paid for{" "}
                {pct(t.deliveryMinor, shippingCostMinor)} of it.
              </li>
            )}
            {t.cancelledOrders > 0 && (
              <li>
                {plural(t.cancelledOrders, "order")} paid for and cancelled since ({gbp(t.cancelledMinor)}) not counted.
              </li>
            )}
          </ul>
        </section>

        <section className="card overflow-x-auto p-6 lg:col-span-3">
          <h2 className="font-display text-lg font-medium text-brand-deep">Delivery by option</h2>
          {f.delivery.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No orders on these days.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-2 pr-4 font-semibold">Delivery</th>
                  <th className="px-4 py-2 text-right font-semibold">Orders</th>
                  <th className="px-4 py-2 text-right font-semibold">Charged</th>
                  <th className="px-4 py-2 text-right font-semibold">Postage</th>
                  <th className="py-2 pl-4 text-right font-semibold">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {f.delivery.map((line) => {
                  const { name, detail } = describeDelivery(line);
                  return (
                    <tr key={`${line.option}:${line.priceMinor}`}>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{name}</span>
                        <span className="block text-xs text-ink-soft">
                          {[detail, line.priceMinor > 0 ? `${gbp(line.priceMinor)} each` : ""].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{line.orders}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{gbp(line.chargedMinor)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {gbp(line.postageMinor)}
                        {line.postageUnknown > 0 && (
                          <span className="block text-xs text-ink-soft">{line.postageUnknown} not known yet</span>
                        )}
                      </td>
                      <td
                        className={`py-2 pl-4 text-right font-medium tabular-nums ${
                          line.marginMinor < 0 ? "text-red-600" : "text-brand-deep"
                        }`}
                      >
                        {signed(line.marginMinor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            Difference is delivery charged less postage paid, before the fulfilment fee.
          </p>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Packs sold</h2>
          {f.packs.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No orders on these days.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-2 pr-4 font-semibold">Pack</th>
                  <th className="px-4 py-2 text-right font-semibold">Orders</th>
                  <th className="px-4 py-2 text-right font-semibold">Vials</th>
                  <th className="px-4 py-2 text-right font-semibold">Order value</th>
                  <th className="py-2 pl-4 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {f.packs.map((line) => (
                  <tr key={line.pack}>
                    <td className="py-2 pr-4 font-medium">{line.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{line.orders}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{line.vials}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{gbp(line.goodsMinor)}</td>
                    <td className="py-2 pl-4 text-right tabular-nums text-ink-soft">{pct(line.goodsMinor, t.goodsMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-ink-soft">Vials include free welcome vials sent with an order.</p>
        </section>

        <section className="card overflow-x-auto p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">New and returning customers</h2>
          {f.customers.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No orders on these days.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-2 pr-4 font-semibold">Customer</th>
                  <th className="px-4 py-2 text-right font-semibold">Orders</th>
                  <th className="px-4 py-2 text-right font-semibold">Taken</th>
                  <th className="py-2 pl-4 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {f.customers.map((line) => (
                  <tr key={line.kind}>
                    <td className="py-2 pr-4 font-medium">
                      {line.kind === "new" ? "First order" : line.kind === "returning" ? "Ordered before" : "No email recorded"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{line.orders}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{gbp(line.takenMinor)}</td>
                    <td className="py-2 pl-4 text-right tabular-nums text-ink-soft">{pct(line.orders, t.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-ink-soft">Matched by email address across every order the shop has sold.</p>
        </section>
      </div>

      {/* Day by day */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl font-medium text-brand-deep">
          {f.granularity === "day" ? "Day by day" : f.granularity === "week" ? "Week by week" : "Month by month"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <a href={exportHref("period")} className="btn-secondary">
            Export {periodWord.toLowerCase()}s (CSV)
          </a>
          <a href={exportHref("order")} className="btn-secondary">
            Export orders (CSV)
          </a>
        </div>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
              <th className={TH}>{periodWord}</th>
              <th className={`${TH} text-right`}>Orders</th>
              <th className={`${TH} text-right`}>Vials</th>
              <th className={`${TH} text-right`}>Order value</th>
              <th className={`${TH} text-right`}>Delivery</th>
              <th className={`${TH} text-right`}>Taken</th>
              {showVat && <th className={`${TH} text-right`}>VAT</th>}
              <th className={`${TH} text-right`}>Postage</th>
              <th className={`${TH} text-right`}>Fulfilment</th>
              <th className={`${TH} text-right`}>After costs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...f.buckets].reverse().map((b) => {
              const bt = b.totals;
              const empty = bt.orders === 0 && bt.cancelledLabelMinor === 0;
              return (
                <tr key={b.key} className={empty ? "text-ink-soft" : "hover:bg-brand-tint/40"}>
                  <td className="px-4 py-3">
                    <Link href={bucketHref(b)} className="font-medium text-brand hover:text-brand-deep">
                      {b.label}
                    </Link>
                  </td>
                  <td className={TD_MONEY}>{bt.orders}</td>
                  <td className={TD_MONEY}>{bt.vials}</td>
                  <td className={TD_MONEY}>{gbp(bt.goodsMinor)}</td>
                  <td className={TD_MONEY}>{gbp(bt.deliveryMinor)}</td>
                  <td className={`${TD_MONEY} font-medium`}>{gbp(bt.takenMinor)}</td>
                  {showVat && <td className={TD_MONEY}>{gbp(bt.vatMinor)}</td>}
                  <td className={TD_MONEY}>{gbp(bt.postageMinor + bt.cancelledLabelMinor)}</td>
                  <td className={TD_MONEY}>{gbp(bt.fulfilmentMinor)}</td>
                  <td className={`${TD_MONEY} font-medium ${bt.afterCostsMinor < 0 ? "text-red-600" : ""}`}>
                    {signed(bt.afterCostsMinor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-semibold text-brand-deep">
              <td className="px-4 py-3 text-xs uppercase tracking-wider text-ink-soft">Total</td>
              <td className={TD_MONEY}>{t.orders}</td>
              <td className={TD_MONEY}>{t.vials}</td>
              <td className={TD_MONEY}>{gbp(t.goodsMinor)}</td>
              <td className={TD_MONEY}>{gbp(t.deliveryMinor)}</td>
              <td className={TD_MONEY}>{gbp(t.takenMinor)}</td>
              {showVat && <td className={TD_MONEY}>{gbp(t.vatMinor)}</td>}
              <td className={TD_MONEY}>{gbp(t.postageMinor + t.cancelledLabelMinor)}</td>
              <td className={TD_MONEY}>{gbp(t.fulfilmentMinor)}</td>
              <td className={TD_MONEY}>{signed(t.afterCostsMinor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {t.cancelledLabelMinor > 0 && (
        <p className="mt-2 text-xs text-ink-soft">Postage includes labels still live on cancelled orders.</p>
      )}
    </div>
  );
}
