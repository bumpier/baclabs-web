import { BUNDLES, PRICE_MATCH_BADGE, PRODUCT, formatMinor, perMlMinor } from "@/config/funnel";

/**
 * Objective attributes only, and no named competitors.
 *
 * The "typical alternative" column says "varies" wherever a specific claim
 * could not be evidenced. That makes the table less punchy and more honest —
 * a comparison table that invents a competitor's weaknesses is a
 * misleading-comparison problem, not a marketing one.
 */
const ROWS: { attribute: string; ours: string; theirs: string }[] = [
  {
    attribute: "Fill volume",
    ours: PRODUCT.size,
    theirs: "Varies by supplier — 10ml and 30ml are both common",
  },
  {
    attribute: "Preservative",
    ours: "0.9% benzyl alcohol",
    theirs: "None in plain sterile water",
  },
  {
    attribute: "Vial format",
    ours: "Sealed multi-dose vial",
    theirs: "Single-use ampoule or multi-dose vial",
  },
];

export function ComparisonTable() {
  const cheapest = BUNDLES.reduce((a, b) => (perMlMinor(b) < perMlMinor(a) ? b : a));
  const single = BUNDLES.find((b) => b.vials === 1) ?? BUNDLES[0];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">
          Attributes of this product compared with typical alternatives
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border-y border-line py-3 pr-4 font-medium text-ink-soft">
              Attribute
            </th>
            <th
              scope="col"
              className="rounded-t-panel border-x border-t border-brand/20 bg-brand-tint px-4 py-3 font-semibold text-ink"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              This product
            </th>
            <th scope="col" className="border-y border-line py-3 font-medium text-ink-soft">
              Typical alternative
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.attribute} className="align-top">
              <th scope="row" className="border-b border-line py-3 pr-4 font-medium text-ink-soft">
                {r.attribute}
              </th>
              <td
                className="border-x border-brand/20 bg-brand-tint px-4 py-3 text-ink"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                {r.ours}
              </td>
              <td className="border-b border-line py-3 text-ink-soft">{r.theirs}</td>
            </tr>
          ))}
          <tr className="align-top">
            <th scope="row" className="border-b border-line py-3 pr-4 font-medium text-ink-soft">
              Price per ml
            </th>
            <td
              className="rounded-b-panel border-x border-b border-brand/20 bg-brand-tint px-4 py-3 text-ink"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <span className="tabular">{formatMinor(Math.round(perMlMinor(single)))}</span> for one
              vial, down to{" "}
              <span className="tabular">{formatMinor(Math.round(perMlMinor(cheapest)))}</span> at{" "}
              <span className="tabular">{cheapest.vials}</span> vials
            </td>
            <td className="border-b border-line py-3 text-ink-soft">Varies</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-soft">
        &ldquo;Typical alternative&rdquo; describes the category generally. We do not compare
        against named sellers, and we do not make claims about other suppliers&rsquo; products.
      </p>
      <p className="mt-2 text-xs text-ink-soft">
        Found it cheaper from another UK seller? We&rsquo;ll match it &mdash; see our{" "}
        <a href="#guarantee" className="link">
          {PRICE_MATCH_BADGE.toLowerCase()}
        </a>
        .
      </p>
    </div>
  );
}
