import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import {
  BUNDLES,
  DELIVERY,
  LOWEST_PRICE_BADGE,
  PRICES_UPDATED,
  PRODUCT,
  PRODUCT_IMAGES,
  STOCK_LEVEL,
  WHY_BUY,
  formatMinor,
  freeDeliveryBadge,
  nextDayBadge,
} from "@/config/funnel";
import { FAQ_PUBLISHABLE } from "@/config/faq";
import { FACTS } from "@/content/facts";
import { REVIEWS, HAS_REVIEWS, averageRating } from "@/lib/reviews";
import { canonicalOrigin } from "@/lib/site-url";
import { getPaymentConfig } from "@/lib/payments/config";
import { JsonLd } from "@/components/JsonLd";
import { FunnelStateProvider } from "@/components/funnel/FunnelState";
import { Hero } from "@/components/funnel/Hero";
import { TrustBar } from "@/components/funnel/TrustBar";
import { BuyBoxPills } from "@/components/funnel/buy/BuyBoxPills";
import { ProductMedia } from "@/components/funnel/ProductMedia";
import { ProductSpecs } from "@/components/funnel/ProductSpecs";
import { AboutProduct } from "@/components/funnel/AboutProduct";
import { PackGrid } from "@/components/products/PackGrid";
import { StickyBuyBar } from "@/components/funnel/StickyBuyBar";
import { Faq } from "@/components/funnel/Faq";
import { Reviews } from "@/components/funnel/Reviews";
import { TrustpilotReviews } from "@/components/funnel/TrustpilotReviews";
import { ComparisonTable } from "@/components/funnel/ComparisonTable";
import { PACK_PAGES } from "@/config/products";
import {
  priceValidUntil,
  productAlternateNames,
  productPropertiesSchema,
  returnPolicySchema,
  shippingDetailsFor,
} from "@/lib/product-schema";

// Nothing on this page depends on the request, so it prerenders. Keep it
// that way: adding per-request data here also makes middleware run on every
// visit (see middleware.ts).
export const dynamic = "force-static";

const SITE = canonicalOrigin();
const PRICE = formatMinor(PRODUCT.unitPriceMinor);

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function FunnelPage() {
  const cryptoEnabled = getPaymentConfig().methods.some((m) => m !== "card");

  /**
   * The product, as ONE entity with an AGGREGATE offer.
   *
   * This page used to carry every bundle Offer inline, because it was
   * the only place any of them could be bought. It still sells — but each
   * tier now also has its own page under /products carrying the Product for
   * its own SKU. Repeating those Offers here would mint every SKU twice, on
   * two URLs, and put this page into competition with the pack pages it
   * links to.
   *
   * AggregateOffer is the construct for exactly this: it states that the
   * product sells here across a price range, with a count, WITHOUT minting
   * SKU-level offers that already exist elsewhere. So:
   *
   *   this page          → Product (parent SKU) + AggregateOffer, price range
   *   /products/<pack>   → Product (tier SKU)   + one Offer, one price
   *
   * Reviews stay HERE rather than on the pack pages. They are about the
   * product, not about a quantity of it, and attaching one set of reviews to
   * every SKU would multiply a single body of feedback across all of them.
   */
  const prices = BUNDLES.map((b) => b.priceMinor);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${PRODUCT.name} ${PRODUCT.size}`,
    description: `${PRODUCT.composition} ${PRODUCT.use}`,
    sku: "baclab-10ml",
    url: SITE,
    // Google will not show a Product rich result without an image. Taken from
    // the same list the hero renders, so the photo in search is the photo on
    // the page. Omitted, not faked, while there is no photograph.
    ...(PRODUCT_IMAGES.length > 0
      ? { image: PRODUCT_IMAGES.map((i) => `${SITE}${i.src}`) }
      : {}),
    brand: { "@type": "Brand", name: brand.name },
    // The names people search by. Visible on the page ("also sold as…").
    alternateName: productAlternateNames(),
    // The technical-data rows, as PropertyValue.
    additionalProperty: productPropertiesSchema(),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "GBP",
      // Derived from the tier list, so re-pricing moves the range with it.
      // Charged prices only — the sale's struck-through reference figure is
      // presentation and never reaches structured data.
      lowPrice: (Math.min(...prices) / 100).toFixed(2),
      highPrice: (Math.max(...prices) / 100).toFixed(2),
      offerCount: BUNDLES.length,
      priceValidUntil: priceValidUntil(),
      availability:
        STOCK_LEVEL === null || STOCK_LEVEL > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      // Shipping is quoted against the cheapest tier: it is the one whose
      // rate a "from £5.99" listing would be read as describing.
      ...(shippingDetailsFor(Math.min(...prices))
        ? { shippingDetails: shippingDetailsFor(Math.min(...prices)) }
        : {}),
      hasMerchantReturnPolicy: returnPolicySchema(),
    },
    // Emitted ONLY when real reviews exist.
    ...(HAS_REVIEWS
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating(),
            reviewCount: REVIEWS.length,
          },
          review: REVIEWS.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            datePublished: r.datePublished,
            name: r.title,
            reviewBody: r.body,
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
            },
          })),
        }
      : {}),
  };

  // Only fully-answered questions are published — see config/faq.ts.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_PUBLISHABLE.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // The page as a page, so it can carry a `dateModified`. Product has no such
  // field in schema.org; WebPage does, and the date is the one recorded in
  // config when the prices last changed — not a build timestamp.
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE}/#webpage`,
    url: SITE,
    name: `${PRODUCT.name} ${PRODUCT.size}`,
    inLanguage: "en-GB",
    dateModified: PRICES_UPDATED,
    isPartOf: { "@type": "WebSite", url: SITE, name: brand.name },
    about: { "@id": `${SITE}/#organization` },
  };

  const whyBuy = WHY_BUY.filter((w) => w.title && w.body);

  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={webPageSchema} />

      {/* The sale, delivery and price-match lines that used to sit in a bar
          here are in the strip under the header (AnnouncementBanner), with
          the next-day countdown, on every storefront page. */}

      <FunnelStateProvider>
        {/* ══ 1. LANDING HERO ═══════════════════════════════════════ */}
        <Hero />

        {/* The reasons to buy here rather than elsewhere, immediately after
            the price. Placed above the specification because "is this the
            best price?" and "what is delivery?" are asked before anyone
            reads a composition line. */}
        <TrustBar />

        {/* ══ 2. PRODUCT ════════════════════════════════════════════
            Shopify style: the photo on the left with the specification
            under it, the buy box on the right. The home page sells; the
            pack pages under /products exist for search and indexing, not to
            take the sale away from here.

            The DOM is in phone order (photo, buy box, specification), so on
            a phone the details never stand between the photo and the price.
            From lg up the specification moves under the photo and the buy
            box spans both rows beside them. */}
        <section
          id="product"
          className="section scroll-mt-24 !pt-10 sm:!pt-28"
          aria-labelledby="buy-heading"
        >
          <div className="grid items-start gap-x-14 gap-y-10 lg:grid-cols-12">
            <div className="lg:col-span-6 lg:col-start-1 lg:row-start-1">
              <ProductMedia />
            </div>
            <div
              id="buy"
              className="min-w-0 scroll-mt-24 lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1"
            >
              <BuyBoxPills cryptoEnabled={cryptoEnabled} />
            </div>
            <div className="min-w-0 lg:col-span-6 lg:col-start-1 lg:row-start-2">
              <ProductSpecs />
            </div>
          </div>
        </section>

      {/* ══ 2b. THE PACK PAGES ════════════════════════════════════
          Not a second buy step — the panel above already sells. This is the
          link surface for the pages under /products, which exist to be
          indexed for the different searches the home page cannot rank for on
          its own ("bacteriostatic water 100 vials wholesale" is not
          the same query as "bacteriostatic water 10ml").

          It has to stay on the page for those URLs to be crawled at all: a
          sitemap entry is a hint, an internal link is the path. */}
      <section className="section pt-0" aria-labelledby="packs-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
          <h2 id="packs-heading" className="text-3xl sm:text-4xl">
            Every pack size in detail
          </h2>
          <p className="text-sm text-ink-soft">
            <Link href="/products" className="link">
              Compare every size
            </Link>
          </p>
        </div>
        <p className="measure mt-4 text-lg text-ink-soft">
          The same sealed {PRODUCT.size} in every pack &mdash; only the
          quantity and the price per vial change. Each size has a page of its
          own with its per-vial and per-millilitre figures, or pick one in the
          panel above to buy straight away.
        </p>
        <div className="mt-8">
          <PackGrid heading="Read more" />
        </div>
      </section>

      {/* ── What it is: the definition, after the buy section and the
          pack grid rather than in front of the price. ── */}
      <AboutProduct />

      {/* ══ 3. INFORMATION ════════════════════════════════════════
            The dark band. One big-number moment, on the fact that
            actually distinguishes this product from sterile water. */}
        <section className="bg-abyss" aria-labelledby="preservative-heading">
          <div className="shell-wide py-16 sm:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="font-display text-7xl font-bold leading-none text-cyan sm:text-8xl">
                  {FACTS.openedLimitDays}
                </p>
                <p className="mt-4 text-lg text-white/60">
                  days in use after the first puncture
                </p>
              </div>
              <div className="lg:col-span-7">
                <h2
                  id="preservative-heading"
                  className="text-3xl text-white sm:text-4xl"
                >
                  The preservative is the whole difference
                </h2>
                <p className="measure mt-5 text-lg text-white/75">
                  Sterile water contains no preservative, so once its container
                  is opened it is single-use. Bacteriostatic water contains a
                  bacteriostatic preservative, which inhibits bacterial growth
                  inside the vial after it has been entered. That is what makes
                  this a multi-dose vial rather than a single-use one.
                </p>
                <ul className="mt-8 flex flex-wrap gap-2">
                  <li className="chip-onDark">
                    Inhibits bacterial growth in the vial
                  </li>
                  <li className="chip-onDark">Multi-dose, not single-use</li>
                  <li className="chip-onDark">
                    Laboratory and research diluent
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it compares ── */}
        <section className="section" aria-labelledby="compare-heading">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id="compare-heading" className="text-3xl sm:text-4xl">
                How it compares
              </h2>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <ComparisonTable />
            </div>
          </div>
        </section>

        {/* ── Why buy from us — renders nothing until populated ── */}
        {whyBuy.length > 0 ? (
          <section className="section pt-0" aria-labelledby="why-heading">
            <h2 id="why-heading" className="text-3xl sm:text-4xl">
              Why buy from us
            </h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {whyBuy.map((w) => (
                <li
                  key={w.title}
                  className="rounded-panel border border-line bg-surface p-6"
                >
                  <h3 className="text-lg">{w.title}</h3>
                  <p className="mt-2 text-base text-ink-soft">{w.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Reviews — renders nothing until reviews.json is filled ── */}
        <Reviews />
        <TrustpilotReviews />

        {/* ══ 4. FAQ ════════════════════════════════════════════════ */}
        <section className="section" aria-labelledby="faq-heading">
          {/* Heading and links share one row so the list can take the full
              width below it, split into two columns on wider screens. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
            <h2 id="faq-heading" className="text-3xl sm:text-4xl">
              Questions
            </h2>
            <p className="text-sm text-ink-soft">
              <Link href="/faq" className="link">
                All questions
              </Link>
              <span aria-hidden="true" className="mx-2">
                &middot;
              </span>
              <Link href="/contact" className="link">
                Contact us
              </Link>
            </p>
          </div>
          <div className="mt-8">
            <Faq />
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="section pt-4" aria-labelledby="final-heading">
          <div className="surface-card px-6 py-12 text-center sm:px-12 sm:py-16">
            <h2 id="final-heading" className="text-3xl sm:text-4xl">
              Ready to order?
            </h2>
            <p className="measure mx-auto mt-4 text-lg text-ink-soft">
              {PRODUCT.name}, {PRODUCT.size}, from{" "}
              <span className="tabular">{PRICE}</span> a vial. Your delivery
              address is collected by Stripe at checkout.
            </p>
            <div className="mx-auto mt-8 max-w-xs">
              {/* The paragraph above already states "from £5.99 a vial", so
                  the button only has to say what it does. Same reason as the
                  hero CTA: #buy opens a selector, it does not buy. */}
              <a href="#buy" className="btn-cta">
                Choose your pack
              </a>
            </div>
            {/* The same claims as the hero, restated where the decision is
                actually made. Both price and delivery lines come from config,
                so this row can never outlive the policy behind it. */}
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
              {LOWEST_PRICE_BADGE ? (
                <li>
                  <a href="#guarantee" className="link">
                    {LOWEST_PRICE_BADGE}
                  </a>
                </li>
              ) : null}
              {freeDeliveryBadge() ? <li>{freeDeliveryBadge()}</li> : null}
              {nextDayBadge() ? <li>{nextDayBadge()}</li> : null}
              <li>Secure checkout by Stripe</li>
              <li>
                <Link href="/returns" className="link">
                  Returns &amp; refunds
                </Link>
              </li>
            </ul>
            {DELIVERY.dispatchLine ? (
              <p className="mt-4">{DELIVERY.dispatchLine}</p>
            ) : null}
          </div>
        </section>

        {/* Reserve room so the mobile bar never covers the footer links.
            Bumped from h-24: StickyBuyBar now has a third text line
            (the price-match badge). */}
        <div aria-hidden="true" className="h-28 lg:hidden" />
        <StickyBuyBar />
      </FunnelStateProvider>
    </>
  );
}
