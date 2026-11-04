import type { CSSProperties } from "react";
import Link from "next/link";
import { SignupForm } from "@/components/commerce/SignupForm";
import { Gallery } from "@/brands/beauty/components/Gallery";
import { Photo } from "@/brands/beauty/components/Photo";
import { Mark, SealedLine } from "@/brands/beauty/components/Wordmark";
import { PlusIcon } from "@/brands/beauty/components/icons";
import { CLINICS_TEASER, DETAILS, ESSENTIALS, HERO, LETTERS, RITUAL, deliverySentences, listSizes, sizeWords } from "@/brands/beauty/copy/home";
import { IMAGES } from "@/brands/beauty/copy/images";
import { ProductPanel } from "./ProductPanel";
import { CLINIC_PACKS, ESSENTIAL_PACKS, STOREFRONT } from "./site";

/**
 * The home page, in the order of a shop that is also a still life: the
 * promise on the photograph; the Essentials as a product page (#buy is
 * where an unfinished checkout returns, #essentials where the links land),
 * its gallery beside its purchase panel; the ritual, as an editorial spread;
 * the plain facts; the list's welcome; the way to the clinic page. Every
 * price and delivery figure is the storefront view's; nothing is typed in.
 */
export default function Home() {
  const list = STOREFRONT.mailingList;
  const onSale = ESSENTIAL_PACKS.filter((p) => p.available);
  const single = onSale.find((p) => p.vials === 1) ?? null;
  const clinicOnSale = CLINIC_PACKS.filter((p) => p.available);
  const delivery = deliverySentences(STOREFRONT.delivery.options, STOREFRONT.delivery.freeFromMinor);
  const [lineOne, lineTwo] = HERO.title.split(", ");

  return (
    <main id="main">
      {/* ── The promise, on the still life ─────────────────────────── */}
      {/* Below 640px the 3:2 photograph fills a 4:5 frame by its height, so it is drawn 1.875 times the frame's width. */}
      <section aria-labelledby="hero-title" className="relative px-2.5 pt-1 md:px-5">
        <div className="au-hero-media au-arrive-media">
          <Photo
            image={IMAGES.stillLife}
            fill
            priority
            sizes="(min-width: 768px) calc(100vw - 2.5rem), (min-width: 640px) calc(100vw - 1.25rem), calc((100vw - 1.25rem) * 1.875)"
            className="object-[70%_50%] sm:object-center xl:object-[50%_62%]"
          />
        </div>
        <div className="xl:absolute xl:inset-y-0 xl:left-5 xl:flex xl:items-start">
          <div className="px-3 pt-9 sm:px-6 xl:max-w-[50rem] xl:px-[clamp(3rem,5vw,6rem)] xl:pt-[clamp(3.5rem,11vh,6.5rem)]">
            <h1 id="hero-title" className="au-display">
              <span className="au-arrive block" style={{ "--i": 0 } as CSSProperties}>
                {lineOne},
              </span>
              <span className="au-arrive block" style={{ "--i": 1 } as CSSProperties}>
                <SealedLine text={lineTwo ?? ""} sealClassName="au-arrive-seal" />
              </span>
            </h1>
            <p className="au-lead au-arrive mt-6 xl:max-w-[27rem]" style={{ "--i": 2 } as CSSProperties}>
              {HERO.lead(sizeWords(onSale.map((p) => p.vials)))}
            </p>
            <div className="au-arrive mt-9 flex flex-wrap items-center gap-x-7 gap-y-4" style={{ "--i": 3 } as CSSProperties}>
              <a href="#essentials" className="btn-cta">
                {HERO.cta}
              </a>
              <Link href="/clinics" className="au-link inline-flex min-h-11 items-center font-semibold">
                {HERO.clinics}
              </Link>
            </div>
            {single ? (
              <p className="au-small au-arrive mt-6" style={{ "--i": 4 } as CSSProperties}>
                {HERO.from(single.priceMinor)}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── The Essentials: gallery and purchase panel ─────────────── */}
      <section id="buy" aria-labelledby="essentials-title" className="au-wrap pt-20 lg:pt-32">
        <div id="essentials" className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 xl:gap-20">
          <Gallery />
          <ProductPanel packs={ESSENTIAL_PACKS}>
            <details className="au-fold">
              <summary>
                {ESSENTIALS.deliveryTitle}
                <PlusIcon />
              </summary>
              <div className="au-small space-y-2 pb-5">
                {delivery.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </details>
            <details className="au-fold">
              <summary>
                {ESSENTIALS.returnsTitle}
                <PlusIcon />
              </summary>
              <p className="au-small pb-5">
                {ESSENTIALS.returns}{" "}
                <Link href="/returns" className="au-link text-ink">
                  {ESSENTIALS.returnsLink}
                </Link>
              </p>
            </details>
          </ProductPanel>
        </div>
      </section>

      {/* ── The ritual: an editorial spread ────────────────────────── */}
      <section id="ritual" aria-labelledby="ritual-title" className="au-wrap pt-28 lg:pt-40">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-16">
          <div className="lg:col-span-5">
            <div className="au-frame aspect-[4/5] lg:aspect-[2/3]">
              <Photo image={IMAGES.vanity} fill sizes="(min-width: 1024px) 38vw, 100vw" />
            </div>
          </div>
          <div className="lg:col-span-7 lg:pt-10">
            <h2 id="ritual-title" className="au-h2">
              {RITUAL.title}
            </h2>
            <p className="au-voice mt-6 max-w-[34rem]">{RITUAL.voice}</p>
            <div className="mt-12 grid gap-12 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] sm:items-end lg:mt-16">
              <div>
                <ol className="space-y-8">
                  {RITUAL.moments.map((m, i) => (
                    <li key={m.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
                      <span className="au-caption pt-1" aria-hidden="true">
                        {["i.", "ii.", "iii."][i]}
                      </span>
                      <div>
                        <h3 className="au-h3">{m.title}</h3>
                        <p className="au-small mt-2">{m.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-9 pl-[2.75rem]">
                  <a href="#essentials" className="au-link font-semibold">
                    {RITUAL.cta}
                  </a>
                </p>
              </div>
              <figure>
                <div className="au-frame aspect-[3/4]">
                  <Photo image={IMAGES.hands} fill sizes="(min-width: 1024px) 24vw, (min-width: 640px) 40vw, 100vw" />
                </div>
                <figcaption className="au-caption mt-3">{RITUAL.caption}</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ── Kept simple: the plain facts ───────────────────────────── */}
      <section aria-labelledby="details-title" className="au-sheet au-blush mt-28 px-6 py-16 sm:px-12 lg:mt-40 lg:py-24">
        <div className="mx-auto grid max-w-[74rem] gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <div>
            <h2 id="details-title" className="au-h2">
              {DETAILS.title}
            </h2>
            <p className="au-lead mt-4">{DETAILS.lead}</p>
          </div>
          <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {[
              [DETAILS.vialTerm, DETAILS.vial],
              [DETAILS.capTerm, DETAILS.cap],
              [DETAILS.pouchTerm, DETAILS.pouch],
              [DETAILS.sentTerm, DETAILS.sent],
            ].map(([term, text]) => (
              <div key={term}>
                <dt className="au-h3">{term}</dt>
                <dd className="mt-2 text-ink-soft">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Letters from Aurelle ───────────────────────────────────── */}
      {list ? (
        <section aria-labelledby="letters-title" className="au-sheet au-on-plum mt-6 px-6 py-14 sm:px-12 md:mt-8 md:py-20">
          <div className="mx-auto grid max-w-[74rem] items-center gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <Mark className="h-10 w-10 text-rose-light" />
              <h2 id="letters-title" className="au-h2 mt-5">
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

      {/* ── For clinics and salons ─────────────────────────────────── */}
      {clinicOnSale.length > 0 ? (
        <section aria-labelledby="clinics-title" className="au-wrap pt-28 lg:pt-36">
          <div className="au-panel grid overflow-hidden md:grid-cols-2">
            <div className="relative aspect-[3/2] md:aspect-auto md:min-h-[26rem]">
              <Photo image={IMAGES.clinicCounter} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-[40%_50%]" />
            </div>
            <div className="flex flex-col justify-center px-7 py-10 sm:px-12 md:py-14">
              <h2 id="clinics-title" className="au-h2">
                {CLINICS_TEASER.title}
              </h2>
              <p className="au-lead mt-4">{CLINICS_TEASER.body(listSizes(clinicOnSale.map((p) => p.vials)))}</p>
              <div className="mt-8">
                <Link href="/clinics" className="btn-secondary">
                  {CLINICS_TEASER.cta}
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
