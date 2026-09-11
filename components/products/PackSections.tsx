import Link from "next/link";
import {
  DELIVERY,
  MAX_QUANTITY,
  PRODUCT,
  VIAL_ML,
  drawsPerVial,
  formatMinor,
  formatMinorShort,
  perVialMinor,
} from "@/config/funnel";
import { FACTS } from "@/content/facts";
import { PACK_PAGES, bundleForPack, packByBundleId, packPath, type PackPage } from "@/config/products";
import {
  cheaperPerVialThan,
  fillTokens,
  formatPerMl,
  nextBetterValue,
  packLabel,
  type PackMetrics,
} from "@/lib/pack-metrics";

/**
 * The sections a pack page is built from.
 *
 * Each is a whole section with its own heading, so a variant in
 * app/(store)/products/[slug]/page.tsx composes a page by choosing sections
 * and their ORDER rather than by passing flags into one mega-component. That
 * is what lets the four variants be genuinely different page shapes: the
 * stock-up pages lead with the price ladder, the wholesale pages lead with
 * unit economics, and neither is the same page with a different heading.
 *
 * Nothing here types a figure. Everything arrives as PackMetrics, derived in
 * lib/pack-metrics.ts from config/funnel.ts.
 */

/** Visible breadcrumb. The JSON-LD equivalent is emitted by the page. */
export function PackCrumbs({ pack }: { pack: PackPage }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="link">
            Home
          </Link>
        </li>
        <li aria-hidden="true">&rsaquo;</li>
        <li>
          <Link href="/products" className="link">
            Pack sizes
          </Link>
        </li>
        <li aria-hidden="true">&rsaquo;</li>
        <li>
          <span className="text-ink">{pack.shortLabel}</span>
        </li>
      </ol>
    </nav>
  );
}

/**
 * The four figures that describe a pack: vials, total volume, draws and the
 * per-vial price. Rendered as a definition list rather than a card grid
 * because that is what it is.
 */
export function PackStats({ m }: { m: PackMetrics }) {
  const stats: { term: string; value: string; note?: string }[] = [
    {
      term: "Vials in the pack",
      value: `${m.vials}`,
      note: `Each sealed, ${PRODUCT.size}`,
    },
    {
      term: "Total volume",
      value: `${m.totalMl}ml`,
      note: `${m.vials} × ${VIAL_ML}ml`,
    },
    {
      term: "Draws across the pack",
      value: `${m.drawsAt1ml}`,
      note: `At 1ml each, or ${m.drawsAt2ml} at 2ml`,
    },
    {
      term: "Price per vial",
      value: formatMinor(m.perVialMinor),
      note: `${formatPerMl(m.perMlMinor)} per ml`,
    },
  ];

  return (
    <dl className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.term} className="bg-surface p-5">
          <dt className="text-sm text-ink-soft">{s.term}</dt>
          <dd className="tabular mt-1 font-display text-3xl font-bold text-ink">
            {s.value}
          </dd>
          {s.note ? <p className="mt-1 text-xs text-ink-soft">{s.note}</p> : null}
        </div>
      ))}
    </dl>
  );
}

/**
 * What this pack saves against buying the same vials one at a time.
 *
 * Renders NOTHING for the single tier: there is no saving to state, and a
 * "£0.00 saved" row would be a claim dressed as arithmetic.
 */
export function PackSaving({ m }: { m: PackMetrics }) {
  if (m.savingMinor <= 0) return null;

  return (
    <div className="surface-card p-6 sm:p-8">
      <h2 className="text-2xl sm:text-3xl">What this pack saves</h2>
      <p className="measure mt-3 text-ink-soft">
        Against buying {m.vials} vials one at a time, at today&rsquo;s single-vial
        price of {formatMinor(PRODUCT.unitPriceMinor)}.
      </p>
      <dl className="mt-6 grid gap-6 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-ink-soft">Bought singly</dt>
          <dd className="tabular mt-1 text-2xl font-semibold text-ink line-through decoration-line-strong">
            {formatMinor(m.singlesPriceMinor)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">This pack</dt>
          <dd className="tabular mt-1 text-2xl font-semibold text-ink">
            {formatMinor(m.priceMinor)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">You save</dt>
          <dd className="tabular mt-1 text-2xl font-semibold text-brand-deep">
            {formatMinor(m.savingMinor)}{" "}
            <span className="text-base font-normal text-ink-soft">
              ({m.savingPercent}%)
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The tiers that beat this one on per-vial price.
 *
 * THE HONESTY SECTION, and the reason several pack pages can say in prose
 * that a bigger pack is better value without an author having to remember it
 * after a re-price. Renders nothing when this pack is already the cheapest
 * per vial, so the best tier never carries an apologetic empty box.
 */
export function CheaperAlternatives({ m }: { m: PackMetrics }) {
  const cheaper = cheaperPerVialThan(m.bundle);
  if (cheaper.length === 0) return null;

  // The NEAREST better buy, not the absolute cheapest — see nextBetterValue.
  // Naming the 100-vial case to someone reading the 8-vial page would be an
  // upsell dressed as advice.
  const best = nextBetterValue(m.bundle);
  if (!best) return null;
  const bestPack = packByBundleId(best.id);
  if (!bestPack) return null;

  const perVialGap = m.perVialMinor - perVialMinor(best);

  return (
    <div className="rounded-panel border border-line bg-brand-tint/50 p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl">
        {cheaper.length === 1
          ? "One pack costs less per vial"
          : `${cheaper.length} packs cost less per vial`}
      </h2>
      <p className="measure mt-3 text-ink-soft">
        {/* "Buying 10 vials instead" rather than "the 10 vials pack": the
            short labels are already noun phrases, and bolting "pack" onto
            them reads as though it were written by a loop. */}
        Buying {bestPack.shortLabel.toLowerCase()} instead works out at{" "}
        <span className="tabular font-semibold text-ink">
          {formatMinor(perVialMinor(best))}
        </span>{" "}
        a vial against{" "}
        <span className="tabular font-semibold text-ink">
          {formatMinor(m.perVialMinor)}
        </span>{" "}
        here &mdash; {formatMinor(perVialGap)} less on every vial. If the exact
        number of vials is not fixed for you, that is the better buy, and we
        would rather say so than let you find out afterwards.
      </p>
      <p className="mt-5">
        <Link href={packPath(bestPack)} className="btn-quiet !w-auto !px-5">
          See {bestPack.shortLabel.toLowerCase()}
        </Link>
      </p>
    </div>
  );
}

/** The product specification. Identical facts on every pack — it is one product. */
export function PackSpec({ m }: { m: PackMetrics }) {
  const rows: { term: string; value: React.ReactNode }[] = [
    { term: "Composition", value: PRODUCT.composition },
    {
      term: "Format",
      value: (
        <>
          Sealed multi-dose vial, <span className="tabular">{PRODUCT.size}</span>
          {m.vials > 1 ? (
            <>
              . This pack contains <span className="tabular">{m.vials}</span> of
              them, <span className="tabular">{m.totalMl}ml</span> in total.
            </>
          ) : (
            "."
          )}
        </>
      ),
    },
    {
      term: "Draws per vial",
      value: (
        <>
          <span className="tabular">{drawsPerVial(1)}</span> at 1ml, or{" "}
          <span className="tabular">{drawsPerVial(2)}</span> at 2ml. How many you
          get depends entirely on the volume taken each time.
        </>
      ),
    },
    ...(PRODUCT.storage ? [{ term: "Storage", value: PRODUCT.storage }] : []),
    ...(PRODUCT.shelfLifeAfterOpening
      ? [{ term: "Once opened", value: PRODUCT.shelfLifeAfterOpening }]
      : []),
    { term: "Appearance", value: FACTS.appearance },
    { term: "Also sold as", value: FACTS.synonyms.join(", ") },
  ];

  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map((r) => (
        <div key={r.term} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
          <dt className="text-sm font-semibold text-ink">{r.term}</dt>
          <dd className="measure text-base text-ink-soft">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Delivery as it applies to THIS pack: whether one pack clears the free
 * threshold, and what is charged when it does not. Every figure is the one
 * Stripe is handed.
 */
export function PackDelivery({ m }: { m: PackMetrics }) {
  if (DELIVERY.mode === "unknown") {
    return (
      <p className="measure text-ink-soft">
        Delivery is calculated at checkout.
      </p>
    );
  }

  return (
    <p className="measure text-ink-soft">
      {m.shipsFree ? (
        <>
          A single {packLabel(m.bundle).toLowerCase()} order{" "}
          <span className="font-semibold text-ink">qualifies for free UK delivery</span>
          {DELIVERY.mode === "threshold" && DELIVERY.freeFromMinor !== null ? (
            <>
              , because it is at or above the{" "}
              {formatMinorShort(DELIVERY.freeFromMinor)} threshold
            </>
          ) : null}
          .
        </>
      ) : (
        <>
          One pack sits below the free-delivery threshold
          {DELIVERY.freeFromMinor !== null ? (
            <> of {formatMinorShort(DELIVERY.freeFromMinor)}</>
          ) : null}
          , so delivery is{" "}
          <span className="tabular font-semibold text-ink">
            {formatMinor(m.deliveryMinor)}
          </span>{" "}
          on an order of one. It is shown in full before you pay.
        </>
      )}
    </p>
  );
}

/** Unit economics, for the wholesale pages. The figures a purchase order quotes. */
export function PackUnitEconomics({ m }: { m: PackMetrics }) {
  const rows = [
    { term: "Pack price", value: formatMinor(m.priceMinor) },
    { term: "Unit price per vial", value: formatMinor(m.perVialMinor) },
    { term: "Price per millilitre", value: formatPerMl(m.perMlMinor) },
    { term: "Vials per pack", value: `${m.vials}` },
    { term: "Volume per pack", value: `${m.totalMl}ml` },
    {
      term: "Maximum per order",
      value: `${m.maxOrderVials} vials (${MAX_QUANTITY} packs)`,
    },
  ];

  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map((r) => (
        <div key={r.term} className="flex items-baseline justify-between gap-6 py-4">
          <dt className="text-sm text-ink-soft">{r.term}</dt>
          <dd className="tabular text-base font-semibold text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Cards for the packs this page points at. */
export function RelatedPacks({ pack }: { pack: PackPage }) {
  const related = pack.related
    .map((id) => PACK_PAGES.find((p) => p.bundleId === id))
    .filter((p): p is PackPage => p !== undefined);

  if (related.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {related.map((p) => {
        const b = bundleForPack(p);
        return (
          <li key={p.slug}>
            <Link
              href={packPath(p)}
              className="block h-full rounded-panel border border-line bg-surface p-6 transition-colors duration-150 hover:border-brand/40"
              style={{ transitionTimingFunction: "var(--ease-out)" }}
            >
              <p className="text-lg font-semibold text-ink">{p.shortLabel}</p>
              <p className="tabular mt-1 text-ink">
                {formatMinor(b.priceMinor)}{" "}
                <span className="text-sm font-normal text-ink-soft">
                  &middot; {formatMinor(perVialMinor(b))} per vial
                </span>
              </p>
              <p className="mt-3 text-sm text-ink-soft">{p.audience}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Questions about THIS pack size.
 *
 * Rendered as a visible definition list and deliberately WITHOUT FAQPage
 * structured data. The home page already carries the site's one FAQPage
 * entity; eight more, one per pack, would be eight competing FAQ entities for
 * a shop with one FAQ. The value here is the visible, unique wording — which
 * is also what stops two adjacent pack sizes reading as the same document.
 */
export function PackFaqs({ pack, m }: { pack: PackPage; m: PackMetrics }) {
  if (pack.faqs.length === 0) return null;

  return (
    <dl className="divide-y divide-line border-y border-line">
      {pack.faqs.map((f) => (
        <div key={f.q} className="py-6">
          <dt className="text-lg font-semibold text-ink">{fillTokens(f.q, m)}</dt>
          <dd className="measure mt-2 text-base text-ink-soft">
            {fillTokens(f.a, m)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
