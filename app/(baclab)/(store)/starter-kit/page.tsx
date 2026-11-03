import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STARTER_KIT, labKitEnabled } from "@/config/funnel";
import { STARTER_KIT_COPY as COPY } from "@/content/starter-kit";
import { pageMetadata } from "@/lib/seo";
import { VialImage } from "@/components/funnel/VialImage";
import { StarterKitBuy } from "@/components/products/StarterKitBuy";

/**
 * The Starter Kit's landing page (28 Oct 2026): one vial and one Lab Kit for
 * £9.99 (config/funnel.ts STARTER_KIT), and what is in the box. The copy is
 * in content/starter-kit.ts, where the content rules can read it.
 *
 * Not found while the Lab Kit is switched off (labKitEnabled), like every
 * other empty config: a page for a kit the checkout would refuse sells
 * nothing. Static, so the switch takes effect on the next build.
 */
export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  if (!labKitEnabled()) return {};
  return pageMetadata({
    title: COPY.metaTitle,
    description: COPY.metaDescription,
    path: STARTER_KIT.path,
  });
}

export default function StarterKitPage() {
  if (!labKitEnabled()) notFound();

  return (
    <>
      <section className="section pb-0" aria-labelledby="starter-heading">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="min-w-0 lg:col-span-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-deep">{COPY.eyebrow}</p>
            <h1 id="starter-heading" className="mt-3 text-4xl sm:text-5xl">
              {COPY.h1}
            </h1>
            <p className="measure mt-5 text-lg text-ink-soft">{COPY.lede}</p>
            <div className="mt-10 max-w-[18rem] lg:mt-12">
              <VialImage priority />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div id="buy" className="scroll-mt-24 lg:sticky lg:top-24">
              <StarterKitBuy />
            </div>
          </div>
        </div>
      </section>

      {/* What's in the box: every piece and how many, the page's whole point. */}
      <section className="section" aria-labelledby="box-heading">
        <h2 id="box-heading" className="text-3xl sm:text-4xl">
          {COPY.boxHeading}
        </h2>
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {COPY.box.map((item) => (
            <li key={item.name} className="grid grid-cols-[3.5rem_1fr] gap-x-4 py-5 sm:grid-cols-[4.5rem_1fr]">
              <span className="tabular font-display text-3xl font-bold text-ink">{item.count}</span>
              <span>
                <span className="block text-lg font-semibold text-ink">{item.name}</span>
                <span className="measure mt-1 block text-base text-ink-soft">{item.note}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-soft">{COPY.disposal}</p>
      </section>

      <section className="section pt-0" aria-labelledby="save-heading">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 id="save-heading" className="text-2xl sm:text-3xl">
              {COPY.saveHeading}
            </h2>
            <p className="measure mt-4 text-lg text-ink-soft">{COPY.save}</p>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl">{COPY.vialHeading}</h2>
            <p className="measure mt-4 text-lg text-ink-soft">{COPY.vial}</p>
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-2xl sm:text-3xl">
          {COPY.moreHeading}
        </h2>
        <p className="measure mt-4 text-lg text-ink-soft">{COPY.more}</p>
        <p className="mt-6">
          <Link href="/#buy" className="link">
            {COPY.moreLink}
          </Link>
        </p>
      </section>
    </>
  );
}
