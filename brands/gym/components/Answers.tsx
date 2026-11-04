import Link from "next/link";
import { formatGbp, type StorefrontView } from "@/lib/commerce/view";
import { ANSWERS, BOX } from "@/brands/gym/copy/home";

/**
 * Straight answers: the questions a buyer asks before paying, answered in a
 * line each. Native <details>, so they open with no JavaScript, from the
 * keyboard, and in every screen reader. The delivery answer is the
 * storefront view's own options and prices.
 */
export function Answers({ view }: { view: StorefrontView }) {
  const options = view.delivery.options;
  return (
    <section aria-labelledby="answers-heading" className="gym-answers gym-concrete">
      <div className="gym-wrap gym-answers-grid">
        <h2 id="answers-heading" className="gym-h2">
          {ANSWERS.heading}
        </h2>
        <div className="gym-qa-list">
          {ANSWERS.items.map((item) => (
            <details key={item.q} className="gym-qa">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
          {options.length > 0 ? (
            <details className="gym-qa">
              <summary>{ANSWERS.delivery}</summary>
              <ul>
                {options.map((o) => (
                  <li key={o.id}>{BOX.deliveryLine(o.label, o.detail, formatGbp(o.priceMinor))}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <details className="gym-qa">
            <summary>{ANSWERS.returns}</summary>
            <p>
              {ANSWERS.returnsAnswer}{" "}
              <Link href="/returns" className="gym-link">
                {ANSWERS.returnsLink}
              </Link>
              .
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
