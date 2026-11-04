import { formatGbp, type PackView } from "@/lib/commerce/view";
import { HERO } from "@/brands/gym/copy/home";
import { HERO_TALL, HERO_WIDE } from "@/brands/gym/copy/images";
import { photoProps, photoSrcSet } from "./photo";

/**
 * The first screen: the box on the gym floor, full bleed, the headline
 * stacked big over the dark side of the photograph, and one button to the
 * packs. The photograph is art-directed: a tall frame on a phone, with the
 * subject in its top half and the type over the floor below it, and the wide
 * one from the md breakpoint, the subject on the right and the type on the
 * left. A hazard band closes the frame.
 *
 * The "from" line is the catalogue's: the smallest and largest pack on sale,
 * and the lowest price a vial among them. With nothing on sale it is left out.
 * A server component; the button is a plain link to #shop.
 */
export function Hero({ packs }: { packs: readonly PackView[] }) {
  const img = photoProps(HERO_WIDE, { sizes: "100vw", priority: true, className: "gym-hero-img" });
  const cheapest = packs.length > 0 ? packs.reduce((a, b) => (b.perVialMinor < a.perVialMinor ? b : a)) : null;
  const counts = packs.map((p) => p.vials);

  return (
    <section aria-labelledby="hero-heading" className="gym-hero">
      <picture className="gym-hero-media">
        <source media="(max-width: 767px)" srcSet={photoSrcSet(HERO_TALL)} sizes="100vw" width={HERO_TALL.width} height={HERO_TALL.height} />
        {/* next/image's own props (alt included), in a <picture> for the two frames. */}
        <img {...img} />
      </picture>
      <div className="gym-hero-scrim" aria-hidden="true" />
      <div className="gym-wrap gym-hero-body">
        <h1 id="hero-heading" className="gym-hero-title">
          {HERO.lines.map((line, i) => (
            <span key={line}>
              <span className="gym-hero-line" style={{ animationDelay: `${120 + i * 110}ms` }}>
                {line}
              </span>{" "}
            </span>
          ))}
        </h1>
        <p className="gym-hero-lead">
          {HERO.lead}
          {cheapest ? (
            <>
              {" "}
              <strong>{HERO.from(Math.min(...counts), Math.max(...counts), formatGbp(cheapest.perVialMinor))}</strong>
            </>
          ) : null}
        </p>
        <a id="hero-cta" href="#shop" className="gym-btn gym-btn-hazard gym-btn-lg">
          {HERO.cta}
        </a>
      </div>
      <div className="gym-tape" aria-hidden="true" />
    </section>
  );
}
