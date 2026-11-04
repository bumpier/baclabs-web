import Link from "next/link";
import { formatGbp } from "@/lib/commerce/view";
import {
  byQuote,
  DELIVERY_TAB,
  DOCUMENTS,
  MATRIX,
  PACKS,
  packDelivery,
  packRows,
  PRODUCT,
  QUOTE_BAND,
  SPEC,
  TABS,
  TRADE,
  tradeTerms,
  transitOnly,
  type Row,
} from "@/brands/wholesale/copy/home";
import { CARTON_OPEN, GALLERY, PALLET } from "@/brands/wholesale/copy/images";
import { STOREFRONT } from "./site";
import { Gallery } from "./Gallery";
import { Photo } from "./Photo";
import { SpecTabs } from "./SpecTabs";
import { OrderDesk } from "./OrderDesk";

/**
 * The product page, laid out the way a laboratory distributor presents a
 * catalogue item: a breadcrumb, the gallery beside the title, codes and a
 * short specification, the tabbed detail (Specification, Packs & cartons,
 * Delivery, Documents), then the tier price table where quantities are
 * typed, with the order summary beside it (#buy, where an abandoned
 * checkout returns to). Then the quote band for the packs not sold online,
 * and the trade terms a buyer checks before raising an order.
 *
 * A server component; the gallery, the tabs and the order desk run in the
 * browser. No mailing list, popup or welcome offer: this brand runs none.
 */
export default function Home() {
  const view = STOREFRONT;
  const quote = byQuote(view);
  const best = PRODUCT.best(view);
  const delivery = packDelivery(view);

  return (
    <main id="main">
      <nav aria-label="Breadcrumb" className="vh-wrap vh-crumbs">
        <ol>
          <li>
            <Link href="/">{PRODUCT.crumbs.catalogue}</Link>
          </li>
          <li>{PRODUCT.crumbs.category}</li>
          <li aria-current="page">{PRODUCT.crumbs.current}</li>
        </ol>
      </nav>

      <section id="product" aria-labelledby="product-title" className="vh-wrap vh-product">
        <Gallery photos={GALLERY} label="Product photos" />

        <div className="vh-buybox">
          <h1 id="product-title" className="vh-title">
            {PRODUCT.title}
          </h1>
          <p className="vh-standfirst">{PRODUCT.standfirst(view)}</p>

          <div className="vh-codes">
            <p className="vh-codes-label">{PRODUCT.codesLabel}</p>
            <ul>
              {view.packs.map((p) => (
                <li key={p.sku}>
                  <span className="vh-sku" data-quote={p.available ? undefined : ""} title={PRODUCT.codeTitle(p)}>
                    {p.sku}
                  </span>
                  <span className="sr-only">: {PRODUCT.codeTitle(p)}</span>
                </li>
              ))}
            </ul>
          </div>

          <dl className="vh-spec-mini">
            {PRODUCT.summary.map((r) => (
              <div key={r.term}>
                <dt>{r.term}</dt>
                <dd>{r.detail}</dd>
              </div>
            ))}
          </dl>

          {best ? (
            <div className="vh-price">
              <p className="vh-price-label">{PRODUCT.priceLabel}</p>
              <p className="vh-price-main">
                <span className="vh-price-figure">{best.price}</span> <span className="vh-price-note">{best.note}</span>
              </p>
              {PRODUCT.others(view).map((o) => (
                <p key={o} className="vh-price-other">
                  {o}
                </p>
              ))}
              <div className="vh-actions">
                <a href="#buy" className="btn-cta vh-btn-lg">
                  {PRODUCT.choose}
                </a>
                {quote.length > 0 ? (
                  <Link href="/quote" className="vh-btn-outline vh-btn-lg">
                    {PRODUCT.quote}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <ul className="vh-checks">
            {PRODUCT.facts(view).map((f) => (
              <li key={f}>
                <CheckIcon />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label={TABS.label} className="vh-wrap vh-details">
        <SpecTabs
          label={TABS.label}
          tabs={[
            {
              id: "specification",
              label: TABS.spec,
              panel: (
                <div className="vh-panel-grid">
                  <p className="vh-panel-intro">{SPEC.intro}</p>
                  <SpecTable rows={SPEC.rows} />
                </div>
              ),
            },
            {
              id: "packs",
              label: TABS.packs,
              panel: (
                <div className="vh-panel-split">
                  <div>
                    <p className="vh-panel-intro">{PACKS.intro}</p>
                    <table className="vh-table">
                      <thead>
                        <tr>
                          <th scope="col">{PACKS.head.code}</th>
                          <th scope="col">{PACKS.head.size}</th>
                          <th scope="col" className="vh-num">
                            {PACKS.head.perVial}
                          </th>
                          <th scope="col">{PACKS.head.how}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packRows(view).map((r) => (
                          <tr key={r.sku}>
                            <td>
                              <span className="vh-sku" data-quote={r.quote ? "" : undefined}>
                                {r.sku}
                              </span>
                            </td>
                            <th scope="row">{r.size}</th>
                            <td className="vh-num">{r.perVial}</td>
                            <td>
                              {r.quote ? (
                                <Link href={`/quote?pack=${r.size.replace(/\D/g, "")}`} className="link">
                                  {r.how}
                                </Link>
                              ) : (
                                r.how
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {PACKS.quoteNote(view) ? <p className="vh-panel-note">{PACKS.quoteNote(view)}</p> : null}
                  </div>
                  <figure className="vh-panel-figure">
                    <Photo photo={CARTON_OPEN} sizes="(min-width: 1024px) 480px, 100vw" />
                  </figure>
                </div>
              ),
            },
            {
              id: "delivery",
              label: TABS.delivery,
              panel: (
                <div className="vh-panel-grid">
                  <p className="vh-panel-intro">{DELIVERY_TAB.intro}</p>
                  <table className="vh-table">
                    <thead>
                      <tr>
                        <th scope="col">{DELIVERY_TAB.head.service}</th>
                        <th scope="col">{DELIVERY_TAB.head.carrier}</th>
                        <th scope="col">{DELIVERY_TAB.head.when}</th>
                        <th scope="col" className="vh-num">
                          {DELIVERY_TAB.head.price}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {delivery.map(({ option, priceMinor }) => (
                        <tr key={option.id}>
                          <th scope="row">{option.label}</th>
                          <td>{option.carrier}</td>
                          <td>{capitalise(option.transit)}</td>
                          <td className="vh-num">{priceMinor === 0 ? DELIVERY_TAB.free : formatGbp(priceMinor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="vh-checks vh-checks-panel">
                    {delivery
                      .filter((d) => d.option.cutoff)
                      .map((d) => (
                        <li key={d.option.id}>
                          <CheckIcon />
                          {DELIVERY_TAB.cutoffLine(d.option.cutoff!, transitOnly(d.option))}
                        </li>
                      ))}
                    <li>
                      <CheckIcon />
                      {DELIVERY_TAB.tracking}
                    </li>
                    {quote.length > 0 ? (
                      <li>
                        <CheckIcon />
                        {DELIVERY_TAB.quoteLine}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ),
            },
            {
              id: "documents",
              label: TABS.documents,
              panel: (
                <div className="vh-panel-grid">
                  <p className="vh-panel-intro">{DOCUMENTS.intro}</p>
                  <div className="vh-docs">
                    <div>
                      <h3 className="vh-h3">{DOCUMENTS.availableHead}</h3>
                      <ul className="vh-doc-list">
                        {DOCUMENTS.available.map((d) => (
                          <li key={d.href}>
                            <DocIcon />
                            <Link href={d.href} className="link">
                              {d.name}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <DocIcon />
                          <span>{DOCUMENTS.orderLine}</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="vh-h3">{DOCUMENTS.pendingHead}</h3>
                      <ul className="vh-doc-list" data-pending="">
                        {DOCUMENTS.pending.map((d) => (
                          <li key={d}>
                            <DocIcon />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="vh-panel-note">
                        {DOCUMENTS.pendingNote}{" "}
                        <Link href="/contact" className="link">
                          {DOCUMENTS.ask}
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </section>

      <section id="buy" aria-labelledby="buy-heading" className="vh-wrap vh-section">
        <div className="vh-section-head">
          <h2 id="buy-heading" className="vh-h2">
            {MATRIX.heading}
          </h2>
          <p className="vh-section-lede">{MATRIX.lede}</p>
        </div>
        <OrderDesk />
      </section>

      {quote.length > 0 ? (
        <section aria-labelledby="quote-heading" className="vh-quote-band">
          <div className="vh-wrap vh-quote-inner">
            <div className="vh-quote-copy">
              <h2 id="quote-heading" className="vh-h2">
                {QUOTE_BAND.heading}
              </h2>
              <p>{QUOTE_BAND.body(view)}</p>
              <ul className="vh-quote-rows">
                {quote.map((p) => (
                  <li key={p.sku}>
                    <span className="vh-quote-size">{QUOTE_BAND.row(p.vials)}</span>
                    <span className="vh-sku vh-sku-dark">{p.sku}</span>
                    <Link href={`/quote?pack=${p.vials}`} className="vh-quote-link">
                      {QUOTE_BAND.rowAction}
                      <span className="sr-only"> for {QUOTE_BAND.row(p.vials)}</span>
                      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
                        <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/quote" className="btn-cta vh-btn-lg">
                {QUOTE_BAND.standing}
              </Link>
            </div>
            <div className="vh-quote-photo">
              <Photo photo={PALLET} sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="trade-heading" className="vh-wrap vh-section">
        <div className="vh-section-head">
          <h2 id="trade-heading" className="vh-h2">
            {TRADE.heading}
          </h2>
          <p className="vh-section-lede">{TRADE.lede}</p>
        </div>
        <dl className="vh-trade">
          {tradeTerms(view).map((r) => (
            <div key={r.term}>
              <dt>{r.term}</dt>
              <dd>
                {r.detail}
                {r.link ? (
                  <>
                    {" "}
                    <Link href={r.link.href} className="link">
                      {r.link.text}
                    </Link>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A two-column specification table: the spec sheet's ruled rows. */
function SpecTable({ rows }: { rows: Row[] }) {
  return (
    <table className="vh-table vh-spec">
      <tbody>
        {rows.map((r) => (
          <tr key={r.term}>
            <th scope="row">{r.term}</th>
            <td>{r.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" className="vh-check-icon">
      <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" className="vh-doc-icon">
      <path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3 M5.5 8h5 M5.5 10.5h5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
