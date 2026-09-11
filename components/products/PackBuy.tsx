"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DELIVERY,
  LOW_STOCK_THRESHOLD,
  MAX_QUANTITY,
  MIN_QUANTITY,
  PRODUCT,
  STOCK_LEVEL,
  VAT,
  deliveryMinorFor,
  formatMinor,
  perVialMinor,
  referencePriceMinor,
  remainingForFreeDeliveryMinor,
  saleLabel,
  saleVisible,
  shipsFree,
  type Bundle,
} from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { useFunnel } from "@/components/funnel/FunnelState";
import { PaymentMarks } from "@/components/funnel/PaymentMarks";

/**
 * The purchase panel on a pack page.
 *
 * DELIBERATELY NOT components/funnel/PurchaseBlock. That block's whole top
 * half is a radio list of all eight tiers, which is right for a single funnel
 * page and wrong here twice over: a /products page that offers all eight
 * tiers inside it is eight pages selling the same eight things, which is the
 * duplication these pages exist to avoid; and the tier choice on this site is
 * now a NAVIGATION choice between pages, not a form control. Choosing a
 * different quantity means following a link, which is also what gives the
 * eight pages a reason to link to one another.
 *
 * So this panel sells exactly one tier. Quantity is a multiple of THIS pack.
 */
export function PackBuy({
  bundle,
  cryptoEnabled,
  otherPacksHref,
}: {
  bundle: Bundle;
  cryptoEnabled: boolean;
  /** Where "a different quantity" goes — the /products index. */
  otherPacksHref: string;
}) {
  // The provider is mounted with this pack's tier, so `bundle` here and the
  // context agree. Quantity is the only thing the customer changes.
  const { quantity, totalMinor, setQuantity } = useFunnel();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Every figure below comes from the same functions the Stripe session uses,
  // so what is shown and what is charged cannot drift apart.
  const deliveryMinor = deliveryMinorFor(totalMinor);
  const deliveryFree = shipsFree(totalMinor);
  const deliveryKnown = DELIVERY.mode !== "unknown";
  const toFreeDelivery = remainingForFreeDeliveryMinor(totalMinor);

  const sale = saleVisible();
  const referenceTotal = referencePriceMinor(bundle) * quantity;
  const lowStock = STOCK_LEVEL !== null && STOCK_LEVEL <= LOW_STOCK_THRESHOLD;
  const outOfStock = STOCK_LEVEL !== null && STOCK_LEVEL <= 0;
  const totalVials = bundle.vials * quantity;
  const unit = bundle.vials === 1 ? "vial" : "pack";

  return (
    <div className="panel overflow-hidden">
      {/* The pack, its price and its per-vial figure — the three things a
          buyer checks before the button. Stated once, at the top, rather
          than assembled from a selected row. */}
      <div className="border-b border-line bg-surface px-5 py-5 sm:px-6">
        <p className="font-display text-xl font-bold text-ink">
          <span className="tabular">{bundle.vials}</span>{" "}
          {bundle.vials === 1 ? "vial" : "vials"} &middot;{" "}
          <span className="tabular">{PRODUCT.size}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-ink-soft">
          <span className="tabular text-2xl font-semibold text-ink">
            {formatMinor(bundle.priceMinor)}
          </span>
          {sale ? (
            <span className="tabular text-sm line-through">
              {formatMinor(referencePriceMinor(bundle))}
            </span>
          ) : null}
          <span className="text-sm">
            <span className="tabular">{formatMinor(perVialMinor(bundle))}</span> per vial
          </span>
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="pack-qty" className="text-sm font-medium text-ink">
            How many {unit}s?
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={quantity <= MIN_QUANTITY}
              className="btn-quiet !min-h-[44px] !w-11 !px-0 text-lg disabled:opacity-40"
              aria-label={`Decrease number of ${unit}s`}
            >
              &minus;
            </button>
            <input
              id="pack-qty"
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
              aria-label={`Increase number of ${unit}s`}
            >
              +
            </button>
          </div>
        </div>

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
            checkout — not a countdown and not invented scarcity. It vanishes
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

        {/* The way to a different quantity is a link, not a control. */}
        <p className="mt-2 text-center text-xs text-ink-soft">
          <Link
            href={otherPacksHref}
            className="underline decoration-line underline-offset-4 hover:text-ink"
          >
            Need a different quantity?
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
