import Link from "next/link";
import { GUIDES } from "@/content/guides";

/**
 * Links from the product page into the guides, so the hub has a hub. Reads
 * the guide registry, so a new guide appears here without a second edit.
 */
export function LearnStrip() {
  return (
    <section className="section pt-0" aria-labelledby="learn-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <h2 id="learn-heading" className="text-3xl sm:text-4xl">
            Learn
          </h2>
          <p className="measure mt-4 text-base text-ink-soft">
            What bacteriostatic water is, how it differs from sterile water, how long it lasts and
            how to store it. Plain answers, no sales copy.
          </p>
          <p className="mt-4">
            <Link href="/guides" className="link">
              All guides and reference pages
            </Link>
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="block h-full rounded-panel border border-line bg-surface p-5 transition-colors duration-150 hover:border-brand/40"
              >
                <span className="block text-base font-semibold text-ink">{g.title}</span>
                <span className="mt-1 block text-sm text-ink-soft">{g.description}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/calculator"
              className="block h-full rounded-panel border border-line bg-surface p-5 transition-colors duration-150 hover:border-brand/40"
            >
              <span className="block text-base font-semibold text-ink">Dilution calculator</span>
              <span className="mt-1 block text-sm text-ink-soft">
                Concentration from a vial&rsquo;s contents and the volume of diluent added.
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/safety-data-sheet"
              className="block h-full rounded-panel border border-line bg-surface p-5 transition-colors duration-150 hover:border-brand/40"
            >
              <span className="block text-base font-semibold text-ink">Safety data sheet</span>
              <span className="mt-1 block text-sm text-ink-soft">
                All sixteen sections for sterile water with 0.9% benzyl alcohol.
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
