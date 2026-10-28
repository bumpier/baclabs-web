"use client";

import {
  DELIVERY,
  SINGLE_BUNDLE,
  STARTER_KIT,
  VAT,
  deliveryMinorFor,
  formatMinor,
  kitPriceMinor,
  otherDeliveryOptionsLine,
} from "@/config/funnel";
import { formatCutoffHour } from "@/lib/delivery-date";
import { useDispatchNotice } from "@/components/funnel/useDispatchNotice";
import { PaymentMarks } from "@/components/funnel/PaymentMarks";
import { WelcomeVialPanel } from "@/components/mailing-list/WelcomeVialPanel";
import { CheckMark } from "@/components/funnel/buy/parts";
import { useStarterCheckout } from "@/components/funnel/buy/useCheckout";

/**
 * The Starter Kit's purchase panel: one thing at one price, so no pack
 * tiles, no quantity and no step-up offer. Built from the same parts as the
 * pack pages' panel so it says the same things the same way: the price
 * once, delivery, the total on the button, the trust line, the signup.
 * Card only: the Starter Kit has no crypto route.
 */
export function StarterKitBuy() {
  const { checkout, pending, error } = useStarterCheckout();
  const dispatchNotice = useDispatchNotice();
  const goods = STARTER_KIT.priceMinor;
  const delivery = DELIVERY.mode === "unknown" ? 0 : deliveryMinorFor(goods);
  const separately = SINGLE_BUNDLE.priceMinor + kitPriceMinor(SINGLE_BUNDLE);
  const other = otherDeliveryOptionsLine(goods);

  const checks = [
    !DELIVERY.dispatchLine
      ? ""
      : dispatchNotice
        ? dispatchNotice.title
        : `Same working day dispatch, order by ${formatCutoffHour()}`,
    "Secure checkout by Stripe",
  ].filter(Boolean);

  const notes = [
    delivery > 0 ? `Delivery ${formatMinor(delivery)} on this order.` : "",
    other ? `Also at checkout: ${other}.` : "",
    VAT.statement,
  ].filter(Boolean);

  return (
    <div className="panel p-5 sm:p-6">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Display size, so no .tabular: see the note on it in globals.css. */}
        <span className="font-display text-3xl font-bold text-ink">{formatMinor(goods)}</span>
        <span className="text-sm text-ink-soft">
          <span className="tabular">{formatMinor(separately)}</span> bought separately
        </span>
      </p>
      <p className="mt-1 text-sm text-ink-soft">1 × 10ml vial and 1 Lab Kit</p>

      {DELIVERY.mode === "unknown" ? (
        <p className="mt-5 text-sm text-ink-soft">Delivery calculated at checkout.</p>
      ) : notes.length > 0 ? (
        <p className="mt-5 text-xs text-ink-soft">{notes.join(" ")}</p>
      ) : null}

      <div className="mt-5 @container">
        <button
          type="button"
          onClick={() => void checkout()}
          disabled={pending}
          aria-busy={pending}
          className="btn-cta w-full whitespace-nowrap"
        >
          {pending ? (
            "Redirecting…"
          ) : (
            <>
              <span>
                Checkout<span className="hidden @min-[22rem]:inline"> securely</span>
              </span>
              <span aria-hidden="true">&middot;</span>
              <span className="tabular">{formatMinor(goods + delivery)}</span>
              {DELIVERY.mode === "unknown" ? <span className="text-sm font-normal">+ delivery</span> : null}
            </>
          )}
        </button>
        {error ? (
          <p role="alert" className="alert-error mt-3">
            {error}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {checks.map((label) => (
          <li key={label} className="flex items-center gap-2 text-sm text-ink-soft">
            <CheckMark />
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <PaymentMarks />
      </div>
      <div className="mt-5">
        <WelcomeVialPanel vials={1} compact />
      </div>
    </div>
  );
}
