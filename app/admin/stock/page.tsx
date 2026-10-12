import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import { shopDayKey } from "@/lib/saleTime";
import { LOW_STOCK_VIALS, RATE_DAYS, listVialDeliveries, loadVialStock } from "@/lib/vial-stock";
import { ActionForm } from "@/components/admin/ActionForm";
import { LowStockWarning } from "@/components/admin/LowStockWarning";
import { plural, shortDay } from "@/components/admin/finance/parts";
import { addVialDeliveryAction, deleteVialDeliveryAction } from "./actions";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-GB");
const signed = (v: number) => (v > 0 ? `+${n(v)}` : `−${n(-v)}`);
const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export default async function AdminVialStockPage() {
  await requireAdminRole("ADMIN");
  const today = shopDayKey(new Date());
  const [stock, deliveries] = await Promise.all([loadVialStock(), listVialDeliveries()]);
  const packOrders = stock.packs.reduce((sum, p) => sum + p.orders, 0);
  const recentPackOrders = stock.packs.reduce((sum, p) => sum + p.recentOrders, 0);

  const figures = stock.since
    ? [
        { label: "Left", value: n(stock.left), alert: stock.low },
        { label: `Received since ${shortDay(stock.since)}`, value: n(stock.received), alert: false },
        { label: "Sent out", value: n(stock.sent), alert: false },
        {
          label: `A day, last ${RATE_DAYS} days`,
          value: stock.perDay > 0 ? `≈ ${Math.round(stock.perDay)}` : "0",
          note: stock.daysLeft !== null ? `What is left lasts about ${plural(stock.daysLeft, "day")}` : undefined,
          alert: false,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Warehouse</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Vial stock</h1>
      <p className="mt-4 max-w-3xl text-sm text-ink-soft">
        How many vials are left at fulfilment: everything booked in below, less every vial on an order paid since the
        first day booked in. Free welcome vials and plan boxes count; cancelled orders don&apos;t. You&apos;re warned on
        the dashboard at {LOW_STOCK_VIALS} or fewer. The checkout&apos;s own counter on{" "}
        <Link href="/admin/products" className="link">
          Products
        </Link>{" "}
        is separate and isn&apos;t changed here.
      </p>

      <LowStockWarning stock={stock} showLink={false} />

      {figures.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label} className={`card p-5 ${f.alert ? "border-amber-300 bg-amber-50" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{f.label}</p>
              <p className="mt-2 font-display text-3xl font-medium text-brand-deep">{f.value}</p>
              {f.note ? <p className="mt-1 text-xs text-ink-soft">{f.note}</p> : null}
            </div>
          ))}
        </div>
      )}

      <section className="card mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Book in a delivery</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Use a minus number to correct the count after a stock-take or breakages, e.g. −12.
        </p>
        <ActionForm
          action={addVialDeliveryAction}
          submitLabel="Book in"
          submitClassName="btn-primary"
          className="mt-5 flex flex-wrap items-end gap-3"
        >
          <div>
            <label htmlFor="vial-count" className="label">
              Vials
            </label>
            <input id="vial-count" name="vials" inputMode="numeric" placeholder="1000" required className="field w-28" />
          </div>
          <div>
            <label htmlFor="vial-day" className="label">
              Arrived on
            </label>
            <input id="vial-day" name="day" type="date" defaultValue={today} max={today} required className="field" />
          </div>
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="vial-note" className="label">
              Note (optional)
            </label>
            <input id="vial-note" name="note" maxLength={200} placeholder="Supplier, delivery note…" className="field w-full" />
          </div>
        </ActionForm>

        {deliveries.length > 0 && (
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="py-2 font-semibold">Day</th>
                <th className="py-2 text-right font-semibold">Vials</th>
                <th className="py-2 pl-6 font-semibold">Note</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="py-2">{shortDay(d.receivedOn)}</td>
                  <td className={`py-2 text-right tabular-nums ${d.vials < 0 ? "text-red-700" : ""}`}>{signed(d.vials)}</td>
                  <td className="py-2 pl-6 text-ink-soft">{d.note}</td>
                  <td className="py-2 text-right">
                    <ActionForm
                      action={deleteVialDeliveryAction}
                      submitLabel="Remove"
                      className="flex items-center justify-end gap-2"
                      submitClassName="text-xs font-semibold text-red-600 hover:text-red-700"
                      confirm={`Remove ${signed(d.vials)} vials on ${shortDay(d.receivedOn)}? The count changes straight away.`}
                    >
                      <input type="hidden" name="id" value={d.id} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {stock.packs.length > 0 && (
        <section className="card mt-4 p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Packs bought</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Each order counted once, by the pack it bought, since {shortDay(stock.since!)}. A plan&apos;s later boxes
            aren&apos;t counted; its first order is.
          </p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="py-2 font-semibold">Pack</th>
                <th className="py-2 pl-4 text-right font-semibold">Orders</th>
                <th className="py-2 pl-4 text-right font-semibold">Last {RATE_DAYS} days</th>
                <th className="py-2 pl-4 text-right font-semibold">Vials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stock.packs.map((p, i) => (
                <tr key={p.pack}>
                  <td className="py-2">
                    {p.label}
                    {i === 0 && <span className="ml-2 text-xs font-semibold text-brand">Most popular</span>}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {n(p.orders)} <span className="text-ink-soft">· {share(p.orders, packOrders)}</span>
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {n(p.recentOrders)} <span className="text-ink-soft">· {share(p.recentOrders, recentPackOrders)}</span>
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">{n(p.vials)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {stock.byWeek.length > 0 && (
        <section className="card mt-4 p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Sent out, week by week</h2>
          <p className="mt-1 text-sm text-ink-soft">By the day each order was paid. Weeks start on Monday.</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="py-2 font-semibold">Week of</th>
                <th className="py-2 text-right font-semibold">Orders</th>
                <th className="py-2 text-right font-semibold">Vials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stock.byWeek.map((w) => (
                <tr key={w.week}>
                  <td className="py-2">{shortDay(w.week)}</td>
                  <td className="py-2 text-right tabular-nums">{n(w.orders)}</td>
                  <td className="py-2 text-right tabular-nums">{n(w.vials)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
