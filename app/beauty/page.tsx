import Link from "next/link";
import { SignupForm } from "@/components/commerce/SignupForm";
import { StillLife } from "@/brands/beauty/components/StillLife";
import { EssentialsPicker } from "./EssentialsPicker";
import { Basket } from "./Basket";
import { MarbleVeins } from "@/brands/beauty/components/MarbleVeins";
import { CLINICS_TEASER, DETAILS, ESSENTIALS, HERO, LETTERS, deliverySentences, listSizes } from "@/brands/beauty/copy/home";
import { CLINIC_PACKS, ESSENTIAL_PACKS, STOREFRONT } from "./site";

/**
 * The home page, in the order the plan gives the funnel: the still life
 * and the promise, the Essentials (#buy holds the sets and the basket, and
 * is where an abandoned checkout returns), the plain facts, the list's
 * welcome, then the way to the clinic page. Every price and delivery figure
 * is the storefront view's; nothing is typed in.
 */
export default function Home() {
  const list = STOREFRONT.mailingList;
  const onSale = ESSENTIAL_PACKS.filter((p) => p.available);
  const cheapest = onSale.length ? Math.min(...onSale.map((p) => p.priceMinor)) : null;
  const freeFrom = STOREFRONT.delivery.freeFromMinor;
  const clinicOnSale = CLINIC_PACKS.filter((p) => p.available);
  const clinicFrom = clinicOnSale.length ? Math.min(...clinicOnSale.map((p) => p.priceMinor)) : null;
  const delivery = deliverySentences(STOREFRONT.delivery.options, freeFrom);

  return (
    <main id="main">
      <section
        aria-labelledby="hero-title"
        className="mx-auto grid max-w-6xl items-center gap-6 px-5 pb-14 pt-10 sm:px-8 md:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] md:gap-10 md:pb-20 md:pt-12 lg:gap-16"
      >
        <div className="min-w-0">
          <h1 id="hero-title" className="au-display">
            {HERO.title}
          </h1>
          <p className="au-lead mt-6 text-pretty">{HERO.lead}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a href="#essentials" className="btn-cta">
              {HERO.cta}
            </a>
            <Link href="/clinics" className="au-link inline-flex min-h-11 items-center font-semibold">
              {HERO.clinics}
            </Link>
          </div>
          {cheapest !== null ? (
            <p className="au-small mt-6">
              {HERO.from(cheapest)}
              {freeFrom !== null ? ` ${HERO.freeFrom(freeFrom)}` : ""}
            </p>
          ) : null}
        </div>
        <div className="-mx-3 sm:mx-0">
          <StillLife label={HERO.artLabel} className="mx-auto h-auto w-full max-w-[36rem]" />
        </div>
      </section>

      <section id="buy" aria-labelledby="essentials-title" className="au-sheet au-blush scroll-mt-4 px-5 py-14 sm:px-10 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div id="essentials" className="max-w-2xl scroll-mt-8">
            <h2 id="essentials-title" className="au-h2">
              {ESSENTIALS.title}
            </h2>
            <p className="au-lead mt-4">{ESSENTIALS.intro}</p>
          </div>
          <div className="mt-10 md:mt-12">
            <EssentialsPicker packs={ESSENTIAL_PACKS} />
          </div>
          <div className="mt-12 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
            <div aria-hidden="true" />
            <Basket />
          </div>
        </div>
      </section>

      <section aria-labelledby="details-title" className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14 md:py-28">
        <div>
          <h2 id="details-title" className="au-h2">
            {DETAILS.title}
          </h2>
          <p className="au-lead mt-4">{DETAILS.lead}</p>
        </div>
        <dl className="grid gap-9 sm:grid-cols-2 sm:gap-x-10">
          <div>
            <dt className="au-h3">{DETAILS.vialTerm}</dt>
            <dd className="mt-2 text-ink-soft">{DETAILS.vial}</dd>
          </div>
          <div>
            <dt className="au-h3">{DETAILS.pouchTerm}</dt>
            <dd className="mt-2 text-ink-soft">{DETAILS.pouch}</dd>
          </div>
          {delivery.length > 0 ? (
            <div>
              <dt className="au-h3">{DETAILS.deliveryTerm}</dt>
              {delivery.map((line) => (
                <dd key={line} className="mt-2 text-ink-soft">
                  {line}
                </dd>
              ))}
            </div>
          ) : null}
          <div>
            <dt className="au-h3">{DETAILS.returnsTerm}</dt>
            <dd className="mt-2 text-ink-soft">
              {DETAILS.returns}{" "}
              <Link href="/returns" className="au-link text-ink">
                {DETAILS.returnsLink}
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      {list ? (
        <section aria-labelledby="letters-title" className="au-sheet au-on-plum px-6 py-14 sm:px-12 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-14">
            <div>
              <h2 id="letters-title" className="au-h2">
                {LETTERS.title}
              </h2>
              <p className="mt-4 text-[1.1875rem] text-on-plum-soft">{LETTERS.body}</p>
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
                form: "space-y-4",
                row: "flex flex-col gap-3 sm:flex-row",
                input: "field sm:flex-1",
                button: "btn-cta shrink-0",
                consent: "text-[0.875rem] leading-relaxed text-on-plum-soft",
                link: "au-link text-on-plum",
                done: "rounded-[1rem] bg-plum-raised px-4 py-3",
              }}
            />
          </div>
        </section>
      ) : null}

      {clinicFrom !== null ? (
        <section aria-labelledby="clinics-title" className="mx-auto max-w-6xl px-3 pt-20 sm:px-8 md:pt-28">
          <div className="au-panel relative overflow-hidden px-7 py-12 sm:px-12 md:py-16">
            <MarbleVeins />
            <div className="relative max-w-2xl">
              <h2 id="clinics-title" className="au-h2">
                {CLINICS_TEASER.title}
              </h2>
              <p className="au-lead mt-4">
                {CLINICS_TEASER.body(
                  listSizes(clinicOnSale.map((p) => p.vials)),
                  clinicFrom
                )}
              </p>
              <Link href="/clinics" className="btn-secondary mt-8">
                {CLINICS_TEASER.cta}
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
