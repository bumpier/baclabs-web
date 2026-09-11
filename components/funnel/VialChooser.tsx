"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  BUNDLES,
  DELIVERY,
  LOW_STOCK_THRESHOLD,
  MAX_QUANTITY,
  MIN_QUANTITY,
  PRODUCT,
  STOCK_LEVEL,
  VAT,
  bestPerVialBundleId,
  deliveryMinorFor,
  formatMinor,
  perVialMinor,
  referencePriceMinor,
  remainingForFreeDeliveryMinor,
  saleLabel,
  saleVisible,
  savingPercent,
  shipsFree,
  type BundleId,
} from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { useFunnel } from "@/components/funnel/FunnelState";
import { PaymentMarks } from "@/components/funnel/PaymentMarks";

/**
 * The home page's purchase block: pick a vial amount, then pay.
 *
 * REPLACES the stacked radio rows this page used to carry. Those rows were a
 * list you had to read top to bottom — one line per tier giving vials,
 * per-vial price and total, several hundred pixels of panel before the
 * button. The amounts are
 * the thing being chosen, so they are now a GRID OF THE AMOUNTS THEMSELVES:
 * one tap target per tier, the vial count set in the largest type, and
 * the whole ladder visible in one glance without scrolling.
 *
 * Still real <input type="radio"> elements inside <label>s, visually hidden
 * but present — arrow keys move between amounts, the group announces itself,
 * and the whole tile is a hit target. A div with onClick would look identical
 * and be unusable by keyboard.
 *
 * THE VIAL COUNT IS NEVER IMPLICIT. The tiles are per-pack, but an order can
 * be several packs, so the summary always states the real total in vials
 * rather than leaving the reader to multiply.
 */
/**
 * Columns in the amount grid, chosen so the tiles TILE — no half-empty last
 * row. Four tiers fill a row of four; six fill two rows of three. Retiring
 * the 7- and 8-vial packs took the ladder from eight to six, which at four
 * columns left two dead cells staring out of the panel, so the count is
 * derived rather than fixed.
 *
 * Written as whole class names because Tailwind scans source text: a
 * `grid-cols-${n}` template would never be built into the stylesheet.
 */
const TILE_COLUMNS = BUNDLES.length % 4 === 0 ? "grid-cols-4" : "grid-cols-3";

export function VialChooser({ cryptoEnabled }: { cryptoEnabled: boolean }) {
  const { bundle, quantity, totalMinor, select, setQuantity } = useFunnel();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupId = useId();

  async function checkout() {
    setError(null);
    setPending(true);
    trackEvent("begin_checkout", {
      currency: "GBP",
      value: totalMinor / 100,
      bundleId: bundle.id,
      quantity,
      items: [
        {
          item_id: bundle.sku,
          item_name: `${PRODUCT.name} ${bundle.vials} × ${PRODUCT.size}`,
          price: bundle.priceMinor / 100,
          quantity,
        },
      ],
    });

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: bundle.id, quantity, method: "card" }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      // Left pending on purpose: the page is navigating away, and clearing it
      // would flash the idle label during the redirect.
      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  // The same functions the Stripe session calls, so what is shown here and
  // what is charged cannot drift apart. The threshold is tested against the
  // amount actually charged, never the pre-sale reference figure.
  const deliveryMinor = deliveryMinorFor(totalMinor);
  const deliveryFree = shipsFree(totalMinor);
  const deliveryKnown = DELIVERY.mode !== "unknown";
  const toFreeDelivery = remainingForFreeDeliveryMinor(totalMinor);

  const sale = saleVisible();
  const referenceTotal = referencePriceMinor(bundle) * quantity;
  const lowStock = STOCK_LEVEL !== null && STOCK_LEVEL <= LOW_STOCK_THRESHOLD;
  const outOfStock = STOCK_LEVEL !== null && STOCK_LEVEL <= 0;
  const totalVials = bundle.vials * quantity;
  const bestId = bestPerVialBundleId();
  const saving = savingPercent(bundle);

  return (
    <div className="panel overflow-hidden">
      <fieldset className="border-0 p-0">
        {/* One heading labels the fieldset and the radio group: the legend is
            the accessible name, so there is no second, hidden label. */}
        <legend className="w-full border-b border-line px-5 py-4 sm:px-6">
          <span id={groupId} className="font-display text-xl font-bold text-ink">
            How many vials?
          </span>
        </legend>

        <div
          role="radiogroup"
          aria-labelledby={groupId}
          className={`grid ${TILE_COLUMNS} gap-px bg-line`}
        >
          {BUNDLES.map((b) => {
            const selected = b.id === bundle.id;
            const best = b.id === bestId;
            return (
              <label
                key={b.id}
                className={[
                  "relative flex cursor-pointer flex-col items-center justify-center gap-0.5",
                  "px-1 py-4 text-center transition-colors duration-150",
                  selected ? "bg-cta-tint" : "bg-surface hover:bg-brand-tint/40",
                ].join(" ")}
                style={{ transitionTimingFunction: "var(--ease-out)" }}
              >
                {/* A 3px amber edge on the selected tile. Absolutely
                    positioned so selecting never reflows the grid. */}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-x-0 top-0 h-[3px] transition-colors duration-150",
                    selected ? "bg-cta" : "bg-transparent",
                  ].join(" ")}
                />
                <input
                  type="radio"
                  name="vials"
                  value={b.id}
                  checked={selected}
                  onChange={() => select(b.id as BundleId)}
                  className="peer sr-only"
                />
                {/* The amount, in the largest type in the panel — it is the
                    thing being chosen. The focus ring lives here because the
                    real input is visually hidden. */}
                <span
                  className={[
                    "tabular font-display text-2xl font-bold leading-none",
                    selected ? "text-ink" : "text-ink-soft",
                    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand",
                  ].join(" ")}
                >
                  {b.vials}
                </span>
                <span className="text-[11px] leading-tight text-ink-soft">
                  {b.vials === 1 ? "vial" : "vials"}
                </span>
                <span className="tabular mt-1 text-[11px] leading-tight text-ink-soft">
                  {formatMinor(perVialMinor(b))}/ea
                </span>
                {best ? (
                  <span className="mt-0.5 text-[10px] font-semibold leading-tight text-brand-deep">
                    Best value
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="px-5 py-5 sm:px-6">
        {/* What has been chosen, said in full, before any arithmetic. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-base font-semibold text-ink">
            <span className="tabular">{bundle.vials}</span>{" "}
            {bundle.vials === 1 ? "vial" : "vials"} &middot;{" "}
            <span className="tabular">{formatMinor(bundle.priceMinor)}</span>
          </p>
          <p className="tabular text-sm text-ink-soft">
            {formatMinor(perVialMinor(bundle))} per vial
            {saving > 0 ? ` · saves ${saving}%` : ""}
          </p>
        </div>

        {/* Quantity, expressed in the unit the customer is choosing in. The
            label carries the live vial total so the number of VIALS is never
            something the reader has to work out from a multiplication. */}
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-5">
          <label htmlFor="qty" className="text-sm font-medium text-ink">
            {bundle.vials === 1 ? "How many vials?" : "How many packs?"}
            {bundle.vials > 1 ? (
              <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                = <span className="tabular">{totalVials}</span> vials in total
              </span>
            ) : null}
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={quantity <= MIN_QUANTITY}
              className="btn-quiet !min-h-[44px] !w-11 !px-0 text-lg disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              &minus;
            </button>
            <input
              id="qty"
              type="number"
              inputMode="numeric"
              min={MIN_QUANTITY}
              max={MAX_QUANTITY}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="tabular h-11 w-14 rounded-control border border-line-strong/60 bg-surface text-center text-base font-semibold text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              disabled={quantity >= MAX_QUANTITY}
              className="btn-quiet !min-h-[44px] !w-11 !px-0 text-lg disabled:opacity-40"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        {/* aria-live so a screen-reader user hears the figure change when the
            amount or the quantity moves. */}
        <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm" aria-live="polite">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">
              <span className="tabular">{totalVials}</span> ×{" "}
              {`${PRODUCT.name.toLowerCase()}, ${PRODUCT.size}`}
            </dt>
            <dd className="tabular text-ink">
              {formatMinor(sale ? referenceTotal : totalMinor)}
            </dd>
          </div>
          {sale ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">{saleLabel()}</dt>
              <dd className="tabular font-medium text-cta-deep">
                &minus;{formatMinor(referenceTotal - totalMinor)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Delivery</dt>
            <dd className="text-ink">
              {!deliveryKnown ? (
                "Calculated at checkout"
              ) : deliveryFree ? (
                "Free"
              ) : (
                <span className="tabular">{formatMinor(deliveryMinor)}</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular">
              {formatMinor(totalMinor + deliveryMinor)}
              {!deliveryKnown ? (
                <span className="ml-1 text-xs font-normal text-ink-soft">+ delivery</span>
              ) : null}
            </dd>
          </div>
        </dl>

        {VAT.statement ? <p className="mt-2 text-xs text-ink-soft">{VAT.statement}</p> : null}

        {/* A real shortfall against a threshold that is really applied at
            checkout — not a countdown, not invented scarcity. It disappears
            the moment the basket qualifies. */}
        <p aria-live="polite" className="mt-3">
          {toFreeDelivery > 0 ? (
            <span className="alert-note block">
              Add <span className="tabular font-semibold">{formatMinor(toFreeDelivery)}</span> more
              for free UK delivery.
            </span>
          ) : deliveryKnown && deliveryFree ? (
            <span className="alert-note block">
              This order qualifies for <span className="font-semibold">free UK delivery</span>.
            </span>
          ) : (
            <span className="block text-xs text-ink-soft">{DELIVERY.note}</span>
          )}
        </p>

        {/* Renders nothing while STOCK_LEVEL is null. */}
        {lowStock ? (
          <p className="mt-3 text-sm font-medium text-ink">
            <span className="tabular">{STOCK_LEVEL}</span> vials currently in stock.
          </p>
        ) : null}

        <button
          type="button"
          onClick={checkout}
          disabled={pending || outOfStock}
          className="btn-cta mt-5"
          aria-busy={pending}
        >
          {outOfStock ? "Out of stock" : pending ? "Redirecting…" : "Checkout securely"}
        </button>

        {error ? (
          <p role="alert" className="alert-error mt-3">
            {error}
          </p>
        ) : null}

        <p className="mt-3 text-center text-xs text-ink-soft">
          You will be taken to Stripe to pay. Delivery address is collected there.
        </p>

        {/* The detail pages. Linked from inside the purchase panel because
            this is exactly where "what does 20 vials actually get me?" gets
            asked — and it is the link that keeps those pages crawled. */}
        <p className="mt-2 text-center text-xs text-ink-soft">
          <Link
            href="/products"
            className="underline decoration-line underline-offset-4 hover:text-ink"
          >
            Compare pack sizes in detail
          </Link>
        </p>

        {cryptoEnabled ? (
          <p className="mt-3 text-center text-xs">
            <Link
              href={`/checkout?tier=${bundle.id}&qty=${quantity}`}
              className="text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
            >
              or pay with cryptocurrency
            </Link>
          </p>
        ) : null}

        <div className="mt-5 border-t border-line pt-4">
          <PaymentMarks />
        </div>
      </div>
    </div>
  );
}
