import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { byQuote, sizeList, vials } from "@/brands/wholesale/copy/home";
import { QUOTE } from "@/brands/wholesale/copy/pages";
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
 * The quote page: the packs sold by quote, from the catalogue, and the
 * request form (QuoteForm), which sends the quote's facts to /api/contact
 * as a wholesale enquiry for this brand's inbox. The price list links each
 * quote row here with ?pack=<vials>, which presets the form.
 */
export default function QuotePage() {
  return (
    <main id="main" className="wh-wrap">
      <JsonLd data={breadcrumbSchema(QUOTE.title, "/quote", brand.id)} />
      <div className="wh-page-head">
        <h1 className="wh-page-title">{QUOTE.title}</h1>
        <p className="wh-page-lede">{QUOTE.lede(sizes)}</p>
      </div>

      <div className="wh-two">
        <div className="grid content-start gap-6">
          {quotePacks.length > 0 ? (
            <section aria-labelledby="packs-heading" className="wh-sheet">
              <h2 id="packs-heading" className="wh-sheet-head">
                {QUOTE.packsHeading}
              </h2>
              <table className="wh-table wh-facts">
                <tbody>
                  {quotePacks.map((p) => (
                    <tr key={p.sku}>
                      <th scope="row">{vials(p.vials)}</th>
                      <td className="text-ink-soft">{p.sku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <p className="text-sm text-ink-soft">
            {QUOTE.smaller}{" "}
            <Link href="/#buy" className="link font-semibold text-navy">
              {QUOTE.smallerLink}
            </Link>
            .
          </p>
        </div>

        <section aria-labelledby="form-heading" className="wh-sheet">
          <h2 id="form-heading" className="wh-sheet-head">
            {QUOTE.formHeading}
          </h2>
          <div className="wh-sheet-body">
            <QuoteForm
              packs={quotePacks.map((p) => ({ sku: p.sku, vials: p.vials, label: vials(p.vials) }))}
              messageMax={CONTACT_MESSAGE_MAX}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
