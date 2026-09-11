import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import {
  BUNDLES,
  DELIVERY,
  PRICES_UPDATED,
  PRICE_MATCH_BADGE,
  PRODUCT,
  formatMinor,
  freeDeliveryBadge,
  perVialMinor,
} from "@/config/funnel";
import { PACK_PAGES, packPath } from "@/config/products";
import { cheapestPerVialBundle } from "@/lib/pack-metrics";
import { canonicalOrigin } from "@/lib/site-url";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { PackGrid } from "@/components/products/PackGrid";
import { PackLadder } from "@/components/products/PackLadder";
import { VialImage } from "@/components/funnel/VialImage";

export const dynamic = "force-static";

/**
 * The pack-size hub.
 *
 * It is the parent of the eight pack pages and the page that gives them a
 * shared home: every pack page links up to it, it links down to all eight,
 * and it carries the ItemList that tells a crawler these eight URLs are one
 * set rather than eight strays.
 *
 * NO Product ENTITY HERE. Each pack page owns the Product for its own SKU.
 * A ninth Product on the hub would be a ninth entity for a product that has
 * eight, and would compete with the pages it exists to introduce.
 *
 * Every figure is derived from config/funnel.ts.
 */

const CHEAPEST = cheapestPerVialBundle();
const SINGLE = BUNDLES.reduce((a, b) => (b.vials < a.vials ? b : a));

export const metadata: Metadata = pageMetadata({
  title: "Bacteriostatic water pack sizes",
  description: `Every pack size of ${PRODUCT.size} bacteriostatic water, from a single vial at ${formatMinor(
    SINGLE.priceMinor
  )} to ${CHEAPEST.vials} vials at ${formatMinor(
    perVialMinor(CHEAPEST)
  )} each. Compare per-vial pricing and order online.`,
  path: "/products",
});

export default function ProductsIndexPage() {
  const site = canonicalOrigin();

  /**
   * ItemList of the eight pack pages, in ladder order.
   *
   * `url` only, not embedded Product objects: each pack page already carries
   * its own Product, and repeating them here would give every SKU two
   * entities on two URLs — the exact problem this structure removes.
   */
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Bacteriostatic water pack sizes",
    numberOfItems: PACK_PAGES.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: PACK_PAGES.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${PRODUCT.name} — ${p.shortLabel}`,
      url: `${site}${packPath(p)}`,
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: brand.name, item: site },
      { "@type": "ListItem", position: 2, name: "Pack sizes", item: `${site}/products` },
    ],
  };

  const delivery = freeDeliveryBadge();

  return (
    <>
      <JsonLd data={itemListSchema} />
      <JsonLd data={breadcrumbSchema} />

      <section className="section" aria-labelledby="packs-heading">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link href="/" className="link">
                Home
              </Link>
            </li>
            <li aria-hidden="true">&rsaquo;</li>
            <li className="text-ink">Pack sizes</li>
          </ol>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="min-w-0 lg:col-span-7">
            <h1 id="packs-heading" className="text-4xl sm:text-5xl">
              Bacteriostatic water pack sizes
            </h1>
            <p className="measure mt-5 text-lg text-ink-soft">
              One product, {PRODUCT.size}s, sold in {PACK_PAGES.length} quantities.
              The vial is the same in every pack — sealed, multi-dose, and
              supplied as a laboratory and research diluent. Only the number of
              vials and the price per vial change.
            </p>
            <p className="measure mt-4 text-lg text-ink-soft">
              A single vial is {formatMinor(SINGLE.priceMinor)}. The{" "}
              {CHEAPEST.vials}-vial pack brings that down to{" "}
              <span className="tabular">{formatMinor(perVialMinor(CHEAPEST))}</span>{" "}
              a vial, which is the lowest unit price on the site.
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              {delivery ? <li>{delivery}</li> : null}
              <li>Secure checkout by Stripe</li>
              <li>
                <Link href="/#guarantee" className="link">
                  {PRICE_MATCH_BADGE}
                </Link>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-5">
            <div className="mx-auto max-w-[16rem] lg:max-w-none">
              <VialImage priority />
            </div>
          </div>
        </div>
      </section>

      {/* The cards. Each is the entry point to one pack page, and each carries
          that page's own audience line so the grid reads as eight different
          answers rather than eight prices. */}
      <section className="section pt-0" aria-labelledby="choose-heading">
        <h2 id="choose-heading" className="text-3xl sm:text-4xl">
          Choose a pack
        </h2>
        <div className="mt-8">
          <PackGrid columns={3} heading="View this pack" />
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="compare-heading">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <h2 id="compare-heading" className="text-3xl sm:text-4xl">
              Compare every size
            </h2>
            <p className="measure mt-4 text-ink-soft">
              Per-vial and per-millilitre prices for all {PACK_PAGES.length} packs,
              on one basis. Saving is measured against buying the same vials one
              at a time.
            </p>
            <p className="mt-5 text-sm text-ink-soft">
              Prices last changed {PRICES_UPDATED}.
            </p>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <PackLadder />
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="bulk-heading">
        <div className="surface-card px-6 py-12 sm:px-12 sm:py-16">
          <h2 id="bulk-heading" className="text-3xl sm:text-4xl">
            Buying at volume?
          </h2>
          <p className="measure mt-4 text-lg text-ink-soft">
            The wholesale page sets out the pack economics, the order ceiling and
            how to ask for a quote above it.
            {DELIVERY.note ? ` ${DELIVERY.note}` : ""}
          </p>
          <div className="mt-8 max-w-xs">
            <Link href="/bulk-bacteriostatic-water" className="btn-cta">
              Bulk &amp; wholesale pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
