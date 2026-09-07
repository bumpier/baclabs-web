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
  GUARANTEE,
  PRODUCT,
  STOCK_LEVEL,
  VIAL_ML,
  WHY_BUY,
  drawsPerVial,
  formatMinor,
} from "@/config/funnel";
import { FAQ_PUBLISHABLE } from "@/config/faq";
import { REVIEWS, HAS_REVIEWS, averageRating } from "@/lib/reviews";
import { canonicalOrigin } from "@/lib/site-url";
import { getPaymentConfig } from "@/lib/payments/config";
import { FunnelStateProvider } from "@/components/funnel/FunnelState";
import { Hero } from "@/components/funnel/Hero";
import { PurchaseBlock } from "@/components/funnel/PurchaseBlock";
import { StickyBuyBar } from "@/components/funnel/StickyBuyBar";
import { Faq } from "@/components/funnel/Faq";
import { Reviews } from "@/components/funnel/Reviews";
import { ComparisonTable } from "@/components/funnel/ComparisonTable";

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
    brand: { "@type": "Brand", name: brand.name },
    // Every bundle is a real, purchasable offer.
    offers: BUNDLES.map((b) => ({
      "@type": "Offer",
      name: `${b.vials} × ${PRODUCT.size}`,
      price: (b.priceMinor / 100).toFixed(2),
      priceCurrency: "GBP",
      url: `${SITE}/#buy`,
      availability:
        STOCK_LEVEL === null || STOCK_LEVEL > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
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
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
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

  const whyBuy = WHY_BUY.filter((w) => w.title && w.body);
  const bannerText = saleVisible() ? SALE.bannerText || saleLabel() : ANNOUNCEMENT;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Announcement bar. The sale line takes precedence over ANNOUNCEMENT;
          both hide the bar entirely when empty. */}
      {bannerText ? (
        <div className="border-b border-line bg-brand-tint px-4 py-2 text-center text-sm font-medium text-ink">
          {bannerText}
        </div>
      ) : null}

      <FunnelStateProvider>
        {/* ══ 1. LANDING HERO ═══════════════════════════════════════ */}
        <Hero />

        {/* ══ 2. PRODUCT ════════════════════════════════════════════
            Specification on the left, the thing that charges on the right.
            The panel is sticky on desktop so the price stays with the
            reader as they work down the specification. */}
        <section id="product" className="section scroll-mt-24" aria-labelledby="product-heading">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-12">
            <div className="min-w-0 lg:col-span-7">
              <h2 id="product-heading" className="text-3xl sm:text-4xl">
                What you are buying
              </h2>
              <p className="measure mt-4 text-lg text-ink-soft">{PRODUCT.use}</p>

              <dl className="mt-10 divide-y divide-line border-y border-line">
                <SpecRow term="Composition">{PRODUCT.composition}</SpecRow>
                <SpecRow term="Format">
                  Sealed multi-dose vial, <span className="tabular">{PRODUCT.size}</span>
                </SpecRow>
                <SpecRow term="Draws per vial">
                  <span className="tabular">{drawsPerVial(1)}</span> at 1ml, or{" "}
                  <span className="tabular">{drawsPerVial(2)}</span> at 2ml. How many you get
                  depends entirely on the volume taken each time.
                </SpecRow>
                {PRODUCT.storage ? (
                  <SpecRow term="Storage">{PRODUCT.storage}</SpecRow>
                ) : null}
                {PRODUCT.shelfLifeAfterOpening ? (
                  <SpecRow term="Once opened">{PRODUCT.shelfLifeAfterOpening}</SpecRow>
                ) : null}
              </dl>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="chip">Sterile water</span>
                <span className="chip">0.9% benzyl alcohol</span>
                <span className="chip tabular">{VIAL_ML}ml fill</span>
                <span className="chip">Sealed multi-dose</span>
              </div>
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
                  0.9%
                </p>
                {/* w/v, not v/v — see the note on PRODUCT.composition. */}
                <p className="mt-4 text-lg text-white/60">
                  benzyl alcohol, w/v &mdash; <span className="tabular">9 mg/mL</span>
                </p>
              </div>
              <div className="lg:col-span-7">
                <h2 id="preservative-heading" className="text-3xl text-white sm:text-4xl">
                  The preservative is the whole difference
                </h2>
                <p className="measure mt-5 text-lg text-white/75">
                  Sterile water contains no preservative, so once its container is opened it is
                  single-use. Bacteriostatic water contains 0.9% benzyl alcohol, which inhibits
                  bacterial growth inside the vial after it has been entered. That is what makes
                  this a multi-dose vial rather than a single-use one.
                </p>
                <ul className="mt-8 flex flex-wrap gap-2">
                  <li className="chip-onDark">Inhibits bacterial growth in the vial</li>
                  <li className="chip-onDark">Multi-dose, not single-use</li>
                  <li className="chip-onDark">Laboratory and research diluent</li>
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
                <li key={w.title} className="rounded-panel border border-line bg-surface p-6">
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
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <h2 id="faq-heading" className="text-3xl sm:text-4xl">
                Questions
              </h2>
              <p className="mt-6">
                <Link href="/contact" className="link">
                  Contact us
                </Link>
              </p>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <Faq />
            </div>
          </div>
        </section>

        {/* ── Guarantee — only with a real policy ──────────────── */}
        {GUARANTEE.body ? (
          <section id="guarantee" className="section scroll-mt-24 pt-0" aria-labelledby="guarantee-heading">
            <div className="surface-card p-8 sm:p-12">
              <h2 id="guarantee-heading" className="text-2xl">
                {GUARANTEE.title || "Our guarantee"}
              </h2>
              <p className="measure mt-4 text-base text-ink-soft">{GUARANTEE.body}</p>
            </div>
          </section>
        ) : null}

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="section pt-4" aria-labelledby="final-heading">
          <div className="surface-card px-6 py-12 text-center sm:px-12 sm:py-16">
            <h2 id="final-heading" className="text-3xl sm:text-4xl">
              Ready to order?
            </h2>
            <p className="measure mx-auto mt-4 text-lg text-ink-soft">
              {PRODUCT.name}, {PRODUCT.size}, from <span className="tabular">{PRICE}</span> a vial.
              Your delivery address is collected by Stripe at checkout.
            </p>
            <div className="mx-auto mt-8 max-w-xs">
              <a href="#buy" className="btn-cta">
                Buy now &mdash; {PRICE}
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
              <li>Secure checkout by Stripe</li>
              {DELIVERY.dispatchLine ? <li>{DELIVERY.dispatchLine}</li> : null}
              <li>
                <Link href="/returns" className="link">
                  Returns &amp; refunds
                </Link>
              </li>
            </ul>
            {DELIVERY.dispatchLine ? <p className="mt-4">{DELIVERY.dispatchLine}</p> : null}
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
function SpecRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-sm font-semibold text-ink">{term}</dt>
      <dd className="measure text-base text-ink-soft">{children}</dd>
    </div>
  );
}
