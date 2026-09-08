"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  BUNDLES,
  DELIVERY,
  deliveryMinorFor,
  remainingForFreeDeliveryMinor,
  shipsFree,
  LOW_STOCK_THRESHOLD,
  MAX_QUANTITY,
  MIN_QUANTITY,
  PRODUCT,
  STOCK_LEVEL,
  VAT,
  formatMinor,
  perVialMinor,
  referencePriceMinor,
  saleLabel,
  saleVisible,
  type BundleId,
} from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { useFunnel } from "@/components/funnel/FunnelState";
import { PaymentMarks } from "@/components/funnel/PaymentMarks";
import { Badge } from "@/components/ui/badge";

/** The largest tier, and the most vials one order can hold: that tier at the maximum quantity. */
const MAX_TIER_VIALS = Math.max(...BUNDLES.map((b) => b.vials));
const MAX_ORDER_VIALS = MAX_TIER_VIALS * MAX_QUANTITY;

/**
 * The purchase block: tier selector, quantity, live total, and the one button
 * that actually charges.
 *
 * Radios are real <input type="radio"> elements inside <label>s, visually
 * hidden but present — so arrow keys move between tiers, the group announces
 * itself, and the whole row is a hit target. A div with onClick would have
 * looked identical and been unusable by keyboard.
 */
export function PurchaseBlock({ cryptoEnabled }: { cryptoEnabled: boolean }) {
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
      // Leave `pending` set: the page is navigating away, and clearing it
      // would flash the idle label during the redirect.
      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  // Same function the Stripe session calls, so the delivery shown here and
  // the delivery charged cannot disagree. Threshold is against the amount
  // actually charged (post-sale), not the pre-sale reference price.
  const deliveryMinor = deliveryMinorFor(totalMinor);
  const deliveryFree = shipsFree(totalMinor);
  const deliveryKnown = DELIVERY.mode !== "unknown";
  // Pence still to add before this basket ships free. 0 once it does, and 0
  // when no threshold exists — so the nudge renders on a positive number
  // alone. It reads the same figure Stripe is handed, never a second copy.
  const toFreeDelivery = remainingForFreeDeliveryMinor(totalMinor);

  const sale = saleVisible();
  const referenceTotal = referencePriceMinor(bundle) * quantity;
  const lowStock = STOCK_LEVEL !== null && STOCK_LEVEL <= LOW_STOCK_THRESHOLD;
  const outOfStock = STOCK_LEVEL !== null && STOCK_LEVEL <= 0;
  const totalVials = bundle.vials * quantity;

  return (
    <div className="panel overflow-hidden">
      <fieldset className="border-0 p-0">
        {/* One heading labels both the fieldset and the radio group: the
            legend is the accessible name, so no second, hidden label. */}
        <legend className="w-full border-b border-line px-5 py-5 sm:px-6">
          <span id={groupId} className="font-display text-xl font-bold text-ink">
            Choose your quantity
          </span>
        </legend>

        <div role="radiogroup" aria-labelledby={groupId}>
          {BUNDLES.map((b) => {
            const selected = b.id === bundle.id;
            return (
              <label
                key={b.id}
                className={[
                  "relative flex cursor-pointer items-center gap-4 border-b border-line py-4 pl-6 pr-5 sm:pl-7 sm:pr-6",
                  "transition-colors duration-150",
                  selected ? "bg-cta-tint" : "bg-surface",
                ].join(" ")}
                style={{ transitionTimingFunction: "var(--ease-out)" }}
              >
                {/* A 3px amber edge on the selected row. Absolutely
                    positioned so selecting never reflows the list. */}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-y-0 left-0 w-[3px] transition-colors duration-150",
                    selected ? "bg-cta" : "bg-transparent",
                  ].join(" ")}
                />
                <input
                  type="radio"
                  name="bundle"
                  value={b.id}
                  checked={selected}
                  onChange={() => select(b.id as BundleId)}
                  className="peer sr-only"
                />
                {/* The dot is the only thing that moves on selection: a
                    150ms colour and scale change, no layout shift. */}
                <span
                  aria-hidden="true"
                  className={[
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                    "transition-colors duration-150",
                    selected ? "border-cta" : "border-line-strong",
                    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                  ].join(" ")}
                  style={{ transitionTimingFunction: "var(--ease-out)" }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-cta transition-transform duration-150"
                    style={{
                      transitionTimingFunction: "var(--ease-out)",
                      transform: selected ? "scale(1)" : "scale(0)",
                    }}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-base font-semibold text-ink">
                      <span className="tabular">{b.vials}</span> {b.vials === 1 ? "vial" : "vials"}
                    </span>
                    {b.label ? (
                      <Badge
                        variant="outline"
                        className="border-brand/25 bg-brand-tint text-brand-deep"
                      >
                        {b.label}
                      </Badge>
                    ) : null}
                  </span>
                  {/* Per-vial price only. The saving is what the falling
                      per-vial figure already says, and the sale reference
                      price is shown once, in the summary, rather than struck
                      through on every row. */}
                  <span className="mt-0.5 block text-sm text-ink-soft">
                    <span className="tabular">{formatMinor(perVialMinor(b))}</span> per vial
                  </span>
                </span>

                <span className="tabular shrink-0 text-lg font-semibold text-ink">
                  {formatMinor(b.priceMinor)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="px-5 py-5 sm:px-6">
        {/* Quantity */}
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="qty" className="text-sm font-medium text-ink">
            How many {bundle.vials === 1 ? "vials" : "packs"}?
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={quantity <= MIN_QUANTITY}
              className="btn-quiet !min-h-[44px] !w-11 !px-0 text-lg disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              −
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

        {/* Total. aria-live so a screen-reader user hears the figure change
            when they adjust the tier or the quantity. */}
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
                −{formatMinor(referenceTotal - totalMinor)}
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

        {/* VAT treatment, stated before the customer reaches Stripe. Renders
            only when config supplies it. */}
        {VAT.statement ? <p className="mt-2 text-xs text-ink-soft">{VAT.statement}</p> : null}

        {/* Free-delivery status, and the one nudge on this page.
            It states a shortfall against a threshold that is really applied at
            checkout — it is not a countdown, a fake deadline or an invented
            scarcity signal, and it disappears the moment the basket qualifies.
            `aria-live="polite"` because it changes as the tier or quantity
            changes, and a screen-reader user should hear that it has. */}
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
            // No threshold in play — fall back to the plain policy line.
            <span className="block text-xs text-ink-soft">{DELIVERY.note}</span>
          )}
        </p>

        {/* Real stock signal only — renders nothing while STOCK_LEVEL is null. */}
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

        {/* The path past the largest order this form can take. Shown only
            once the largest tier is selected — that is the one buyer it is
            for, and everyone else gets a shorter panel. */}
        {bundle.vials === MAX_TIER_VIALS ? (
          <p className="mt-2 text-center text-xs text-ink-soft">
            Need more than <span className="tabular">{MAX_ORDER_VIALS}</span> vials?{" "}
            <Link
              href="/contact#wholesale"
              className="underline decoration-line underline-offset-4 hover:text-ink"
            >
              Ask for a wholesale quote
            </Link>
          </p>
        ) : null}

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
