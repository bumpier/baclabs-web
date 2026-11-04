import Link from "next/link";
import { Seal } from "@/brands/luxury/components/Marks";
import { artDirected, photoProps } from "@/brands/luxury/components/photo";
import { CHAPTERS, CONCIERGE_BAND, HERO, PRODUCT } from "@/brands/luxury/copy/home";
import { CHAPTER_ARRIVAL, CHAPTER_BOX, CHAPTER_HANDS, GALLERY, HERO_TALL, HERO_WIDE } from "@/brands/luxury/copy/images";
import { serviceFacts } from "@/brands/luxury/service";
import { Gallery } from "./Gallery";
import { Purchase } from "./Purchase";
import { brand, STOREFRONT } from "./site";

/**
 * The house's one page of commerce, set like a maison's product page.
 *
 *  1. The hero: the box in a photograph the width of the screen, and one
 *     line over it.
 *  2. The product (#buy, where an unfinished payment returns): a column of
 *     tall photographs (box closed, box open with the vial, the seal and
 *     card, the vial itself) beside a sticky purchase column. On a phone
 *     the photographs become a strip to swipe, above the column.
 *  3. Three chapters (#house), photograph and short text in turn, the width
 *     of the page: the box, the packing, the arrival.
 *  4. The concierge, then the footer.
 *
 * Delivery is the catalogue's, through brands/luxury/service.ts. Left out
 * on purpose: promotions, codes, popups, plans and any countdown.
 */
export default function Home() {
  const facts = serviceFacts(STOREFRONT);
  const hero = artDirected(HERO_WIDE, HERO_TALL, "100vw");
  const gallery = GALLERY.map((p) => photoProps(p, { sizes: "(min-width: 960px) 52vw, 86vw" }));
  const half = "(min-width: 960px) 60vw, 100vw";

  return (
    <main id="main">
      <section aria-labelledby="hero-heading" className="rv-hero">
        <picture>
          <source media={hero.media} srcSet={hero.srcSet} sizes="100vw" />
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/image's attributes, alt included (components/photo.ts) */}
          <img {...hero.img} className="rv-hero__img" />
        </picture>
        <div className="rv-hero__copy">
          <h1 id="hero-heading" className="rv-hero__heading">
            {HERO.heading}
          </h1>
          <a href="#buy" className="rv-hero__action">
            {HERO.action}
          </a>
        </div>
      </section>

      <section id="buy" aria-labelledby="product-name" className="rv-product">
        <Gallery photos={gallery} />
        <div className="rv-product__column">
          <Purchase brandName={brand.name}>
            {facts ? (
              <ul className="rv-service" aria-label={PRODUCT.service.label}>
                <li>{PRODUCT.service.delivery(facts)}</li>
                <li>{PRODUCT.service.carrier(facts)}</li>
                <li>
                  {PRODUCT.service.returns}{" "}
                  <Link href="/returns" className="rv-link">
                    {PRODUCT.service.returnsLink}
                  </Link>
                </li>
              </ul>
            ) : null}
            <div className="rv-details">
              <details>
                <summary>{PRODUCT.details.vial.title}</summary>
                <p>{PRODUCT.details.vial.body}</p>
              </details>
              <details>
                <summary>{PRODUCT.details.box.title}</summary>
                <p>{PRODUCT.details.box.body(brand.name)}</p>
              </details>
            </div>
          </Purchase>
        </div>
      </section>

      <div id="house" className="rv-chapters">
        <section aria-labelledby="chapter-box" className="rv-chapter rv-chapter--left">
          <figure className="rv-chapter__photo">
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/image's attributes, alt included */}
            <img {...photoProps(CHAPTER_BOX, { sizes: half })} className="rv-reveal" />
          </figure>
          <div className="rv-chapter__text">
            <h2 id="chapter-box" className="rv-chapter__title">
              {CHAPTERS.box.title}
            </h2>
            <p>{CHAPTERS.box.body(brand.name)}</p>
          </div>
        </section>

        <section aria-labelledby="chapter-hands" className="rv-chapter rv-chapter--right rv-chapter--claret">
          <div className="rv-chapter__text">
            <h2 id="chapter-hands" className="rv-chapter__title">
              {CHAPTERS.hands.title}
            </h2>
            <p>{CHAPTERS.hands.body}</p>
          </div>
          <figure className="rv-chapter__photo">
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/image's attributes, alt included */}
            <img {...photoProps(CHAPTER_HANDS, { sizes: half })} className="rv-reveal" />
          </figure>
        </section>

        {facts ? (
          <section aria-labelledby="chapter-arrival" className="rv-chapter rv-chapter--full">
            <figure className="rv-chapter__photo">
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/image's attributes, alt included */}
              <img {...photoProps(CHAPTER_ARRIVAL, { sizes: "100vw" })} className="rv-reveal" />
            </figure>
            <div className="rv-chapter__text">
              <h2 id="chapter-arrival" className="rv-chapter__title">
                {CHAPTERS.arrival.title}
              </h2>
              <p>{CHAPTERS.arrival.body(facts)}</p>
              <p className="rv-chapter__aside">{CHAPTERS.arrival.days}</p>
            </div>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="concierge-heading" className="rv-concierge">
        <Seal className="rv-concierge__seal" />
        <h2 id="concierge-heading" className="rv-concierge__title">
          {CONCIERGE_BAND.title}
        </h2>
        <p className="rv-concierge__body">{CONCIERGE_BAND.body}</p>
        <Link href="/contact" className="rv-button rv-button--bone">
          {CONCIERGE_BAND.action}
        </Link>
      </section>
    </main>
  );
}
