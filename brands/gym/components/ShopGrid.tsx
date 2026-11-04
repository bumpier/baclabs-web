import Link from "next/link";
import { formatGbp, packSavingMinor, type StorefrontView } from "@/lib/commerce/view";
import { SHOP } from "@/brands/gym/copy/home";
import { PACKSHOTS } from "@/brands/gym/copy/images";
import { photoProps } from "./photo";
import { QuickAdd } from "./QuickAdd";

/**
 * SHOP THE STACK (#shop): one card per pack in the catalogue, smallest
 * first. Each card is the packshot with the count stencilled over it, the
 * title and a line of banter, the price, the price a vial and what the pack
 * saves against the smallest pack on sale (packSavingMinor), and a quick-add
 * button straight into the cart. Nothing is typed here: change a price in
 * brands/gym/catalogue.ts and every figure follows. The pack with the lowest
 * price a vial is tagged so, from the same figures.
 *
 * Four across from the lg breakpoint, two from md; on a phone a sideways
 * scroller that snaps card by card, the next card peeking in.
 *
 * The low-stock line shows only while the view says the shared vial count is
 * really low (withStockLevel). It names no figure and no date.
 */
export function ShopGrid({ view }: { view: StorefrontView }) {
  const packs = view.packs;
  if (packs.length === 0) return null;
  const onSale = packs.filter((p) => p.available);
  const base = onSale[0] ?? null;
  const lowest = onSale.length > 1 ? onSale.reduce((a, b) => (b.perVialMinor < a.perVialMinor ? b : a)) : null;
  const anySaving = onSale.some((p) => packSavingMinor(view, p) > 0);

  return (
    <section id="shop" aria-labelledby="shop-heading" className="gym-shop">
      <div className="gym-wrap">
        <div className="gym-section-head">
          <h2 id="shop-heading" className="gym-h2">
            {SHOP.heading}
          </h2>
          <div className="gym-section-aside">
            <p className="gym-lead">{SHOP.lead}</p>
            {view.stock.low ? (
              <p className="gym-low">
                <span className="gym-low-dot" aria-hidden="true" />
                {SHOP.low}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="gym-grid" aria-label={SHOP.heading}>
        {packs.map((pack) => {
          const photo = PACKSHOTS[pack.vials];
          const saving = pack.available ? packSavingMinor(view, pack) : 0;
          const price = formatGbp(pack.priceMinor);
          const tag = pack.label || (lowest && pack.sku === lowest.sku ? SHOP.lowest : "");
          const tagline = SHOP.taglines[pack.vials];
          return (
            <li key={pack.sku} className="gym-card">
              <article aria-labelledby={`card-${pack.sku}`} className="gym-card-inner">
                <div className="gym-card-media">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- next/image's props, made-ahead copies (./photo.ts)
                    <img {...photoProps(photo, { sizes: "(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 80vw", className: "gym-card-img" })} />
                  ) : null}
                  <p className="gym-card-count" aria-hidden="true">
                    <span className="gym-card-n">{pack.vials}</span>
                    <span className="gym-card-unit">{SHOP.unit(pack.vials)}</span>
                  </p>
                  {tag ? <p className="gym-card-tag">{tag}</p> : null}
                </div>
                <div className="gym-card-body">
                  <h3 id={`card-${pack.sku}`} className="gym-card-title">
                    {SHOP.title(pack.vials)}
                  </h3>
                  {tagline ? <p className="gym-card-line">{tagline}</p> : null}
                  {pack.available ? (
                    <>
                      <p className="gym-card-price">
                        <span className="gym-price">{price}</span>
                        <span className="gym-per">{SHOP.perVial(formatGbp(pack.perVialMinor))}</span>
                      </p>
                      <p className="gym-card-save">{saving > 0 ? <span className="gym-save">{SHOP.save(formatGbp(saving))}</span> : null}</p>
                      <QuickAdd sku={pack.sku} vials={pack.vials} label={SHOP.add} detail={SHOP.addDetail(pack.vials, price)} />
                    </>
                  ) : (
                    <>
                      <p className="gym-card-price">
                        <span className="gym-price">{SHOP.offline}</span>
                      </p>
                      <p className="gym-card-save" />
                      <Link href="/contact" className="gym-btn gym-btn-ghost-ink gym-btn-block">
                        {SHOP.quote}
                      </Link>
                    </>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <div className="gym-wrap">
        <p className="gym-swipe" aria-hidden="true">
          {SHOP.swipe}
        </p>
        {anySaving && base ? <p className="gym-basis">{SHOP.basis(base.vials)}</p> : null}
      </div>
    </section>
  );
}
