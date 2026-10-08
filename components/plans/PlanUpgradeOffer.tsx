"use client";

import { useId, useState } from "react";
import { formatMinor } from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { hasTrackingConsent } from "@/components/consent/consent-store";

/**
 * "Make this box 1 of a monthly plan" on a one-off order's confirmation page
 * (lib/plans/upgrade.ts). The term cards are PlanPicker's, class for class, so
 * the offer reads as the same funnel as the buy box. Like the plan picker it
 * leads with what is free and the saving: no per-vial figure, no strikethrough.
 *
 * Sends the order id and a term, never an amount: /api/checkout/plan-upgrade
 * prices it and checks the order is still eligible.
 */

export interface UpgradeOfferCard {
  months: 6 | 12;
  /** What the upgrade costs today: the plan less the box already bought. */
  priceMinor: number;
  /** "1 month free", "2 months free + a free 5-pack". */
  freeLine: string;
  saveMinor: number;
  /** "Recommended", "Best value". */
  label: string;
  /** "includes £3.90 delivery per box". */
  deliveryNote: string;
  /** The free pack rides in box 2, since box 1 has already been bought. */
  bonusInBox2: boolean;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PlanUpgradeOffer({
  orderId,
  offers,
  deadlineText,
}: {
  orderId: string;
  offers: UpgradeOfferCard[];
  /** "Thursday 15 October 2026": the last day the offer is open. */
  deadlineText: string;
}) {
  const termName = useId();
  const termLegend = useId();
  const [months, setMonths] = useState<6 | 12>(offers.some((o) => o.months === 6) ? 6 : (offers[0]?.months ?? 6));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = offers.find((o) => o.months === months) ?? offers[0];
  if (!chosen) return null;

  async function startPlan() {
    if (!chosen) return;
    setError(null);
    setPending(true);
    trackEvent("begin_checkout", { currency: "GBP", value: chosen.priceMinor / 100, quantity: 1 });
    try {
      const res = await fetch("/api/checkout/plan-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, months: chosen.months, trackingConsent: hasTrackingConsent() }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      // Left pending on purpose: the page is navigating away.
      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <section id="plan-upgrade" className="panel mt-10 scroll-mt-24 p-5 sm:p-6" aria-labelledby="plan-upgrade-heading">
      <h2 id="plan-upgrade-heading" className="text-xl">
        Make this box 1 of a monthly plan
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        Same pack, one box a month on the same date, delivery included. Pay only the difference today. Open until{" "}
        {deadlineText}.
      </p>

      <fieldset className="mt-5 border-0 p-0">
        <legend id={termLegend} className="text-sm font-semibold text-ink">
          Plan length
        </legend>
        <div role="radiogroup" aria-labelledby={termLegend} className="mt-3 space-y-2">
          {offers.map((o) => {
            const selected = o.months === months;
            return (
              <label
                key={o.months}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 transition-colors duration-150",
                  selected ? "border-brand bg-cta-tint ring-1 ring-brand" : "border-line-strong/50 bg-surface hover:border-brand/40",
                ].join(" ")}
                style={{ transitionTimingFunction: "var(--ease-out)" }}
              >
                <input
                  type="radio"
                  name={termName}
                  value={o.months}
                  checked={selected}
                  onChange={() => setMonths(o.months)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-brand" : "border-line-strong",
                    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                  ].join(" ")}
                >
                  {selected ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-base font-semibold text-ink">
                      <span className="tabular">{o.months}</span> months
                    </span>
                    {o.label ? (
                      <span className="rounded-full border border-brand/25 px-2 text-[11px] font-semibold leading-5 text-brand-deep">
                        {o.label}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {o.freeLine ? (
                      <span className="font-semibold text-brand-deep">
                        {o.freeLine}
                        {o.bonusInBox2 ? " (the free pack comes in box 2)" : ""} ·{" "}
                      </span>
                    ) : null}
                    {o.saveMinor > 0 ? (
                      <>
                        save <span className="tabular">{formatMinor(o.saveMinor)}</span>
                      </>
                    ) : (
                      "no discount, we just send it monthly"
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-base font-semibold text-ink">
                  <span className="tabular">{formatMinor(o.priceMinor)}</span> more
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button type="button" onClick={startPlan} disabled={pending} aria-busy={pending} className="btn-cta mt-5">
        {pending ? (
          "Redirecting…"
        ) : (
          <>
            <span>Start my plan</span>
            <span aria-hidden="true">&middot;</span>
            <span>
              <span className="tabular">{formatMinor(chosen.priceMinor)}</span> more
            </span>
          </>
        )}
      </button>
      {error ? (
        <p role="alert" className="alert-error mt-3">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-ink-soft">
        Paid once, never renews. Cancel any time. {capitalise(chosen.deliveryNote)}.
      </p>
    </section>
  );
}
