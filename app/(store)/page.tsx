import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import {
  ANNOUNCEMENT,
  SALE,
  saleLabel,
  saleVisible,
  BUNDLES,
  DELIVERY,
  LOWEST_PRICE_BADGE,
  PRICE_MATCH_BADGE,
  PRICES_UPDATED,
  PRODUCT,
  PRODUCT_IMAGES,
  STOCK_LEVEL,
  WHY_BUY,
  drawsPerVial,
  formatMinor,
  freeDeliveryBadge,
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
import { PurchaseBlock } from "@/components/funnel/PurchaseBlock";
import { StickyBuyBar } from "@/components/funnel/StickyBuyBar";
import { Faq } from "@/components/funnel/Faq";
import { Reviews } from "@/components/funnel/Reviews";
import { ComparisonTable } from "@/components/funnel/ComparisonTable";
import { TechnicalData } from "@/components/funnel/TechnicalData";
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
  const methods = getPaymentConfig().methods;
  const cryptoEnabled = methods.some((m) => m !== "card");

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
    // Every bundle is a real, purchasable offer. Each carries its own shipping
    // rate (free at or over the threshold, charged below it) and the returns
    // policy, which is what the "delivery · returns" line under a result
    // reads from.
    offers: BUNDLES.map((b) => ({
      "@type": "Offer",
      name: `${b.vials} × ${PRODUCT.size}`,
      // The same SKU Stripe and the packing slip use, so a machine reader
      // can tell the eight offers apart without parsing `name`.
      sku: b.sku,
      // The charged price only. The sale's struck-through reference figure
      // is presentation and never reaches structured data.
      price: (b.priceMinor / 100).toFixed(2),
      priceCurrency: "GBP",
      priceValidUntil: priceValidUntil(),
      url: `${SITE}/#buy`,
      itemCondition: "https://schema.org/NewCondition",
      availability:
        STOCK_LEVEL === null || STOCK_LEVEL > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      ...(shippingDetailsFor(b.priceMinor)
        ? { shippingDetails: shippingDetailsFor(b.priceMinor) }
        : {}),
      hasMerchantReturnPolicy: returnPolicySchema(),
    })),
    // AggregateRating and Review are emitted ONLY when real reviews exist.
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
  const bannerText = saleVisible()
    ? SALE.bannerText || saleLabel()
    : ANNOUNCEMENT;

  // The announcement bar now carries up to three lines rather than one. Each
  // is dropped when its source config goes empty, so the bar shortens to two,
  // to one, or vanishes entirely without any of them needing a guard here.
  const bannerParts = [
    bannerText,
    freeDeliveryBadge(),
    PRICE_MATCH_BADGE,
  ].filter(Boolean);

  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={webPageSchema} />

      {/* Announcement bar. The sale line takes precedence over ANNOUNCEMENT,
          and sits alongside the delivery and price-match lines. The whole bar
          disappears when every part resolves empty.

          The third part is hidden below `sm`: on a narrow phone three parts
          wrap to two lines and push the hero down, and the price-match claim
          is the one already repeated in the hero, the trust bar and the buy
          bar — so it is the one that can afford to go. */}
      {bannerParts.length > 0 ? (
        <div className="border-b border-line bg-brand-tint px-4 py-2 text-sm font-medium text-ink">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {bannerParts.map((part, i) => (
              <li
                key={part}
                // `hidden sm:flex` rather than `flex hidden sm:flex`: two
                // display utilities on one element resolve by stylesheet
                // order, not by the order they are written here, so the
                // conditional supplies the base display itself.
                className={[
                  i > 1 ? "hidden sm:flex" : "flex",
                  "items-center gap-3",
                ].join(" ")}
              >
                {i > 0 ? (
                  <span aria-hidden="true" className="text-ink-soft">
                    &middot;
                  </span>
                ) : null}
                {part}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <FunnelStateProvider>
        {/* ══ 1. LANDING HERO ═══════════════════════════════════════ */}
        <Hero />

        {/* The reasons to buy here rather than elsewhere, immediately after
            the price. Placed above the specification because "is this the
            best price?" and "what is delivery?" are asked before anyone
            reads a composition line. */}
        <TrustBar />

        {/* ── The definition, in one quotable paragraph ────────────
            The only plain-English definition used to sit in a collapsed FAQ
            item below three other sections. This is the passage an answer
            engine lifts and a first-time visitor reads before the price
            ladder: definition, mechanism, the "not a steriliser" caveat and
            the laboratory-only use, in that order. Every figure is read from
            content/facts.ts. The heading is a question because that is the
            query it answers. */}
        <section className="section pb-0" aria-labelledby="what-heading">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <h2 id="what-heading" className="text-3xl sm:text-4xl">
                What is bacteriostatic water?
              </h2>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <p className="measure text-lg text-ink-soft" data-explainer>
                Bacteriostatic water is sterile, purified water to which a
                bacteriostatic preservative has been added. It is supplied in a
                sealed multi-dose vial with a rubber stopper and a crimped
                collar. The preservative inhibits the growth of
                bacteria that may enter the vial once the stopper has been
                punctured, which is why the same vial can be entered more than
                once, for up to {FACTS.openedLimit}. Plain sterile water
                contains no preservative and is single-use once opened; that one
                ingredient is the whole difference between the two. The
                preservative is bacteriostatic, not bactericidal: it slows
                bacterial growth but does not sterilise the contents and cannot
                make a contaminated vial safe. It is used as a diluent and
                solvent to dissolve or dilute substances in laboratory and
                research work, and has no activity of its own. It is not a
                medicine.
              </p>
              <p className="mt-5 text-sm text-ink-soft">
                <Link
                  href="/guides/what-is-bacteriostatic-water"
                  className="link"
                >
                  Read the full guide
                </Link>
                {" · "}
                <Link
                  href="/guides/bacteriostatic-water-vs-sterile-water"
                  className="link"
                >
                  How it compares with sterile water and saline
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* ══ 2. PRODUCT ════════════════════════════════════════════
            Specification on the left, the thing that charges on the right.
            The panel is sticky on desktop so the price stays with the
            reader as they work down the specification. */}
        <section
          id="product"
          className="section scroll-mt-24"
          aria-labelledby="product-heading"
        >
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-12">
            <div className="min-w-0 lg:col-span-7">
              <h2 id="product-heading" className="text-3xl sm:text-4xl">
                What you are buying
              </h2>
              <p className="measure mt-4 text-lg text-ink-soft">
                {PRODUCT.use}
              </p>

              <dl className="mt-10 divide-y divide-line border-y border-line">
                <SpecRow term="Composition">{PRODUCT.composition}</SpecRow>
                <SpecRow term="Format">
                  Sealed multi-dose vial,{" "}
                  <span className="tabular">{PRODUCT.size}</span>
                </SpecRow>
                <SpecRow term="Draws per vial">
                  <span className="tabular">{drawsPerVial(1)}</span> at 1ml, or{" "}
                  <span className="tabular">{drawsPerVial(2)}</span> at 2ml. How
                  many you get depends entirely on the volume taken each time.
                </SpecRow>
                {PRODUCT.storage ? (
                  <SpecRow term="Storage">{PRODUCT.storage}</SpecRow>
                ) : null}
                {PRODUCT.shelfLifeAfterOpening ? (
                  <SpecRow term="Once opened">
                    {PRODUCT.shelfLifeAfterOpening}
                  </SpecRow>
                ) : null}
              </dl>

              {/* The reference rows a laboratory buyer checks — CAS numbers,
                  formula, appearance, hazard class — behind a disclosure so
                  the specification above stays the thing you read. Closed
                  by default; the rows are still in the HTML, so a search
                  engine reads them either way. Only rows the list above does
                  not already state are in here. */}
              <details
                id="technical-data"
                className="group mt-8 scroll-mt-24 rounded-panel border border-line bg-surface open:border-brand/35"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left [&::-webkit-details-marker]:hidden sm:px-6">
                  <span className="text-base font-semibold text-ink">
                    Full technical data
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 transition-transform duration-200 group-open:rotate-45"
                    style={{ transitionTimingFunction: "var(--ease-out)" }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 1v14M1 8h14"
                        stroke="var(--color-primary)"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="border-t border-line">
                  <TechnicalData />
                </div>
              </details>
            </div>

            {/* ── The purchase block ── */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <h3 id="buy-heading" className="sr-only">
                  Buy {PRODUCT.name}
                </h3>
                <div id="buy" className="scroll-mt-24">
                  <PurchaseBlock cryptoEnabled={cryptoEnabled} />
                </div>
              </div>
            </div>
          </div>
        </section>

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
              <a href="#buy" className="btn-cta">
                Buy now &mdash; {PRICE}
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
              <li>Secure checkout by Stripe</li>
              {DELIVERY.dispatchLine ? <li>{DELIVERY.dispatchLine}</li> : null}
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

/** One row of the specification list. */
function SpecRow({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-sm font-semibold text-ink">{term}</dt>
      <dd className="measure text-base text-ink-soft">{children}</dd>
    </div>
  );
}
