import Link from "next/link";
import { formatMinor, perVialMinor, savingPercent } from "@/config/funnel";
import { PACK_PAGES, bundleForPack, packPath } from "@/config/products";
import { cheapestPerVialBundle } from "@/lib/pack-metrics";

/**
 * Every pack as a card, each linking to its own page.
 *
 * Shared by the /products hub and the home page, so the two cannot disagree
 * about what is on sale or what it costs. On the home page this is what sits
 * at #buy: the storefront's buy step is now CHOOSING A PACK, and the choosing
 * happens by following a link to the page that sells it.
 *
 * `audience` comes from the registry and differs per pack, so the grid reads
 * as eight different answers rather than eight prices.
 */
export function PackGrid({
  heading,
  columns = 4,
}: {
  /** Call-to-action wording on each card. */
  heading?: string;
  /** Columns at `lg`. The hub gives the cards more room than the home page. */
  columns?: 3 | 4;
}) {
  const cheapest = cheapestPerVialBundle();

  return (
    <ul
      className={[
        "grid gap-4 sm:grid-cols-2",
        // Written out rather than interpolated: Tailwind scans source text
        // for whole class names, so `lg:grid-cols-${n}` would never be built.
        columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      ].join(" ")}
    >
      {PACK_PAGES.map((p) => {
        const b = bundleForPack(p);
        const saving = savingPercent(b);
        const isCheapest = b.id === cheapest.id;

        return (
          <li key={p.slug}>
            <Link
              href={packPath(p)}
              className="flex h-full flex-col rounded-panel border border-line bg-surface p-5 transition-colors duration-150 hover:border-brand/40"
              style={{ transitionTimingFunction: "var(--ease-out)" }}
              aria-label={`${p.shortLabel}, ${formatMinor(b.priceMinor)}`}
            >
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-lg font-bold text-ink">
                  {p.shortLabel}
                </span>
                {isCheapest ? (
                  <span className="text-xs font-semibold text-brand-deep">
                    Best per vial
                  </span>
                ) : b.label ? (
                  <span className="text-xs font-semibold text-ink-soft">{b.label}</span>
                ) : null}
              </p>
              <p className="tabular mt-2 text-xl font-semibold text-ink">
                {formatMinor(b.priceMinor)}
              </p>
              <p className="tabular mt-0.5 text-sm text-ink-soft">
                {formatMinor(perVialMinor(b))} per vial
                {saving > 0 ? ` · saves ${saving}%` : ""}
              </p>
              <p className="mt-3 flex-1 text-sm text-ink-soft">{p.audience}</p>
              <p className="mt-4 text-sm font-medium text-brand-deep">
                {heading ?? "View pack"} &rarr;
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
