import {
  BUNDLES,
  PRODUCT,
  SALE,
  referenceUnitPriceMinor,
  saleLabel,
  saleVisible,
  VIAL_ML,
  bundleById,
  drawsPerVial,
  formatMinor,
  perMlMinor,
} from "@/config/funnel";
import { VialImage } from "@/components/funnel/VialImage";
import { HERO_CTA_ID } from "@/lib/use-hero-cta-passed";

/**
 * The landing hero.
 *
 * This sits ABOVE the product section so the page opens on the thing being
 * sold rather than on a price ladder. Everything in it is a fact already
 * held in config/funnel.ts — the fill volume, the preservative percentage,
 * the price, the price per millilitre, the draw count. There is no rating,
 * no customer logo and no engagement figure, because none exists; see
 * lib/reviews.ts for why inventing them is not an option.
 *
 * The load sequence is the page's ONE piece of non-user-triggered motion:
 * a short staggered rise, ~380ms end to end. Nothing else on the page
 * animates on its own, and `prefers-reduced-motion` collapses this to a
 * plain fade with no travel (see app/globals.css).
 */

const PRICE = formatMinor(PRODUCT.unitPriceMinor);

/** Facts pinned around the vial. Each is verifiable from the product itself. */
const SPEC_CHIPS = [
  `${VIAL_ML}ml fill`,
  "0.9% benzyl alcohol",
  "Sealed multi-dose vial",
];

/** Things that are true today. Dispatch is absent until it is confirmed. */
const TRUST = [
  "Secure checkout by Stripe",
  "Sealed, tamper-evident vial",
  "Sold as a laboratory and research diluent",
];

export function Hero() {
  const single = bundleById("single") ?? BUNDLES[0];
  // The cheapest per-ml tier, computed rather than assumed, so re-pricing a
  // bundle in config can never leave this line stating the wrong figure.
  const cheapest = BUNDLES.reduce((a, b) => (perMlMinor(b) < perMlMinor(a) ? b : a));

  const sale = saleVisible();
  const perMlSingle = formatMinor(Math.round(perMlMinor(single)));
  const perMlBest = formatMinor(Math.round(perMlMinor(cheapest)));

  return (
    <section className="relative overflow-hidden bg-paper" aria-labelledby="hero-heading">
      {/* Graph paper. It gives the hero structure without spending a
          colour on it, and reads as measurement — which is what this
          product is sold by. */}
      <div
        aria-hidden="true"
        className="bg-grid bg-grid-fade pointer-events-none absolute inset-0"
      />

      <div className="shell-wide relative py-14 sm:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* ── Left: the pitch ─────────────────────────────────── */}
          <div className="lg:col-span-7">
            <h1
              id="hero-heading"
              className="animate-rise stagger-1 text-4xl sm:text-5xl lg:text-6xl"
            >
              Bacteriostatic water, sealed at ten millilitres.
            </h1>

            <p className="animate-rise stagger-3 measure mt-6 text-lg text-ink-soft">
              Sterile water with 0.9% benzyl alcohol as a bacteriostatic preservative. A sealed
              multi-dose vial &mdash; <span className="tabular">{drawsPerVial(1)}</span> draws at
              1ml, or <span className="tabular">{drawsPerVial(2)}</span> at 2ml.
            </p>

            {/* Price, stated plainly before any button asks for a decision. */}
            <div className="animate-rise stagger-3 mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="font-display text-3xl font-bold text-ink">{PRICE}</p>
              {sale ? (
                <p className="flex items-baseline gap-2">
                  <span className="tabular text-base text-ink-soft line-through">
                    {formatMinor(referenceUnitPriceMinor())}
                  </span>
                  <span className="rounded-control bg-cta-tint px-2 py-0.5 text-sm font-semibold text-cta-deep">
                    {saleLabel()}
                  </span>
                </p>
              ) : null}
              <p className="text-base text-ink-soft">
                a vial &middot; <span className="tabular">{perMlSingle}</span> per ml, down to{" "}
                <span className="tabular">{perMlBest}</span> in a{" "}
                <span className="tabular">{cheapest.vials}</span>-pack
              </p>
            </div>

            <div className="animate-rise stagger-4 mt-8 flex flex-col gap-3 sm:flex-row">
              <a id={HERO_CTA_ID} href="#buy" className="btn-cta sm:w-auto">
                Buy now &mdash; {PRICE}
              </a>
              <a href="#product" className="btn-quiet">
                See the specification
              </a>
            </div>

            <ul className="animate-rise stagger-5 mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm text-ink-soft">
                  <CheckMark />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Right: the product, with its facts pinned to it ──── */}
          <div className="animate-drift-in stagger-2 lg:col-span-5">
            <div className="relative mx-auto max-w-sm lg:max-w-none">
              <div className="surface-card relative p-6 sm:p-8">
                <VialImage priority />
              </div>

              {/* Floating spec chips. Positioned only from `sm` up — on a
                  phone they stack underneath, where they are readable
                  instead of overlapping the product. */}
              <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:hidden">
                {SPEC_CHIPS.map((c) => (
                  <li key={c} className="chip text-xs">
                    {c}
                  </li>
                ))}
              </ul>

              <div aria-hidden="true" className="hidden sm:block">
                <span className="chip animate-drift-in stagger-3 absolute -left-4 top-12 shadow-lift">
                  {SPEC_CHIPS[0]}
                </span>
                <span className="chip animate-drift-in stagger-4 absolute -right-2 top-1/2 shadow-lift">
                  {SPEC_CHIPS[1]}
                </span>
                <span className="chip animate-drift-in stagger-5 absolute -left-2 bottom-14 shadow-lift">
                  {SPEC_CHIPS[2]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── The three figures that decide the purchase ──────────
            Real measurements, not engagement metrics. Each card gets its
            own ground so the row reads as three facts rather than one
            repeated card. */}
        <ul className="mt-16 grid gap-4 sm:grid-cols-3 lg:mt-20">
          <StatCard figure={`${VIAL_ML}ml`} label="Fill volume per sealed vial" />
          <StatCard figure="0.9%" label="Benzyl alcohol, the preservative" />
          <StatCard
            figure={perMlBest}
            label={`Per ml at ${cheapest.vials} vials, from ${perMlSingle} at one`}
          />
        </ul>
      </div>
    </section>
  );
}

function StatCard({ figure, label }: { figure: string; label: string }) {
  return (
    <li className="surface-card px-6 py-7">
      <p className="font-display text-4xl font-bold text-ink sm:text-5xl">{figure}</p>
      <p className="mt-2 text-sm text-ink-soft">{label}</p>
    </li>
  );
}

function CheckMark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3 8.5 6.2 11.6 13 4.8"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
