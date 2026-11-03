import Link from "next/link";
import type { BrandTotals, FinanceTotals } from "@/lib/finance/ledger";
import { brandChip } from "@/lib/admin/brand-chip";
import { BrandChip } from "@/components/admin/BrandChip";
import { gbp } from "@/components/admin/finance/parts";

const TH = "px-4 py-3 font-semibold";
const TD = "px-4 py-3 text-right tabular-nums";
const signed = (minor: number) => (minor < 0 ? `−${gbp(-minor)}` : gbp(minor));

/**
 * The same figures brand by brand, with the all-brands total under them, for
 * the finance pages while every brand is in scope (loadFinance().brands).
 * Each brand links to its own view of the page (`hrefFor`).
 */
export function BrandBreakdown({
  brands,
  total,
  hrefFor,
  className = "",
}: {
  brands: readonly BrandTotals[];
  total: FinanceTotals;
  hrefFor: (brandId: string) => string;
  className?: string;
}) {
  if (brands.length === 0) return null;
  return (
    <section className={className}>
      <h2 className="font-display text-xl font-medium text-brand-deep">By brand</h2>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
              <th className={TH}>Brand</th>
              <th className={`${TH} text-right`}>Orders</th>
              <th className={`${TH} text-right`}>Order value</th>
              <th className={`${TH} text-right`}>Delivery</th>
              <th className={`${TH} text-right`}>Taken</th>
              <th className={`${TH} text-right`}>Postage</th>
              <th className={`${TH} text-right`}>Fulfilment</th>
              <th className={`${TH} text-right`}>After costs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {brands.map(({ brand, totals: t }) => {
              const chip = brandChip(brand);
              return (
                <tr key={brand} className="hover:bg-brand-tint/40">
                  <td className="px-4 py-3">
                    <Link href={hrefFor(brand)} className="flex items-center gap-2 font-medium text-brand hover:text-brand-deep">
                      <BrandChip chip={chip} />
                      <span aria-hidden="true">{chip.name}</span>
                    </Link>
                  </td>
                  <td className={TD}>{t.orders}</td>
                  <td className={TD}>{gbp(t.goodsMinor)}</td>
                  <td className={TD}>{gbp(t.deliveryMinor)}</td>
                  <td className={`${TD} font-medium`}>{gbp(t.takenMinor)}</td>
                  <td className={TD}>{gbp(t.postageMinor + t.cancelledLabelMinor)}</td>
                  <td className={TD}>{gbp(t.fulfilmentMinor)}</td>
                  <td className={`${TD} font-medium ${t.afterCostsMinor < 0 ? "text-red-600" : ""}`}>
                    {signed(t.afterCostsMinor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line font-semibold text-brand-deep">
              <td className="px-4 py-3 text-xs uppercase tracking-wider text-ink-soft">All brands</td>
              <td className={TD}>{total.orders}</td>
              <td className={TD}>{gbp(total.goodsMinor)}</td>
              <td className={TD}>{gbp(total.deliveryMinor)}</td>
              <td className={TD}>{gbp(total.takenMinor)}</td>
              <td className={TD}>{gbp(total.postageMinor + total.cancelledLabelMinor)}</td>
              <td className={TD}>{gbp(total.fulfilmentMinor)}</td>
              <td className={TD}>{signed(total.afterCostsMinor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
