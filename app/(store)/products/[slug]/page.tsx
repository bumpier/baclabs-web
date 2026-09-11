import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand";
import {
  MAX_QUANTITY,
  PRICES_UPDATED,
  PRODUCT,
  PRODUCT_IMAGES,
  STOCK_LEVEL,
  formatMinor,
  saleVisible,
  saleLabel,
} from "@/config/funnel";
import { PACK_PAGES, bundleForPack, packBySlug, packPath, type PackPage } from "@/config/products";
import { metricsFor, packLabel, type PackMetrics } from "@/lib/pack-metrics";
import { FACTS } from "@/content/facts";
import { canonicalOrigin } from "@/lib/site-url";
import { getPaymentConfig } from "@/lib/payments/config";
import { pageMetadata } from "@/lib/seo";
import {
  priceValidUntil,
  productAlternateNames,
  productPropertiesSchema,
  returnPolicySchema,
  shippingDetailsFor,
} from "@/lib/product-schema";
import { JsonLd } from "@/components/JsonLd";
import { FunnelStateProvider } from "@/components/funnel/FunnelState";
import { VialImage } from "@/components/funnel/VialImage";
import { StickyBuyBar } from "@/components/funnel/StickyBuyBar";
import { PackBuy } from "@/components/products/PackBuy";
import { PackLadder } from "@/components/products/PackLadder";
import {
  CheaperAlternatives,
  PackCrumbs,
  PackDelivery,
  PackFaqs,
  PackSaving,
  PackSpec,
  PackStats,
  PackUnitEconomics,
  RelatedPacks,
} from "@/components/products/PackSections";

/**
 * One indexable page per bundle tier.
 *
 * WHY THESE ARE NOT DUPLICATES. Several URLs describing one vial is a
 * duplicate-content problem unless each page answers a different search and
 * says something the others do not. Three things keep them apart:
 *
 *  1. Each carries its own `query`, `lede`, `audience` and `angles` from
 *     config/products.ts — written for that quantity, not templated.
 *  2. Each renders one of FOUR page shapes (see `variant` below), which
 *     differ in which sections exist and in what order they run. The
 *     stock-up pages open on the price ladder; the wholesale pages open on
 *     unit economics; the starter page opens on what one vial gives you.
 *  3. Each emits ONE Offer, its own SKU, at its own canonical URL — rather
 *     than every page claiming every offer.
 *
 * The home page no longer carries the multi-offer Product entity, so there is
 * exactly one canonical page per purchasable SKU on the site.
 *
 * Static: the registry is a compile-time constant and nothing here reads the
 * request, so they all prerender.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return PACK_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = packBySlug(slug);
  if (!pack) return {};

  return pageMetadata({
    title: pack.metaTitle,
    description: pack.metaDescription,
    path: packPath(pack),
  });
}

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = packBySlug(slug);
  if (!pack) notFound();

  const bundle = bundleForPack(pack);
  const m = metricsFor(bundle);
  const site = canonicalOrigin();
  const url = `${site}${packPath(pack)}`;
  const cryptoEnabled = getPaymentConfig().methods.some((x) => x !== "card");

  /**
   * ONE Product, ONE Offer — this pack's SKU at this pack's URL.
   *
   * The tiers are each a purchasable SKU of one product, and each now
   * has a page of its own, so each page describes its own SKU. That is what
   * lets a merchant listing for "100 vials" point at the 100-vial page rather
   * than at a funnel where the reader has to find the tier themselves.
   */
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${PRODUCT.name} — ${packLabel(bundle)}`,
    description: pack.metaDescription,
    sku: bundle.sku,
    url,
    ...(PRODUCT_IMAGES.length > 0
      ? { image: PRODUCT_IMAGES.map((i) => `${site}${i.src}`) }
      : {}),
    brand: { "@type": "Brand", name: brand.name },
    alternateName: productAlternateNames(),
    additionalProperty: productPropertiesSchema(),
    offers: {
      "@type": "Offer",
      name: packLabel(bundle),
      sku: bundle.sku,
      price: (bundle.priceMinor / 100).toFixed(2),
      priceCurrency: "GBP",
      priceValidUntil: priceValidUntil(),
      url,
      itemCondition: "https://schema.org/NewCondition",
      availability:
        STOCK_LEVEL === null || STOCK_LEVEL > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      ...(shippingDetailsFor(bundle.priceMinor)
        ? { shippingDetails: shippingDetailsFor(bundle.priceMinor) }
        : {}),
      hasMerchantReturnPolicy: returnPolicySchema(),
    },
    // No aggregateRating or review: the reviews this site holds are about the
    // product, not about one pack size, and attaching them to every SKU
    // would multiply one set of reviews across every entity.
  };

  // Home → Pack sizes → this pack. Three levels, so pageMetadata's two-level
  // breadcrumbSchema helper does not fit and the trail is built here.
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: brand.name, item: site },
      { "@type": "ListItem", position: 2, name: "Pack sizes", item: `${site}/products` },
      { "@type": "ListItem", position: 3, name: pack.shortLabel, item: url },
    ],
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: pack.h1,
    inLanguage: "en-GB",
    // The date the prices this page prints actually changed. Never a build
    // timestamp — see the note on PRICES_UPDATED.
    dateModified: PRICES_UPDATED,
    isPartOf: { "@type": "WebSite", url: site, name: brand.name },
  };

  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={webPageSchema} />

      {/* The provider opens on THIS pack's tier, so the buy panel, the
          analytics `view_item` and the page all agree about what is selected. */}
      <FunnelStateProvider initialBundleId={bundle.id}>
        <PackHero pack={pack} m={m} cryptoEnabled={cryptoEnabled} />
        <PackBody pack={pack} m={m} />

        {/* Reserve room so the bar never covers the footer links. */}
        <div aria-hidden="true" className="h-28 lg:hidden" />
        {/* Basket mode: on a pack page a real tier and quantity ARE selected,
            so the bar states the actual total. */}
        <StickyBuyBar />
      </FunnelStateProvider>
    </>
  );
}

/**
 * The hero. Common to all four variants, because the first screen always has
 * the same job — say what this pack is, what it costs and how to buy it.
 * What differs between variants is everything below it.
 */
function PackHero({
  pack,
  m,
  cryptoEnabled,
}: {
  pack: PackPage;
  m: PackMetrics;
  cryptoEnabled: boolean;
}) {
  const sale = saleVisible();

  return (
    <section className="section pb-0" aria-labelledby="pack-heading">
      <PackCrumbs pack={pack} />

      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-deep">
            {pack.shortLabel}
            {sale ? <span className="ml-2 text-cta-deep">{saleLabel()}</span> : null}
          </p>
          <h1 id="pack-heading" className="mt-3 text-4xl sm:text-5xl">
            {pack.h1}
          </h1>
          <p className="measure mt-5 text-lg text-ink-soft">{pack.lede}</p>
          <p className="measure mt-4 text-base text-ink-soft">
            <span className="font-semibold text-ink">Who it suits: </span>
            {pack.audience}
          </p>

          {/* The photograph sits under the copy on desktop rather than beside
              the buy panel: the panel is the tallest thing on the row, and a
              picture wedged next to it pushes the price below the fold. */}
          <div className="mt-10 max-w-[18rem] lg:mt-12">
            <VialImage priority />
          </div>
        </div>

        <div className="lg:col-span-5">
          {/* id="buy" so the mobile bar can tell whether the real panel is on
              screen, and hide itself while it is. Same contract as the home
              page's chooser. */}
          <div id="buy" className="scroll-mt-24 lg:sticky lg:top-24">
            <PackBuy
              bundle={m.bundle}
              cryptoEnabled={cryptoEnabled}
              otherPacksHref="/products"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The body, composed per variant.
 *
 * This switch IS the anti-duplication measure. Four different orders of four
 * different section sets, so two pack pages of different variants share
 * almost no structure — and two of the same variant still differ in every
 * heading and paragraph, which come from the registry.
 */
function PackBody({ pack, m }: { pack: PackPage; m: PackMetrics }) {
  switch (pack.variant) {
    case "starter":
      return <StarterBody pack={pack} m={m} />;
    case "stockUp":
      return <StockUpBody pack={pack} m={m} />;
    case "wholesale":
      return <WholesaleBody pack={pack} m={m} />;
    case "standard":
    default:
      return <StandardBody pack={pack} m={m} />;
  }
}

/** One registry angle as a section. */
function Angle({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl">{heading}</h2>
      <div className="measure mt-4 text-lg text-ink-soft">{children}</div>
    </div>
  );
}

/* ══ STARTER — one vial ═══════════════════════════════════════════
   Leads on what a single vial gives you and on the in-use window,
   because those are the two things a first-time buyer is actually
   deciding between. No savings table: there is nothing to save. */
function StarterBody({ pack, m }: { pack: PackPage; m: PackMetrics }) {
  const [whatYouGet, inUse, costsMost] = pack.angles;

  return (
    <>
      <section className="section" aria-labelledby="one-vial-heading">
        <h2 id="one-vial-heading" className="text-3xl sm:text-4xl">
          {whatYouGet.heading}
        </h2>
        <p className="measure mt-4 text-lg text-ink-soft">{whatYouGet.body}</p>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
          <div className="bg-surface p-6">
            <dt className="text-sm text-ink-soft">Volume</dt>
            <dd className="tabular mt-1 font-display text-4xl font-bold text-ink">
              {m.totalMl}ml
            </dd>
          </div>
          <div className="bg-surface p-6">
            <dt className="text-sm text-ink-soft">Draws at 1ml</dt>
            <dd className="tabular mt-1 font-display text-4xl font-bold text-ink">
              {m.drawsAt1ml}
            </dd>
          </div>
          <div className="bg-surface p-6">
            <dt className="text-sm text-ink-soft">Draws at 2ml</dt>
            <dd className="tabular mt-1 font-display text-4xl font-bold text-ink">
              {m.drawsAt2ml}
            </dd>
          </div>
        </dl>
      </section>

      {/* The in-use window, as the one big number on the page. The dark band
          is the home page's device, reused here because this is the fact that
          most changes how much someone should buy. */}
      <section className="bg-abyss" aria-labelledby="in-use-heading">
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
              <h2 id="in-use-heading" className="text-3xl text-white sm:text-4xl">
                {inUse.heading}
              </h2>
              <p className="measure mt-5 text-lg text-white/75">{inUse.body}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="per-vial-heading">
        <h2 id="per-vial-heading" className="text-3xl sm:text-4xl">
          {costsMost.heading}
        </h2>
        <p className="measure mt-4 text-lg text-ink-soft">{costsMost.body}</p>
        <div className="mt-8">
          <CheaperAlternatives m={m} />
        </div>
      </section>

      <FaqSection pack={pack} m={m} />
      <LadderSection current={pack.bundleId} />
      <SpecSection m={m} />
      <RelatedSection pack={pack} />
    </>
  );
}

/* ══ STANDARD — the everyday repeat packs (5, 7, 8) ════════════════
   Leads on the pack arithmetic, then the saving, then the tier's own
   argument. Carries the savings table the starter page cannot. */
function StandardBody({ pack, m }: { pack: PackPage; m: PackMetrics }) {
  return (
    <>
      <section className="section" aria-labelledby="pack-figures-heading">
        <h2 id="pack-figures-heading" className="sr-only">
          The figures for this pack
        </h2>
        <PackStats m={m} />
      </section>

      <section className="section pt-0">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {pack.angles.map((a) => (
            <Angle key={a.heading} heading={a.heading}>
              <p>{a.body}</p>
            </Angle>
          ))}
        </div>
      </section>

      <section className="section pt-0">
        <PackSaving m={m} />
        <div className="mt-6">
          <CheaperAlternatives m={m} />
        </div>
      </section>

      <LadderSection current={pack.bundleId} />

      <section className="section pt-0" aria-labelledby="delivery-heading">
        <h2 id="delivery-heading" className="text-2xl sm:text-3xl">
          Delivery on this pack
        </h2>
        <div className="mt-4">
          <PackDelivery m={m} />
        </div>
      </section>

      <FaqSection pack={pack} m={m} />
      <SpecSection m={m} />
      <RelatedSection pack={pack} />
    </>
  );
}

/* ══ STOCK-UP — the packs bought to stop re-ordering (10, 20) ══════
   Opens on the LADDER, because at this size the argument is the shape
   of the per-vial curve rather than the headline price. Volume and
   delivery follow, then the tier's own angles. */
function StockUpBody({ pack, m }: { pack: PackPage; m: PackMetrics }) {
  const [curve, ...rest] = pack.angles;

  return (
    <>
      <section className="section" aria-labelledby="ladder-first-heading">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <h2 id="ladder-first-heading" className="text-3xl sm:text-4xl">
              {curve.heading}
            </h2>
            <p className="measure mt-4 text-lg text-ink-soft">{curve.body}</p>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <PackLadder
              current={pack.bundleId}
              caption="Every pack size, compared on the same basis. Follow any row for that pack."
            />
          </div>
        </div>
      </section>

      <section className="section pt-0" aria-labelledby="volume-heading">
        <h2 id="volume-heading" className="sr-only">
          Volume and delivery
        </h2>
        <PackStats m={m} />
        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
          {rest.map((a) => (
            <Angle key={a.heading} heading={a.heading}>
              <p>{a.body}</p>
              {/* The delivery angle states the policy; the real figure for
                  this pack is printed underneath it. */}
              {a.heading.toLowerCase().includes("delivery") ? (
                <div className="mt-4">
                  <PackDelivery m={m} />
                </div>
              ) : null}
            </Angle>
          ))}
        </div>
      </section>

      <section className="section pt-0">
        <PackSaving m={m} />
        <div className="mt-6">
          <CheaperAlternatives m={m} />
        </div>
      </section>

      <SpecSection m={m} />
      <FaqSection pack={pack} m={m} />
      <RelatedSection pack={pack} />
    </>
  );
}

/* ══ WHOLESALE — procurement quantities (50, 100) ══════════════════
   Opens on unit economics, because that is the figure a purchase order
   carries. Hands off to /bulk-bacteriostatic-water for anything above
   the storefront ceiling. */
function WholesaleBody({ pack, m }: { pack: PackPage; m: PackMetrics }) {
  const [economics, ...rest] = pack.angles;

  return (
    <>
      <section className="section" aria-labelledby="economics-heading">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <h2 id="economics-heading" className="text-3xl sm:text-4xl">
              {economics.heading}
            </h2>
            <p className="measure mt-4 text-lg text-ink-soft">{economics.body}</p>
            <div className="mt-6">
              <PackDelivery m={m} />
            </div>
          </div>
          <div className="min-w-0 lg:col-span-7">
            <PackUnitEconomics m={m} />
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {rest.map((a) => (
            <Angle key={a.heading} heading={a.heading}>
              <p>{a.body}</p>
            </Angle>
          ))}
        </div>
      </section>

      {/* The path past the storefront. The largest pack at the quantity
          ceiling is the most this form can take; beyond it is a conversation,
          and /bulk-bacteriostatic-water is where that starts. */}
      <section className="bg-abyss" aria-labelledby="beyond-heading">
        <div className="shell-wide py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 id="beyond-heading" className="text-3xl text-white sm:text-4xl">
                Above {m.maxOrderVials} vials
              </h2>
              <p className="measure mt-5 text-lg text-white/75">
                The checkout takes up to {MAX_QUANTITY} packs in one order, which
                is {m.maxOrderVials} vials. Larger or repeating requirements are
                quoted rather than listed.
              </p>
            </div>
            <div className="lg:col-span-5">
              <ul className="flex flex-col gap-3">
                <li>
                  <Link href="/bulk-bacteriostatic-water" className="btn-cta">
                    Bulk &amp; wholesale pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact#wholesale"
                    className="text-sm text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white"
                  >
                    Ask for a wholesale quote
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <FaqSection pack={pack} m={m} />
      <LadderSection current={pack.bundleId} />
      <SpecSection m={m} />
      <RelatedSection pack={pack} />
    </>
  );
}

/* ── Sections shared by more than one variant ────────────────────── */

function LadderSection({ current }: { current: PackPage["bundleId"] }) {
  return (
    <section className="section pt-0" aria-labelledby="ladder-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <h2 id="ladder-heading" className="text-3xl sm:text-4xl">
            Every pack size
          </h2>
          <p className="measure mt-4 text-ink-soft">
            The same vial in every row. Only the quantity and the unit price
            change.
          </p>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <PackLadder current={current} />
        </div>
      </div>
    </section>
  );
}

/**
 * The pack's own questions. Placed at a DIFFERENT point in each variant —
 * see the four bodies above — so the section order stays part of what makes
 * the page shapes different rather than one template with swapped text.
 */
function FaqSection({ pack, m }: { pack: PackPage; m: PackMetrics }) {
  if (pack.faqs.length === 0) return null;
  return (
    <section className="section pt-0" aria-labelledby="pack-faq-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <h2 id="pack-faq-heading" className="text-3xl sm:text-4xl">
            Questions about this pack
          </h2>
          <p className="measure mt-4 text-ink-soft">
            Asked about this quantity specifically. The general questions about
            the product are on the{" "}
            <Link href="/faq" className="link">
              FAQ page
            </Link>
            .
          </p>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <PackFaqs pack={pack} m={m} />
        </div>
      </div>
    </section>
  );
}

function SpecSection({ m }: { m: PackMetrics }) {
  return (
    <section className="section pt-0" aria-labelledby="spec-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <h2 id="spec-heading" className="text-3xl sm:text-4xl">
            Specification
          </h2>
          <p className="measure mt-4 text-ink-soft">
            Identical on every pack size — it is one product, sold in different
            quantities.
          </p>
          <p className="mt-5 text-sm text-ink-soft">
            <Link href="/quality-and-documentation" className="link">
              Quality &amp; documentation
            </Link>
            {" · "}
            <Link href="/safety-data-sheet" className="link">
              Safety data sheet
            </Link>
          </p>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <PackSpec m={m} />
        </div>
      </div>
    </section>
  );
}

function RelatedSection({ pack }: { pack: PackPage }) {
  return (
    <section className="section pt-0" aria-labelledby="related-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h2 id="related-heading" className="text-3xl sm:text-4xl">
          Other pack sizes
        </h2>
        <p className="text-sm text-ink-soft">
          <Link href="/products" className="link">
            All pack sizes
          </Link>
          <span aria-hidden="true" className="mx-2">
            &middot;
          </span>
          <Link href="/faq" className="link">
            Questions
          </Link>
        </p>
      </div>
      <div className="mt-8">
        <RelatedPacks pack={pack} />
      </div>
      <p className="mt-8 text-sm text-ink-soft">
        Prices last changed {PRICES_UPDATED}. Single vial from{" "}
        <span className="tabular">{formatMinor(PRODUCT.unitPriceMinor)}</span>.
      </p>
    </section>
  );
}
