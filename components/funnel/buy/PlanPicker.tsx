"use client";

import { useEffect, useId, useState } from "react";
import { STANDARD_DELIVERY, STOCK_LEVEL, formatMinor } from "@/config/funnel";
import { parsePlanKey, planDeliveryNote } from "@/config/plans";
import { usePlanCheckout } from "@/components/funnel/buy/useCheckout";
import type { PurchaseMode } from "@/components/funnel/FunnelState";
import { FACTS } from "@/content/facts";
import { SaleTag } from "@/components/funnel/SaleTag";
import {
  LEAD_PLAN_MONTHS,
  LEAD_PLAN_PACK,
  PLAN_PACK_IDS,
  planFor,
  planFreeLine,
  plansFor,
  type Plan,
  type PlanMonths,
  type PlanPackId,
} from "@/components/funnel/buy/plans";

/**
 * The monthly-plan half of the buy boxes.
 *
 * Plans lead with what is saved and what is free, never with a per-vial
 * figure: a plan's per-vial price set beside the bulk ladder would compare
 * the wrong things. No sale strikethrough either: no plan was ever sold at
 * a higher price, so a struck figure would be a false reference.
 */

export interface PlanChoice {
  pack: PlanPackId;
  months: PlanMonths;
}

/** The plan picked so far: the best-selling pack on the recommended term. */
export function usePlanChoice() {
  const [choice, setChoice] = useState<PlanChoice>({ pack: LEAD_PLAN_PACK, months: LEAD_PLAN_MONTHS });
  const plan = planFor(choice.pack, choice.months) ?? planFor(LEAD_PLAN_PACK, LEAD_PLAN_MONTHS)!;
  return { choice, setChoice, plan };
}

/**
 * Honour /?plan=five-6#buy (the renewal email and the plan checkout's
 * cancel link): open the plan half on that plan. Read after mount from
 * window.location, NOT useSearchParams, so the home page stays static.
 */
export function usePlanQuery(setChoice: (c: PlanChoice) => void, setMode: (m: PurchaseMode) => void) {
  useEffect(() => {
    const wanted = parsePlanKey(new URLSearchParams(window.location.search).get("plan"));
    if (!wanted) return;
    setChoice(wanted);
    setMode("plan");
  }, [setChoice, setMode]);
}

export function PlanPicker({ choice, onChange }: { choice: PlanChoice; onChange: (c: PlanChoice) => void }) {
  const packName = useId();
  const termName = useId();
  const packLegend = useId();
  const termLegend = useId();

  function pickPack(pack: PlanPackId) {
    // A term the new pack does not offer (every pack offers every term, so this only guards a bad id)
    // falls back to the recommended one rather than to nothing.
    onChange({ pack, months: planFor(pack, choice.months) ? choice.months : LEAD_PLAN_MONTHS });
  }

  return (
    <div>
      <fieldset className="border-0 p-0">
        <legend id={packLegend} className="text-sm font-semibold text-ink">
          Vials each month
        </legend>
        <div role="radiogroup" aria-labelledby={packLegend} className="mt-4 grid grid-cols-3 gap-2">
          {PLAN_PACK_IDS.map((id) => {
            const pack = planFor(id, LEAD_PLAN_MONTHS)?.pack;
            if (!pack) return null;
            const selected = id === choice.pack;
            return (
              <label
                key={id}
                className={[
                  "relative flex min-h-[48px] cursor-pointer items-center justify-center rounded-control border px-2",
                  "text-sm font-semibold text-ink transition-colors duration-150",
                  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                  selected ? "border-brand bg-cta-tint ring-1 ring-brand" : "border-line-strong/50 bg-surface hover:border-brand/40",
                ].join(" ")}
                style={{ transitionTimingFunction: "var(--ease-out)" }}
              >
                <input
                  type="radio"
                  name={packName}
                  value={id}
                  checked={selected}
                  onChange={() => pickPack(id)}
                  className="sr-only"
                />
                <span>
                  <span className="tabular">{pack.vials}</span> vials
                </span>
                {/* "Best seller", not "Most popular": it is the PACK that
                    sells best today. No plan has sold yet, so a popularity
                    claim about plans would have nothing behind it. */}
                {id === LEAD_PLAN_PACK ? <TopBadge>Best seller</TopBadge> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5 border-0 p-0">
        <legend id={termLegend} className="text-sm font-semibold text-ink">
          Plan length
        </legend>
        <div role="radiogroup" aria-labelledby={termLegend} aria-live="polite" className="mt-3 space-y-2">
          {plansFor(choice.pack).map((p) => {
            const selected = p.months === choice.months;
            const free = planFreeLine(p);
            return (
              <label
                key={p.months}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 transition-colors duration-150",
                  selected ? "border-brand bg-cta-tint ring-1 ring-brand" : "border-line-strong/50 bg-surface hover:border-brand/40",
                ].join(" ")}
                style={{ transitionTimingFunction: "var(--ease-out)" }}
              >
                <input
                  type="radio"
                  name={termName}
                  value={p.months}
                  checked={selected}
                  onChange={() => onChange({ pack: choice.pack, months: p.months })}
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
                      <span className="tabular">{p.months}</span> months
                    </span>
                    {p.label ? (
                      <span className="rounded-full border border-brand/25 px-2 text-[11px] font-semibold leading-5 text-brand-deep">
                        {p.label}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {free ? <span className="font-semibold text-brand-deep">{free} · </span> : null}
                    <span className="tabular">{p.vials}</span> vials ·{" "}
                    {p.saveMinor > 0 ? (
                      <>
                        save <span className="tabular">{formatMinor(p.saveMinor)}</span>
                      </>
                    ) : (
                      "no discount, we just send it monthly"
                    )}
                  </span>
                </span>
                <span className="tabular shrink-0 text-base font-semibold text-ink">{formatMinor(p.totalMinor)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-3 text-xs text-ink-soft">
        Paid once, never renews. Your first box ships with this order, then one a month on the same date, each by{" "}
        {STANDARD_DELIVERY.carrier} with delivery included in the price. Opened vials keep {FACTS.openedLimit}, so a box
        a month means you always open fresh stock. Cancel any time.
      </p>
    </div>
  );
}

/** The plan's total, its free months and its saving, in PriceLine's place. */
export function PlanPriceLine({ plan }: { plan: Plan }) {
  const free = planFreeLine(plan);
  return (
    <div aria-live="polite">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-3xl font-bold text-ink">{formatMinor(plan.totalMinor)}</span>
        {free ? <SaleTag label={free} /> : null}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        <span className="tabular">{plan.months}</span> monthly boxes of <span className="tabular">{plan.pack.vials}</span>{" "}
        vials &middot;{" "}
        {plan.saveMinor > 0 ? (
          <>
            save <span className="tabular">{formatMinor(plan.saveMinor)}</span>
          </>
        ) : (
          "no discount"
        )}{" "}
        &middot; {planDeliveryNote(plan)}
      </p>
    </div>
  );
}

/** The plan's button: one Stripe payment for the whole plan (/api/checkout, PlanCheckoutSchema). */
export function PlanCheckoutRow({ plan }: { plan: Plan }) {
  const { checkout, pending, error } = usePlanCheckout(plan);
  const outOfStock = STOCK_LEVEL !== null && STOCK_LEVEL <= 0;
  return (
    <div>
      <button type="button" onClick={checkout} disabled={pending || outOfStock} aria-busy={pending} className="btn-cta">
        {outOfStock ? (
          "Out of stock"
        ) : pending ? (
          "Redirecting…"
        ) : (
          <>
            <span>Start my plan</span>
            <span aria-hidden="true">&middot;</span>
            <span className="tabular">{formatMinor(plan.totalMinor)}</span>
          </>
        )}
      </button>
      {error ? (
        <p role="alert" className="alert-error mt-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A small filled badge pinned to the top edge of a choice. */
export function TopBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-2 text-[10px] font-semibold leading-4 text-white">
      {children}
    </span>
  );
}
