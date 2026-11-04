import { withStockLevel } from "@/lib/commerce/storefront";
import { Hero } from "@/brands/gym/components/Hero";
import { ShopGrid } from "@/brands/gym/components/ShopGrid";
import { CostStrip } from "@/brands/gym/components/CostStrip";
import { TrustRow } from "@/brands/gym/components/TrustRow";
import { Faq } from "@/brands/gym/components/Faq";
import { RestockBand } from "@/brands/gym/components/RestockBand";
import { StickyBar } from "@/brands/gym/components/StickyBar";
import { STOREFRONT } from "./site";

/** The pack the phone's bar offers first: the 10, or the smallest on sale. */
const BAR_VIALS = 10;

/**
 * Brute Lab's home page, which is the whole shop, laid out the way a sports
 * nutrition store is: the photograph hero with one button, SHOP THE STACK
 * (a card per pack with quick add), the price a vial, what's true about
 * delivery and returns, straight answers, the restock list when the brand
 * runs one. The cart is the slide-out drawer in the layout. On a phone the
 * sticky add-to-cart bar follows once the hero's button has gone.
 *
 * Prerendered from the storefront view, and revalidated with the layout
 * (every five minutes), when withStockLevel reads the shared vial count: the
 * grid says stock is low only while the admin's own count is really low,
 * never with a figure, a countdown or a restock date. At build time there is
 * no real count, and the line stays off.
 */
export default async function Home() {
  const view = await withStockLevel(STOREFRONT);
  const onSale = view.packs.filter((p) => p.available);
  const barPack = onSale.find((p) => p.vials === BAR_VIALS) ?? onSale[0] ?? null;
  const list = view.mailingList;

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <Hero packs={onSale} />
      <ShopGrid view={view} />
      <CostStrip view={view} />
      <TrustRow view={view} />
      <Faq view={view} />
      {list ? <RestockBand consentText={list.consentText} /> : null}
      <StickyBar defaultSku={barPack?.sku ?? null} />
    </main>
  );
}
