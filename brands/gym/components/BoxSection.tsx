import Link from "next/link";
import { formatGbp, type StorefrontView } from "@/lib/commerce/view";
import { BOX } from "@/brands/gym/copy/home";

/**
 * What you get: the product as the legal pages describe it, who may buy it,
 * the delivery the catalogue offers at the prices it charges, and the
 * returns rule in one line. Every delivery figure is the storefront view's.
 *
 * Beside it, a stencilled shipping crate stands where the product photo
 * will go. It is decoration (the same facts are in the text), so it is
 * hidden from assistive technology.
 */
export function BoxSection({ view, name, vials }: { view: StorefrontView; name: string; vials: number | null }) {
  const free = view.delivery.freeFromMinor;
  const freeOption = view.delivery.options.find((o) => o.overThreshold === "free") ?? null;
  // TODO(launch): photography. The boxed pack, shot in the brand's own style, replaces the stencilled crate below; keep its 4:3 frame and hard black edge.
  return (
    <section aria-labelledby="box-heading" className="gym-box gym-rubber">
      <div className="gym-wrap gym-box-grid">
        <div className="gym-crate" aria-hidden="true">
          <div className="gym-crate-face">
            <span className="gym-crate-mark">{name}</span>
            {vials ? <span className="gym-crate-count gym-figure">{BOX.crate.count(vials)}</span> : null}
            <span className="gym-crate-contents">{BOX.crate.contents}</span>
            <span className="gym-crate-up">
              <svg viewBox="0 0 34 24" className="gym-crate-arrows">
                <path d="M1 11 L7 2 L13 11 Z M5 11 h4 v12 h-4 Z" />
                <path d="M21 11 L27 2 L33 11 Z M25 11 h4 v12 h-4 Z" />
              </svg>
              {BOX.crate.up}
            </span>
          </div>
        </div>

        <div>
          <h2 id="box-heading" className="gym-h2">
            {BOX.heading}
          </h2>
          <dl className="gym-facts">
            {BOX.facts.map((f) => (
              <div key={f.term}>
                <dt>{f.term}</dt>
                <dd>{f.detail}</dd>
              </div>
            ))}
            {view.delivery.options.length > 0 ? (
              <div>
                <dt>{BOX.delivery}</dt>
                <dd>
                  <ul className="space-y-1">
                    {view.delivery.options.map((o) => (
                      <li key={o.id}>{BOX.deliveryLine(o.label, o.detail, formatGbp(o.priceMinor))}</li>
                    ))}
                    {free !== null && freeOption ? <li className="gym-facts-hot">{BOX.freeFrom(formatGbp(free), freeOption.label)}</li> : null}
                  </ul>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{BOX.returns}</dt>
              <dd>
                {BOX.returnsLine}{" "}
                <Link href="/returns" className="gym-link">
                  {BOX.returnsLink}
                </Link>
                .
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
