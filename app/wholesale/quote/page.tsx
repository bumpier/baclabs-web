import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { byQuote, sizeList, vials } from "@/brands/wholesale/copy/home";
import { CRUMBS, QUOTE } from "@/brands/wholesale/copy/pages";
import { brand, STOREFRONT } from "../site";
import { QuoteForm } from "./QuoteForm";

const quotePacks = byQuote(STOREFRONT);
const sizes = sizeList(quotePacks.map((p) => p.vials));

export const metadata: Metadata = pageMetadata({
  title: QUOTE.title,
  description: QUOTE.description(sizes),
  path: "/quote",
  brandId: brand.id,
});

/**
 * The quote page: the packs sold by quote, from the catalogue, how a quote
 * works, and the request form (QuoteForm), which sends the quote's facts to
 * /api/contact as a wholesale enquiry for this brand's inbox. The price
 * table links each quote row here with ?pack=<vials>, which presets the
 * form.
 */
export default function QuotePage() {
  return (
    <main id="main" className="vh-page">
      <JsonLd data={breadcrumbSchema(QUOTE.title, "/quote", brand.id)} />
      <nav aria-label="Breadcrumb" className="vh-wrap vh-crumbs">
        <ol>
          <li>
            <Link href="/">{CRUMBS.catalogue}</Link>
          </li>
          <li aria-current="page">{QUOTE.title}</li>
        </ol>
      </nav>
      <div className="vh-wrap">
        <div className="vh-page-head">
          <h1 className="vh-page-title">{QUOTE.title}</h1>
          <p className="vh-page-lede">{QUOTE.lede(sizes)}</p>
        </div>

        <div className="vh-two">
          <div>
            {quotePacks.length > 0 ? (
              <section aria-labelledby="packs-heading" className="vh-aside-block">
                <h2 id="packs-heading" className="vh-h3">
                  {QUOTE.packsHeading}
                </h2>
                <table className="vh-table mt-3">
                  <thead>
                    <tr>
                      <th scope="col">{QUOTE.packsHead.size}</th>
                      <th scope="col">{QUOTE.packsHead.code}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotePacks.map((p) => (
                      <tr key={p.sku}>
                        <th scope="row">{vials(p.vials)}</th>
                        <td>
                          <span className="vh-sku">{p.sku}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <section aria-labelledby="steps-heading" className="vh-aside-block">
              <h2 id="steps-heading" className="vh-h3">
                {QUOTE.stepsHeading}
              </h2>
              <ol className="vh-steps">
                {QUOTE.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>

            <p className="vh-aside-block text-sm text-ink-soft">
              {QUOTE.smaller}{" "}
              <Link href="/#buy" className="link font-semibold text-spruce">
                {QUOTE.smallerLink}
              </Link>
              .
            </p>
          </div>

          <section aria-labelledby="form-heading" className="vh-panel">
            <h2 id="form-heading" className="vh-panel-head">
              {QUOTE.formHeading}
            </h2>
            <div className="vh-panel-body">
              <QuoteForm
                packs={quotePacks.map((p) => ({ sku: p.sku, vials: p.vials, label: vials(p.vials) }))}
                messageMax={CONTACT_MESSAGE_MAX}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
