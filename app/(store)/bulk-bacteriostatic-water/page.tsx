import type { Metadata } from "next";
import Link from "next/link";
import {
  BUNDLES,
  DELIVERY,
  MAX_QUANTITY,
  PRICE_MATCH_BADGE,
  PRODUCT,
  VIAL_ML,
  bundleById,
  formatMinor,
  formatMinorShort,
  perVialMinor,
  savingPercent,
  shipsFree,
} from "@/config/funnel";
import { brand } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { pageBreadcrumbSchema } from "@/lib/guide-seo";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * The bulk / wholesale buying page.
 *
 * It owns the "bulk bacteriostatic water UK" and "bacteriostatic water
 * wholesale UK" cluster, which the home page cannot: the home page has to
 * lead with a single vial at £5.99, and a procurement buyer arriving on that
 * headline has to scroll past the whole funnel to reach the pack economics.
 *
 * NO `Product` ENTITY. Each pack page under /products now carries the Product
 * JSON-LD for its own SKU, with a single Offer, at its own canonical URL —
 * the home page no longer holds the multi-offer blob it used to. Emitting a
 * Product here would put one more entity in front of the tiers that each
 * have a page of their own. This page carries BreadcrumbList only.
 *
 * Every figure below is DERIVED from config/funnel.ts. Nothing on this page
 * may be typed by hand — re-pricing a tier has to move this page with it.
 */

const single = bundleById("single") ?? BUNDLES[0];

/** Tiers that are a bulk purchase rather than a personal one. */
const BULK_TIERS = BUNDLES.filter((b) => b.vials >= 10);

/** The lowest per-vial price on the site, and the tier that reaches it. */
const CHEAPEST = BUNDLES.reduce((a, b) => (perVialMinor(b) < perVialMinor(a) ? b : a));

/** The largest single order the storefront will take. */
const MAX_ORDER_VIALS = Math.max(...BUNDLES.map((b) => b.vials)) * MAX_QUANTITY;

/** The smallest tier that clears the free-delivery threshold, if there is one. */
const FIRST_FREE_DELIVERY = BUNDLES.find((b) => shipsFree(b.priceMinor));

export const metadata: Metadata = pageMetadata({
  title: "Bulk bacteriostatic water UK",
  description: `Bulk and wholesale ${PRODUCT.size}s of bacteriostatic water, ${formatMinor(
    CHEAPEST.priceMinor
  )} for ${CHEAPEST.vials} vials — ${formatMinor(
    perVialMinor(CHEAPEST)
  )} each. Pack prices, order limits, delivery and trade enquiries.`,
  path: "/bulk-bacteriostatic-water",
});

export default function BulkPage() {
  const hasEmail = Boolean(brand.contact.email);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema("Bulk & wholesale", "/bulk-bacteriostatic-water")} />

      <h1 className="text-3xl sm:text-4xl">Bulk bacteriostatic water, UK</h1>

      {/* The direct answer first — the figure a procurement buyer came for,
          before any of the explanation behind it. */}
      <p className="measure mt-4 text-lg text-ink-soft">
        The largest pack is{" "}
        <span className="tabular">{CHEAPEST.vials}</span> sealed {VIAL_ML}ml vials for{" "}
        <span className="tabular">{formatMinor(CHEAPEST.priceMinor)}</span>, which is{" "}
        <span className="tabular">{formatMinor(perVialMinor(CHEAPEST))}</span> a vial &mdash;{" "}
        <span className="tabular">{savingPercent(CHEAPEST)}%</span> below the single-vial price of{" "}
        <span className="tabular">{formatMinor(single.priceMinor)}</span>. Pack prices are published
        below; there is no quote to wait for and no trade account to open.
      </p>

      <h2 className="mt-14 text-2xl">Pack prices</h2>
      <p className="measure mt-3 text-base text-ink-soft">
        Every tier of <span className="tabular">{BULK_TIERS[0]?.vials}</span> vials and above. The
        per-vial column is the pack price divided by the vials in it, so the ladder is the whole
        argument for buying a larger pack.
      </p>

      <div className="mt-5 overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Bulk pack prices for {PRODUCT.name.toLowerCase()}, {PRODUCT.size}
          </caption>
          <thead>
            <tr className="bg-neutral">
              <th scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">
                Pack
              </th>
              <th scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">
                Price
              </th>
              <th scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">
                Per vial
              </th>
              <th scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">
                Saving
              </th>
            </tr>
          </thead>
          <tbody>
            {BULK_TIERS.map((b) => (
              <tr key={b.id} className="align-top">
                <th
                  scope="row"
                  className="border-b border-line px-4 py-3 font-medium text-ink"
                >
                  <span className="tabular">{b.vials}</span> vials
                </th>
                <td className="tabular border-b border-line px-4 py-3 text-ink-soft">
                  {formatMinor(b.priceMinor)}
                </td>
                <td className="tabular border-b border-line px-4 py-3 text-ink-soft">
                  {formatMinor(perVialMinor(b))}
                </td>
                <td className="tabular border-b border-line px-4 py-3 text-ink-soft">
                  {savingPercent(b)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5">
        <Link href="/#buy" className="btn-cta sm:w-auto">
          Choose your pack
        </Link>
      </p>

      <h2 className="mt-14 text-2xl">Ordering, limits and delivery</h2>
      <dl className="mt-5 divide-y divide-line border-y border-line">
        <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-ink-soft">Minimum order</dt>
          <dd className="text-base text-ink">
            None. A single vial at{" "}
            <span className="tabular">{formatMinor(single.priceMinor)}</span> is a valid order, and
            the pack prices above apply from the first one.
          </dd>
        </div>
        <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-ink-soft">Maximum per order</dt>
          <dd className="text-base text-ink">
            <span className="tabular">{MAX_ORDER_VIALS}</span> vials &mdash; up to{" "}
            <span className="tabular">{MAX_QUANTITY}</span> of the{" "}
            <span className="tabular">{CHEAPEST.vials}</span>-vial pack in one checkout.
            {hasEmail
              ? " Beyond that, or for a standing order or an institutional purchase order, get in touch."
              : " Larger orders can be placed as repeat checkouts at the same pack prices."}
          </dd>
        </div>
        {DELIVERY.mode === "threshold" && DELIVERY.freeFromMinor !== null && FIRST_FREE_DELIVERY ? (
          <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-ink-soft">Delivery</dt>
            <dd className="text-base text-ink">
              Free to any UK address on orders of{" "}
              {formatMinorShort(DELIVERY.freeFromMinor)} or more, which every pack from{" "}
              <span className="tabular">{FIRST_FREE_DELIVERY.vials}</span> vials up already clears.
              {DELIVERY.priceMinor !== null ? (
                <>
                  {" "}
                  Below the threshold it is {formatMinorShort(DELIVERY.priceMinor)}, shown before
                  you pay.
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
        {/* Dispatch timing renders only once DELIVERY.dispatchLine holds a
            real, committed figure. An unconfirmed lead time is the one thing
            a procurement buyer would plan around, so it stays absent rather
            than being guessed. */}
        {DELIVERY.dispatchLine ? (
          <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-ink-soft">Dispatch</dt>
            <dd className="text-base text-ink">{DELIVERY.dispatchLine}</dd>
          </div>
        ) : null}
        <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-ink-soft">Price</dt>
          <dd className="text-base text-ink">
            <Link href="/#guarantee" className="link">
              {PRICE_MATCH_BADGE}
            </Link>{" "}
            &mdash; the terms are on the product page.
          </dd>
        </div>
        <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-ink-soft">Payment</dt>
          <dd className="text-base text-ink">
            Card, through Stripe. Card details go to Stripe and are never seen or stored here.
          </dd>
        </div>
      </dl>

      <h2 className="mt-14 text-2xl">What you are buying</h2>
      <p className="measure mt-3 text-base text-ink-soft">
        {PRODUCT.composition} {PRODUCT.use} Each vial is {PRODUCT.size},
        {PRODUCT.storage ? ` stored at ${PRODUCT.storage},` : ""} and usable for{" "}
        {PRODUCT.shelfLifeAfterOpening} once the stopper has been punctured. The unopened expiry is
        batch-specific and printed on each vial. The{" "}
        <Link href="/quality-and-documentation" className="link">
          quality and documentation
        </Link>{" "}
        page sets out what is tested and what each document shows, and the{" "}
        <Link href="/safety-data-sheet" className="link">
          safety data sheet
        </Link>{" "}
        covers handling, storage and disposal.
      </p>

      <h2 className="mt-14 text-2xl">Trade and standing orders</h2>
      {/* Only offers the enquiry route while one actually exists. With
          brand.contact.email empty this used to send the reader to the
          contact page, which has no route either — a loop rather than an
          answer. See docs/OPERATOR-FACTS.md. */}
      {hasEmail ? (
        <p className="measure mt-3 text-base text-ink-soft">
          For more than <span className="tabular">{MAX_ORDER_VIALS}</span> vials, a recurring
          schedule, or an institutional purchase order, send the quantity you need, the delivery
          postcode, and whether it is a one-off or recurring, to{" "}
          <a href={`mailto:${brand.contact.email}`} className="link">
            {brand.contact.email}
          </a>
          .
        </p>
      ) : (
        <p className="measure mt-3 text-base text-ink-soft">
          Orders above <span className="tabular">{MAX_ORDER_VIALS}</span> vials, recurring
          schedules and institutional purchase orders are not set up on the site yet. The pack
          prices above are the same whether you order once or repeatedly, and there is no trade
          account or minimum to qualify for them.
        </p>
      )}

      <p className="mt-14 text-sm text-ink-soft">
        <Link href="/" className="link">
          Back to the product page
        </Link>
      </p>
    </div>
  );
}
