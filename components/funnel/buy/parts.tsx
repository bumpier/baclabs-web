"use client";

import { useId } from "react";
import Link from "next/link";
import {
  BUNDLES,
  DELIVERY,
  MAX_QUANTITY,
  MIN_QUANTITY,
  STOCK_LEVEL,
  VAT,
  VIAL_ML,
  deliveryMinorFor,
  formatMinor,
  freeDeliveryName,
  otherDeliveryOptionsLine,
  perVialMinor,
  referencePriceMinor,
  saleVisible,
  shipsFree,
  SINGLE_BUNDLE,
} from "@/config/funnel";
import { upsellCopy, upsellFor } from "@/lib/upsell";
import { useFunnel, type PurchaseMode } from "@/components/funnel/FunnelState";
import { SaleTag } from "@/components/funnel/SaleTag";
import { useUpsellCheckout } from "@/components/funnel/buy/UpsellDialog";
import { FreeDeliveryMeter } from "@/components/funnel/buy/FreeDeliveryMeter";

/**
 * The pieces the compact buy boxes are built from. Each states ONE thing
 * once: the old panel said the pack and its price four times and the saving
 * four times, and stacked three tinted boxes above the button.
 */

// ── Monthly plan or one-time purchase ─────────────────────────────────
// One-time sells any pack on the ladder, 1 to 100 vials, exactly as before.
// The plan is the larger, first option, but one-time opens selected: a
// preselected prepaid plan would put a £109.95 charge in front of someone
// who came for one pack.

export type { PurchaseMode } from "@/components/funnel/FunnelState";

export function ModeSwitch({
  mode,
  onChange,
  planLine,
}: {
  mode: PurchaseMode;
  onChange: (m: PurchaseMode) => void;
  /** The plan's promise, "Up to 2 months free". */
  planLine: string;
}) {
  const name = useId();
  const smallest = Math.min(...BUNDLES.map((b) => b.vials));
  const largest = Math.max(...BUNDLES.map((b) => b.vials));
  const options: { id: PurchaseMode; title: string; sub: string }[] = [
    { id: "plan", title: "Monthly plan", sub: planLine },
    { id: "once", title: "One-time purchase", sub: `${smallest} to ${largest} vials` },
  ];
  return (
    <div role="radiogroup" aria-label="How to buy" className="grid grid-cols-2 gap-2 sm:grid-cols-[3fr_2fr]">
      {options.map((o) => {
        const selected = mode === o.id;
        return (
          <label
            key={o.id}
            className={[
              "flex min-h-[60px] cursor-pointer flex-col justify-center rounded-control border px-4 py-2.5",
              "transition-colors duration-150",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
              selected ? "border-brand bg-cta-tint ring-1 ring-brand" : "border-line-strong/50 bg-surface hover:border-brand/40",
            ].join(" ")}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={selected}
              onChange={() => onChange(o.id)}
              className="sr-only"
            />
            <span className="text-sm font-semibold text-ink">{o.title}</span>
            <span className={o.id === "plan" ? "text-xs font-semibold text-brand-deep" : "tabular text-xs text-ink-soft"}>
              {o.sub}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * The step up from the current selection to the next pack (lib/upsell.ts):
 * 1 vial to 5, 5 to 10, and on up the ladder, or several packs to the one
 * pack that holds the same for less. Only ever points UP the ladder or to a
 * cheaper way to the same vials; the same offer the checkout dialog makes.
 */
export function UpsellNudge() {
  const { bundle, quantity, extraVials, select, setQuantity, setExtraVials } = useFunnel();
  const offer = upsellFor(bundle, quantity, extraVials);
  if (!offer) return null;
  const copy = upsellCopy(offer);
  return (
    <p className="rounded-control bg-brand-tint px-3 py-2 text-sm text-brand-deep">
      {copy.line}{" "}
      {offer.kind === "top-up" ? (
        <button
          type="button"
          onClick={() => setExtraVials(offer.to.extraVials)}
          className="font-semibold underline underline-offset-4"
        >
          {copy.accept}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            select(offer.to.bundle.id);
            setQuantity(1);
          }}
          className="font-semibold underline underline-offset-4"
        >
          Switch to {offer.to.vials} vials
        </button>
      )}
    </p>
  );
}

/**
 * The loose vials added to the packs, with the way to take them off again:
 * "+ 1 single vial £5.99 · Remove". Nothing while there are none.
 */
export function ExtraVialsLine({ className = "" }: { className?: string }) {
  const { extraVials, setExtraVials } = useFunnel();
  if (extraVials === 0) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-sm text-ink ${className}`}>
      <span>
        + <span className="tabular">{extraVials}</span> single {extraVials === 1 ? "vial" : "vials"}{" "}
        <span className="tabular text-ink-soft">{formatMinor(SINGLE_BUNDLE.priceMinor * extraVials)}</span>
      </span>
      <span aria-hidden="true" className="text-ink-soft">
        &middot;
      </span>
      <button
        type="button"
        onClick={() => setExtraVials(0)}
        className="text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
      >
        Remove
      </button>
    </p>
  );
}

/**
 * The selected pack's price: the figure, the struck pre-sale figure and the
 * tag while the sale shows, then the per-vial price. The only place the
 * pack's total and the sale saving appear; the pack tiles carry the
 * per-vial price and the saving on buying singly, for comparing packs.
 */
export function PriceLine() {
  const { bundle } = useFunnel();
  const sale = saleVisible();
  return (
    <div aria-live="polite">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Display size, so no .tabular: see the note on it in globals.css. */}
        <span className="font-display text-3xl font-bold text-ink">{formatMinor(bundle.priceMinor)}</span>
        {sale ? (
          <>
            <span className="tabular text-lg text-ink-soft line-through">
              {formatMinor(referencePriceMinor(bundle))}
            </span>
            <SaleTag />
          </>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        <span className="tabular">{bundle.vials}</span> × {VIAL_ML}ml {bundle.vials === 1 ? "vial" : "vials"}
        {bundle.vials > 1 ? (
          <>
            {" "}
            &middot; <span className="tabular">{formatMinor(perVialMinor(bundle))}</span> a vial
          </>
        ) : null}
      </p>
    </div>
  );
}

/**
 * Delivery for this order: how far it is from free, as a line and a bar
 * (FreeDeliveryMeter), then what it costs and the other options. The same
 * functions the Stripe session calls, so the line and the charge cannot
 * drift apart.
 */
export function DeliveryLine({ className = "" }: { className?: string }) {
  const { totalMinor } = useFunnel();
  const fee = deliveryMinorFor(totalMinor);
  const other = otherDeliveryOptionsLine(totalMinor);

  if (DELIVERY.mode === "unknown") {
    return <p className={`text-sm text-ink-soft ${className}`}>Delivery calculated at checkout.</p>;
  }

  const notes = [
    !shipsFree(totalMinor) && fee > 0 ? `Delivery ${formatMinor(fee)} on this order.` : "",
    other ? `Also at checkout: ${other}.` : "",
    VAT.statement,
  ].filter(Boolean);

  return (
    <div className={className}>
      {DELIVERY.mode === "threshold" ? (
        <FreeDeliveryMeter goodsMinor={totalMinor} />
      ) : shipsFree(totalMinor) ? (
        <p className="text-sm text-ink">
          <span className="font-semibold">Free {freeDeliveryName()}</span> on this order.
        </p>
      ) : null}
      {notes.length > 0 ? <p className="mt-2 text-xs text-ink-soft">{notes.join(" ")}</p> : null}
    </div>
  );
}

/** − n + in one bordered control, the height of the checkout button. */
export function QuantityStepper() {
  const { bundle, quantity, setQuantity } = useFunnel();
  const id = useId();
  return (
    <div className="flex h-[54px] shrink-0 items-center rounded-control border border-line-strong/50 bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      <button
        type="button"
        onClick={() => setQuantity(quantity - 1)}
        disabled={quantity <= MIN_QUANTITY}
        aria-label="Decrease quantity"
        className="h-full w-11 text-lg text-ink disabled:opacity-40"
      >
        &minus;
      </button>
      <label htmlFor={id} className="sr-only">
        {bundle.vials === 1 ? "Number of vials" : "Number of packs"}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN_QUANTITY}
        max={MAX_QUANTITY}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        className="tabular h-full w-9 border-0 bg-transparent text-center text-base font-semibold text-ink [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => setQuantity(quantity + 1)}
        disabled={quantity >= MAX_QUANTITY}
        aria-label="Increase quantity"
        className="h-full w-11 text-lg text-ink disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

/**
 * The button, carrying the amount to pay with delivery included, so there is
 * no totals table above it. The quantity stepper sits beside it unless the
 * buy box places it elsewhere.
 */
export function CheckoutRow({ cryptoEnabled, stepper = true }: { cryptoEnabled: boolean; stepper?: boolean }) {
  const { bundle, quantity, extraVials, vials: totalVials, totalMinor } = useFunnel();
  const { start, pending, error, dialog } = useUpsellCheckout();
  const known = DELIVERY.mode !== "unknown";
  const payable = totalMinor + deliveryMinorFor(totalMinor);
  const outOfStock = STOCK_LEVEL !== null && STOCK_LEVEL <= 0;

  // A container, so the button's label follows the width the buy box
  // actually has (the home page column, a pack page's narrower panel, a
  // phone) rather than the viewport: "securely" shows only where the whole
  // label fits on one line.
  return (
    <div className="@container">
      <div className="flex gap-3">
        {stepper ? <QuantityStepper /> : null}
        <button
          type="button"
          onClick={start}
          disabled={pending || outOfStock}
          aria-busy={pending}
          className="btn-cta min-w-0 flex-1 whitespace-nowrap"
        >
          {outOfStock ? (
            "Out of stock"
          ) : pending ? (
            "Redirecting…"
          ) : (
            <>
              <span>
                Checkout<span className="hidden @min-[26rem]:inline"> securely</span>
              </span>
              <span aria-hidden="true">&middot;</span>
              <span className="tabular">{formatMinor(payable)}</span>
              {known ? null : <span className="text-sm font-normal">+ delivery</span>}
            </>
          )}
        </button>
      </div>

      <ExtraVialsLine className="mt-3" />

      {/* The vial count is never left to arithmetic once there is more than
          one pack, or loose vials beside it. */}
      {quantity > 1 || extraVials > 0 ? (
        <p className="mt-2 text-xs text-ink-soft">
          {bundle.vials === 1 ? (
            <>
              <span className="tabular">{quantity}</span> vials
            </>
          ) : extraVials > 0 ? (
            <>
              <span className="tabular">{bundle.vials * quantity}</span> +{" "}
              <span className="tabular">{extraVials}</span> vials, <span className="tabular">{totalVials}</span> in total
            </>
          ) : (
            <>
              <span className="tabular">{quantity}</span> packs,{" "}
              <span className="tabular">{totalVials}</span> vials in total
            </>
          )}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="alert-error mt-3">
          {error}
        </p>
      ) : null}

      {dialog}

      {cryptoEnabled ? (
        <p className="mt-2 text-xs">
          <Link
            href={`/checkout?tier=${bundle.id}&qty=${quantity}${extraVials > 0 ? `&extra=${extraVials}` : ""}`}
            className="text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
          >
            or pay with cryptocurrency
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export function CheckMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M3 8.5 6.2 11.6 13 4.8"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The disclosure marker the page's other <details> use; turns 45° open. */
export function PlusMark() {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 transition-transform duration-200 group-open:rotate-45"
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1v14M1 8h14" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </span>
  );
}
