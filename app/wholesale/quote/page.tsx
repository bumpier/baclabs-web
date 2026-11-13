import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { byQuote, sizeList, vials } from "@/brands/wholesale/copy/home";
import { CRUMBS, QUOTE } from "@/brands/wholesale/copy/pages";
import { brand, STOREFRONT } from "../site";
import { MAILBOX, quoteMailto } from "@/brands/wholesale/mailbox";

const quotePacks = byQuote(STOREFRONT);
const sizes = sizeList(quotePacks.map((p) => p.vials));

export const metadata: Metadata = pageMetadata({
  title: QUOTE.title,
  description: QUOTE.description(sizes),
  path: "/quote",
  brandId: brand.id,
});

/**
 * The quote page: the packs sold by quote, from the catalogue, and how a
 * quote works. Quotes are done by email (brands/wholesale/mailbox.ts): each
 * pack's "Get a quote" opens an email to the brand's mailbox with its size
 * already written, as the price table's quote rows do.
 */
export default function QuotePage() {
  return (
    <main id="main" className="bk-page">
      <JsonLd data={breadcrumbSchema(QUOTE.title, "/quote", brand.id)} />
      <nav aria-label="Breadcrumb" className="bk-wrap bk-crumbs">
        <ol>
          <li>
            <Link href="/">{CRUMBS.catalogue}</Link>
          </li>
          <li aria-current="page">{QUOTE.title}</li>
        </ol>
      </nav>
      <div className="bk-wrap">
        <div className="bk-page-head">
          <h1 className="bk-page-title">{QUOTE.title}</h1>
          <p className="bk-page-lede">{QUOTE.lede(sizes)}</p>
        </div>

        <div className="bk-two">
          <div>
            {quotePacks.length > 0 ? (
              <section aria-labelledby="packs-heading" className="bk-aside-block">
                <h2 id="packs-heading" className="bk-h3">
                  {QUOTE.packsHeading}
                </h2>
                <table className="bk-table mt-3">
                  <thead>
                    <tr>
                      <th scope="col">{QUOTE.packsHead.size}</th>
                      <th scope="col">{QUOTE.packsHead.code}</th>
                      <th scope="col">{QUOTE.packsHead.action}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotePacks.map((p) => (
                      <tr key={p.sku}>
                        <th scope="row">{vials(p.vials)}</th>
                        <td>
                          <span className="bk-sku">{p.sku}</span>
                        </td>
                        <td>
                          <a href={quoteMailto(p.vials)} className="link font-semibold text-spruce">
                            {QUOTE.packAction}
                            <span className="sr-only"> for {vials(p.vials)}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <section aria-labelledby="steps-heading" className="bk-aside-block">
              <h2 id="steps-heading" className="bk-h3">
                {QUOTE.stepsHeading}
              </h2>
              <ol className="bk-steps">
                {QUOTE.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>

            <p className="bk-aside-block text-sm text-ink-soft">
              {QUOTE.smaller}{" "}
              <Link href="/#buy" className="link font-semibold text-spruce">
                {QUOTE.smallerLink}
              </Link>
              .
            </p>
          </div>

          <section aria-labelledby="form-heading" className="bk-panel">
            <h2 id="form-heading" className="bk-panel-head">
              {QUOTE.emailHeading}
            </h2>
            <div className="bk-panel-body">
              <p className="text-ink">{QUOTE.emailBody}</p>
              <p className="mt-3">
                <a href={`mailto:${MAILBOX}`} className="link font-semibold text-spruce">
                  {MAILBOX}
                </a>
              </p>
              <p className="mt-5">
                <a href={quoteMailto()} className="btn-cta bk-btn-lg">
                  {QUOTE.emailButton}
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
