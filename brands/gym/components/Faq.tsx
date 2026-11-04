import Link from "next/link";
import { formatGbp, type StorefrontView } from "@/lib/commerce/view";
import { FAQ } from "@/brands/gym/copy/home";
import { PlusIcon } from "./icons";

/**
 * Straight answers (#faq): native <details>, so each opens with no
 * JavaScript, from the keyboard, and in every screen reader. The delivery
 * answer is the storefront view's own options, prices and threshold; the Lab
 * Kit answer is there only while the kit is on sale, its parts the view's.
 */
export function Faq({ view }: { view: StorefrontView }) {
  const options = view.delivery.options;
  const free = view.delivery.freeFromMinor;
  const freeOption = options.find((o) => o.overThreshold === "free") ?? null;
  const kit = view.addOns.find((a) => a.available && a.contents) ?? null;

  const item = (q: string, body: React.ReactNode) => (
    <details key={q} className="gym-qa">
      <summary className="gym-qa-q">
        <span>{q}</span>
        <PlusIcon className="gym-qa-icon" />
      </summary>
      <div className="gym-qa-a">{body}</div>
    </details>
  );

  return (
    <section id="faq" aria-labelledby="faq-heading" className="gym-faq">
      <div className="gym-wrap gym-faq-grid">
        <div className="gym-faq-head">
          <h2 id="faq-heading" className="gym-h2">
            {FAQ.heading}
          </h2>
          <p className="gym-lead">
            {FAQ.lead}{" "}
            <Link href="/contact" className="gym-link">
              {FAQ.contact}
            </Link>
            .
          </p>
        </div>
        <div className="gym-qa-list">
          {FAQ.items.map((i) => item(i.q, <p>{i.a}</p>))}
          {options.length > 0
            ? item(
                FAQ.delivery,
                <ul>
                  {options.map((o) => (
                    <li key={o.id}>{FAQ.deliveryLine(o.label, o.detail, formatGbp(o.priceMinor))}</li>
                  ))}
                  {free !== null && freeOption ? <li>{FAQ.freeFrom(freeOption.label, formatGbp(free))}</li> : null}
                </ul>
              )
            : null}
          {item(
            FAQ.returns,
            <p>
              {FAQ.returnsAnswer}{" "}
              <Link href="/returns" className="gym-link">
                {FAQ.returnsLink}
              </Link>
              .
            </p>
          )}
          {kit ? item(FAQ.kit(kit.name), <p>{FAQ.kitAnswer(kit.contents.charAt(0).toUpperCase() + kit.contents.slice(1))}</p>) : null}
        </div>
      </div>
    </section>
  );
}
