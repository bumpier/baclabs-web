import { formatGbp, type PackView } from "@/lib/commerce/view";
import { HERO, LADDER } from "@/brands/gym/copy/home";
import { HeroBuyButton } from "./HeroBuyButton";

/**
 * The first screen is the offer itself, set as big as it will go: "10
 * vials. £49.99. Done." The count and the price are the catalogue's (the
 * page picks the pack), the price in the stencil face and the hazard orange,
 * and the one button beside it buys exactly that.
 *
 * A server component: only the button is client code. With no pack on sale
 * there is no price to lead with, so the headline is the ladder's own and
 * there is no button (an empty catalogue renders no offer).
 */
export function Hero({ pack, freeOption }: { pack: PackView | null; freeOption: string | null }) {
  const price = pack ? formatGbp(pack.priceMinor) : null;
  return (
    <section aria-labelledby="hero-heading" className="gym-hero gym-rubber">
      <div className="gym-wrap gym-hero-grid">
        <h1 id="hero-heading" className="gym-hero-title">
          {pack && price ? (
            <>
              <span className="gym-hero-line">{HERO.count(pack.vials)}</span>{" "}
              <span className="gym-hero-line gym-hero-price">{HERO.price(price)}</span>{" "}
              <span className="gym-hero-line">{HERO.done}</span>
            </>
          ) : (
            <span className="gym-hero-line">{LADDER.heading}</span>
          )}
        </h1>

        <div className="gym-hero-aside">
          <p className="gym-hero-lead">{HERO.lead}</p>
          {pack && price ? (
            <div className="mt-6">
              <HeroBuyButton sku={pack.sku} label={HERO.add(pack.vials)} price={price} />
              {freeOption ? <p className="gym-hero-note">{HERO.freeDelivery(freeOption)}</p> : null}
            </div>
          ) : null}
          <p className="mt-5">
            <a href="#packs" className="gym-link-strong">
              {HERO.morePacks}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
