import Link from "next/link";
import { SignupForm } from "@/components/commerce/SignupForm";
import { BoxDrawing } from "@/brands/luxury/components/BoxDrawing";
import { OpenBox } from "@/brands/luxury/components/OpenBox";
import { BATCH_CARD, DAY, HERO, LETTERS } from "@/brands/luxury/copy/home";
import { serviceFacts } from "@/brands/luxury/service";
import { brand, STOREFRONT } from "./site";
import { BuySection } from "./BuySection";

/**
 * The home page, and the whole of the funnel: few choices, one box, one
 * delivery, someone to write to.
 *
 * The hero shows the box (drawn until there are photographs) and says what
 * it is in one line. Everything after it is "the order of the day": a
 * timetable of one working day, from choosing (by the cutoff, where the buy
 * section sits, at #buy) to the parcel at the door the next working day, to
 * the concierge. The times and the delivery words come from the catalogue
 * through the storefront view (brands/luxury/service.ts), so the page never
 * promises what the checkout does not sell.
 *
 * Left out on purpose: promotions, codes, popups, plans and any countdown. The
 * gift note waits for the checkout to carry one (it is not in the contract).
 */
export default function Home() {
  const facts = serviceFacts(STOREFRONT);
  const list = STOREFRONT.mailingList;
  const card = BATCH_CARD !== "";

  return (
    <main id="main">
      <div className="rx-wrap">
        <section aria-labelledby="hero-heading" className="rx-hero">
          <div>
            <h1 id="hero-heading" className="rx-hero__heading">
              {HERO.heading}
            </h1>
            <p className="rx-hero__lede">
              {HERO.lede(brand.name)}
              {facts ? ` ${HERO.delivery(facts)}` : ""}
            </p>
            <p className="rx-hero__actions">
              <a href="#buy" className="rx-btn">
                {HERO.choose}
              </a>
              <Link href="/contact" className="rx-link">
                {HERO.concierge}
              </Link>
            </p>
          </div>
          <div className="rx-hero__art">
            {/*
              TODO(launch): photography. The box on ivory, lid ajar, can take this drawing's place.
            */}
            <BoxDrawing animate card={card} />
          </div>
        </section>
      </div>

      <section aria-labelledby="day-heading" className="rx-dark rx-day">
        <div className="rx-wrap">
          <h2 id="day-heading" className="rx-day__heading">
            {DAY.heading}
          </h2>

          <ol>
            <li id="buy" className="rx-station">
              <p className="rx-when">{DAY.choose.when(facts?.cutoff ?? null)}</p>
              <div>
                <h3 className="rx-station__title">{DAY.choose.title}</h3>
                <BuySection />
              </div>
            </li>

            {facts ? (
              <li className="rx-station">
                <p className="rx-when">{facts.arrives}</p>
                <div className="rx-arrival">
                  <div>
                    <h3 className="rx-station__title">{DAY.arrive.title}</h3>
                    <p className="rx-station__text">{DAY.arrive.carrier(facts)}</p>
                    <p className="rx-station__text">{DAY.arrive.tracking}</p>
                    <dl className="rx-contents">
                      {DAY.arrive.contents.map((row) => (
                        <div key={row.term}>
                          <dt>{row.term}</dt>
                          <dd>{row.detail(brand.name)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <figure className="rx-plate">
                    {/*
                      TODO(launch): photography. The open box from above, on black, at 4:5.
                    */}
                    <div className="rx-plate__frame rx-frame">
                      <OpenBox card={card} />
                    </div>
                    <figcaption>{DAY.arrive.figure}</figcaption>
                  </figure>
                </div>
              </li>
            ) : null}

            <li className="rx-station">
              <p className="rx-when">{DAY.concierge.when}</p>
              <div>
                <h3 className="rx-station__title">{DAY.concierge.title}</h3>
                <p className="rx-station__text">{DAY.concierge.body}</p>
                <p className="rx-concierge__action">
                  <Link href="/contact" className="rx-btn rx-btn--line">
                    {DAY.concierge.action}
                  </Link>
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {list ? (
        <div className="rx-wrap">
          <section aria-labelledby="letters-heading" className="rx-letters">
            <div>
              <h2 id="letters-heading" className="rx-letters__heading">
                {LETTERS.heading}
              </h2>
              <p className="rx-letters__lede">{LETTERS.lede}</p>
            </div>
            <SignupForm
              config={{
                consentText: list.consentText,
                placeholder: LETTERS.placeholder,
                submitLabel: LETTERS.submit,
                pendingLabel: LETTERS.pending,
                doneMessage: LETTERS.done,
              }}
              source="inline"
              classNames={{
                form: "rx-form",
                row: "rx-signup__row",
                input: "rx-input",
                button: "rx-btn shrink-0",
                consent: "rx-signup__consent",
                link: "rx-link",
                done: "rx-letters__lede",
              }}
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}
