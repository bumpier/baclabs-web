import Link from "next/link";
import { requireAdminRole } from "@/lib/adminAuth";
import { firstSaleDay, loadFinance } from "@/lib/finance/query";
import { EXPORT_RANGES, exportRange, parseExportRange, type ExportRangeId } from "@/lib/finance/range";
import { daysInRange, shopDayKey } from "@/lib/saleTime";
import { gbp, plural, shortDay } from "@/components/admin/finance/parts";

export const dynamic = "force-dynamic";

const PILL = "rounded-full border px-4 py-1.5 transition-colors";
const PILL_OFF = `${PILL} border-line bg-white text-ink-soft hover:border-brand`;
const PILL_ON = `${PILL} border-brand bg-brand-tint text-brand-deep`;

/**
 * The shop's sales as a spreadsheet, for a fixed range: the last 7 days, 30
 * days, year or all time. The files come from /admin/finance/export, so they
 * match the Finance page figure for figure.
 */
export default async function AdminExportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdminRole("ADMIN");

  const id: ExportRangeId = parseExportRange((await searchParams).range) ?? "30d";
  const today = shopDayKey(new Date());
  const range = exportRange(id, today, id === "all" ? await firstSaleDay() : null);
  const f = await loadFinance(range.from, range.to, { compare: false });
  const t = f.totals;
  const days = daysInRange(f.from, f.to);
  const period = f.granularity;
  const periodly = period === "day" ? "Daily" : period === "week" ? "Weekly" : "Monthly";
  const fileHref = (level: "order" | "period") => `/admin/finance/export?range=${id}&level=${level}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Sales</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Export</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Download sales as a CSV file, which opens in Excel, Numbers or Google Sheets.
      </p>

      <div className="mt-8 flex flex-wrap gap-2 text-sm font-medium">
        {EXPORT_RANGES.map((r) => (
          <Link
            key={r.id}
            href={`/admin/export?range=${r.id}`}
            className={id === r.id ? PILL_ON : PILL_OFF}
            aria-current={id === r.id ? "page" : undefined}
          >
            {r.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {days === 1 ? shortDay(f.from) : `${shortDay(f.from)} to ${shortDay(f.to)}`}
        {id === "all" && t.orders > 0 && ", from the first sale"} · {plural(t.orders, "order")} ·{" "}
        {gbp(t.takenMinor)} taken
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-xl font-medium text-brand-deep">Orders</h2>
          <p className="mt-2 text-sm text-ink-soft">
            One row per order: when it was paid, the customer, pack, delivery, what was taken, VAT,
            postage and fulfilment. Includes paid orders cancelled later, with their status.
          </p>
          <p className="mt-3 text-sm font-medium">{plural(f.rows.length, "row")}</p>
          <a href={fileHref("order")} className="btn-primary mt-5">
            Download orders (CSV)
          </a>
        </section>
        <section className="card p-6">
          <h2 className="font-display text-xl font-medium text-brand-deep">{periodly} totals</h2>
          <p className="mt-2 text-sm text-ink-soft">
            One row per {period}: orders, vials, takings, discounts, VAT and shipping costs, the same
            figures as the Finance page.
          </p>
          <p className="mt-3 text-sm font-medium">{plural(f.buckets.length, "row")}</p>
          <a href={fileHref("period")} className="btn-secondary mt-5">
            Download {periodly.toLowerCase()} totals (CSV)
          </a>
        </section>
      </div>
    </div>
  );
}
