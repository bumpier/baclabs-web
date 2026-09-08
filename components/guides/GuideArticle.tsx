import Link from "next/link";
import type { ReactNode } from "react";
import { PRODUCT, formatMinor } from "@/config/funnel";
import { JsonLd } from "@/components/JsonLd";
import { RichText } from "@/components/guides/RichText";
import { FaqList } from "@/components/guides/FaqList";
import { faqPageSchema, guideArticleSchema, guideBreadcrumbSchema } from "@/lib/guide-seo";
import type { Guide, GuideTable } from "@/content/guides/types";

/**
 * The one renderer for every guide.
 *
 * Order is fixed on purpose: quick answer, then the sub-questions, then the
 * FAQ, then the product. An answer engine reads the first paragraph; a person
 * skims the H2s; both reach the same "buy" block last. Guides never carry the
 * price superlative — it is only ever shown next to the guarantee that
 * substantiates it, and that lives on the home page.
 */
export function GuideArticle({
  guide,
  siblings,
}: {
  guide: Guide;
  /** The two related guides, already resolved. */
  siblings: Pick<Guide, "slug" | "title" | "description">[];
}) {
  const updated = new Date(guide.updated).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={guideBreadcrumbSchema(guide)} />
      <JsonLd data={guideArticleSchema(guide)} />
      {guide.faq.length > 0 ? <JsonLd data={faqPageSchema(guide.faq)} /> : null}

      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="link">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/guides" className="link">
              Guides
            </Link>
          </li>
        </ol>
      </nav>

      <h1 className="mt-4 text-3xl sm:text-4xl">{guide.title}</h1>
      <p className="mt-3 text-sm text-ink-soft">Updated {updated}</p>

      {/* The direct answer. Marked so it can be styled and found, and kept
          to one paragraph so it is quotable whole. */}
      <div className="surface-card mt-8 border-l-4 border-l-brand p-6 sm:p-7" data-quick-answer>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Quick answer</p>
        <p className="measure mt-2 text-lg text-ink">
          <RichText text={guide.quickAnswer} />
        </p>
      </div>

      <div className="mt-12 space-y-12">
        {guide.sections.map((s) => (
          <section key={s.heading} id={anchor(s.heading)} className="scroll-mt-24">
            <h2 className="text-2xl">{s.heading}</h2>
            <div className="prose-guide mt-4">
              {s.paragraphs.map((p, i) => (
                <p key={i}>
                  <RichText text={p} />
                </p>
              ))}
              {s.list ? (
                <ul>
                  {s.list.map((li, i) => (
                    <li key={i}>
                      <RichText text={li} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.table ? <DataTable table={s.table} /> : null}
            </div>
          </section>
        ))}
      </div>

      {guide.faq.length > 0 ? (
        <section className="mt-16" aria-labelledby="guide-faq-heading">
          <h2 id="guide-faq-heading" className="text-2xl">
            Questions people ask
          </h2>
          <div className="mt-6">
            <FaqList items={guide.faq} />
          </div>
        </section>
      ) : null}

      <BuyCard />

      {siblings.length > 0 ? (
        <section className="mt-12" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-lg">
            Related guides
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {siblings.map((g) => (
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
          </ul>
        </section>
      ) : null}

      <p className="mt-12 text-xs text-ink-soft">
        This guide describes a laboratory diluent and how it is handled. It is not medical
        advice, and nothing in it is a recommendation to administer anything to a person or an
        animal. See the <Link href="/disclaimer" className="link">product disclaimer</Link>.
      </p>
    </article>
  );
}

/** The single link to the product that every guide carries. */
export function BuyCard({ children }: { children?: ReactNode }) {
  return (
    <aside className="surface-card mt-16 p-6 sm:p-8" aria-labelledby="buy-card-heading">
      <h2 id="buy-card-heading" className="text-xl">
        {PRODUCT.name}, {PRODUCT.size}
      </h2>
      <p className="measure mt-2 text-base text-ink-soft">
        {children ?? (
          <>
            Sealed multi-dose vial, {PRODUCT.composition.toLowerCase().replace(/\.$/, "")}. From{" "}
            <span className="tabular">{formatMinor(PRODUCT.unitPriceMinor)}</span> a vial, less in
            packs. Sold as a laboratory and research diluent.
          </>
        )}
      </p>
      <p className="mt-5">
        <Link href="/#buy" className="btn-cta sm:w-auto">
          See prices
        </Link>
      </p>
    </aside>
  );
}

export function DataTable({ table }: { table: GuideTable }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-panel border border-line">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <caption className="sr-only">{table.caption}</caption>
        <thead>
          <tr className="bg-neutral">
            {table.columns.map((c) => (
              <th key={c} scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="border-b border-line px-4 py-3 font-medium text-ink">
                    <RichText text={cell} />
                  </th>
                ) : (
                  <td key={j} className="border-b border-line px-4 py-3 text-ink-soft">
                    <RichText text={cell} />
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function anchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
