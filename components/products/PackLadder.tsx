import Link from "next/link";
import {
  formatMinor,
  perMlMinor,
  perVialMinor,
  savingPercent,
  type BundleId,
} from "@/config/funnel";
import { PACK_PAGES, bundleForPack, packPath } from "@/config/products";
import { cheapestPerVialBundle, formatPerMl, laddered } from "@/lib/pack-metrics";

/**
 * Every tier on one table, each row linking to its own pack page.
 *
 * This is the component that makes the separate pages behave like one
 * product rather than a set of orphans: every pack page carries it, so all
 * of the URLs are one click from each other and from the index. It is also the
 * honesty device the copy depends on — the 8-vial page promises in prose that
 * a larger pack is cheaper per vial, and this table is where that is proved.
 *
 * `current` marks the row the reader is already on. That row is NOT a link:
 * a link to the page you are on is noise for a reader and a self-referencing
 * internal link for a crawler.
 */
export function PackLadder({
  current,
  caption,
}: {
  current?: BundleId;
  caption?: string;
}) {
  const cheapest = cheapestPerVialBundle();

  // Ladder order, but rendered from the pack registry so a tier with no page
  // cannot appear here as an unclickable row.
  const rows = laddered()
    .map((b) => PACK_PAGES.find((p) => p.bundleId === b.id))
    .filter((p): p is (typeof PACK_PAGES)[number] => p !== undefined);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        {caption ? (
          <caption className="pb-4 text-left text-sm text-ink-soft">{caption}</caption>
        ) : null}
        <thead>
          <tr className="border-b border-line-strong/50">
            <th scope="col" className="py-3 pr-4 font-semibold text-ink">
              Pack
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-semibold text-ink">
              Price
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-semibold text-ink">
              Per vial
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-semibold text-ink">
              Per ml
            </th>
            <th scope="col" className="py-3 text-right font-semibold text-ink">
              Saving
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((p) => {
            const b = bundleForPack(p);
            const isCurrent = b.id === current;
            const isCheapest = b.id === cheapest.id;
            const saving = savingPercent(b);

            return (
              <tr
                key={p.slug}
                className={isCurrent ? "bg-brand-tint/60" : undefined}
                aria-current={isCurrent ? "true" : undefined}
              >
                <th scope="row" className="py-3 pr-4 font-normal">
                  {isCurrent ? (
                    <span className="font-semibold text-ink">
                      {p.shortLabel}{" "}
                      <span className="text-xs font-normal text-ink-soft">
                        (this page)
                      </span>
                    </span>
                  ) : (
                    <Link href={packPath(p)} className="link font-medium">
                      {p.shortLabel}
                    </Link>
                  )}
                  {isCheapest ? (
                    <span className="mt-0.5 block text-xs text-brand-deep">
                      Best value per vial
                    </span>
                  ) : null}
                </th>
                <td className="tabular py-3 pr-4 text-right text-ink">
                  {formatMinor(b.priceMinor)}
                </td>
                <td className="tabular py-3 pr-4 text-right text-ink">
                  {formatMinor(perVialMinor(b))}
                </td>
                <td className="tabular py-3 pr-4 text-right text-ink-soft">
                  {formatPerMl(perMlMinor(b))}
                </td>
                <td className="tabular py-3 text-right text-ink-soft">
                  {/* The single tier has nothing to save against — an em dash
                      rather than a misleading "0%". */}
                  {saving > 0 ? `${saving}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
