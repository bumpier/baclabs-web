import Link from "next/link";
import { PRODUCT, drawsPerVial } from "@/config/funnel";
import { TechnicalData } from "@/components/funnel/TechnicalData";

/**
 * The technical details, under the product photo as a Shopify product page
 * keeps them: the specification a buyer checks before paying, then the full
 * reference rows behind a disclosure. The hero's "See the specification"
 * button lands here.
 *
 * On a phone the buy section stacks photo, buy box, then this, so the
 * details never stand between the photo and the price.
 */
export function ProductSpecs() {
  return (
    <div id="specification" className="scroll-mt-24">
      <h2 id="spec-heading" className="text-xl">
        Specification
      </h2>
      <dl className="mt-4 divide-y divide-line border-y border-line">
        <SpecRow term="Composition">{PRODUCT.composition}</SpecRow>
        <SpecRow term="Format">
          Sealed multi-dose vial, <span className="tabular">{PRODUCT.size}</span>
        </SpecRow>
        <SpecRow term="Draws per vial">
          <span className="tabular">{drawsPerVial(1)}</span> at 1ml, or{" "}
          <span className="tabular">{drawsPerVial(2)}</span> at 2ml. How many you get depends entirely on the
          volume taken each time.
        </SpecRow>
        {PRODUCT.storage ? <SpecRow term="Storage">{PRODUCT.storage}</SpecRow> : null}
        {PRODUCT.shelfLifeAfterOpening ? (
          <SpecRow term="Once opened">{PRODUCT.shelfLifeAfterOpening}</SpecRow>
        ) : null}
      </dl>

      {/* The reference rows a laboratory buyer checks (CAS numbers, formula,
          appearance, hazard class). Closed by default; the rows are still
          in the HTML, so a search engine reads them either way. */}
      <details
        id="technical-data"
        className="group mt-6 scroll-mt-24 rounded-panel border border-line bg-surface open:border-brand/35"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
          <span className="text-base font-semibold text-ink">Full technical data</span>
          <span
            aria-hidden="true"
            className="shrink-0 transition-transform duration-200 group-open:rotate-45"
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1v14M1 8h14" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        <div className="border-t border-line">
          <TechnicalData />
        </div>
      </details>

      <p className="mt-5 text-sm text-ink-soft">
        <Link href="/quality-and-documentation" className="link">
          Quality and documentation
        </Link>{" "}
        &middot;{" "}
        <Link href="/bulk-bacteriostatic-water" className="link">
          Bulk and wholesale pricing
        </Link>
      </p>
    </div>
  );
}

function SpecRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[9.5rem_1fr] sm:gap-5">
      <dt className="text-sm font-semibold text-ink">{term}</dt>
      <dd className="text-base text-ink-soft">{children}</dd>
    </div>
  );
}
