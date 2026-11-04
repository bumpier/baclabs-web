import Link from "next/link";
import { byQuote, HERO, ORDERING, orderingTerms, QUOTE_BAND, SPEC, vials, type TermRow } from "@/brands/wholesale/copy/home";
import { STOREFRONT } from "./site";
import { BuySection } from "./BuySection";

/**
 * The home page is the trade counter: the title, then the price list that
 * is also the order form (#buy, where an abandoned checkout returns to),
 * then the terms a buyer checks before raising an order, the product's
 * specification, and the way to a quote for the packs not sold online.
 *
 * A server component; only the order desk runs in the browser. No mailing
 * list, popup or welcome offer: this brand runs none.
 */
export default function Home() {
  const view = STOREFRONT;
  const quote = byQuote(view);
  const codes = view.packs.map((p) => ({ size: vials(p.vials), sku: p.sku }));

  return (
    <main id="main">
      <div className="wh-wrap">
        <div className="wh-page-head md:pb-10">
          <h1 className="wh-h1">{HERO.title}</h1>
          <p className="wh-lede">{HERO.lede(view)}</p>
        </div>
        <BuySection />
      </div>

      <div className="wh-wrap wh-split">
        <FactSheet id="ordering" heading={ORDERING.heading} rows={orderingTerms(view)} />
        <FactSheet
          id="specification"
          heading={SPEC.heading}
          rows={SPEC.rows}
          extra={
            <tr>
              <th scope="row">{SPEC.codesTerm}</th>
              <td>
                <span className="wh-codes">
                  {codes.map((c) => (
                    <span key={c.sku}>
                      <span className="text-ink">{c.sku}</span> {c.size}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          }
        />
      </div>

      {quote.length > 0 ? (
        <section aria-labelledby="quote-heading" className="wh-quote-band">
          <div className="wh-wrap wh-quote-band-inner">
            <div>
              <h2 id="quote-heading">{QUOTE_BAND.heading(view)}</h2>
              <p>{QUOTE_BAND.body(view)}</p>
            </div>
            <Link href="/quote" className="wh-btn-onnavy justify-self-start">
              {QUOTE_BAND.action}
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

/** A sheet of facts: a navy title bar over a two-column table, each row a term and its detail. */
function FactSheet({ id, heading, rows, extra }: { id: string; heading: string; rows: TermRow[]; extra?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="wh-sheet scroll-mt-4">
      <h2 id={`${id}-heading`} className="wh-sheet-head">
        {heading}
      </h2>
      <table className="wh-table wh-facts">
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.term}${r.detail}`}>
              <th scope="row">{r.term}</th>
              <td>
                {r.detail}
                {r.link ? (
                  <>
                    {" "}
                    <Link href={r.link.href} className="link font-semibold text-navy">
                      {r.link.text}
                    </Link>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {extra}
        </tbody>
      </table>
    </section>
  );
}
