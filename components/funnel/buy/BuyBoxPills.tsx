"use client";

import { useId } from "react";
import Link from "next/link";
import {
  BUNDLES,
  DEFAULT_BUNDLE_ID,
  DELIVERY,
  LOWEST_PRICE_BADGE,
  PRODUCT,
  RETURNS,
  VIAL_ML,
  bestPerVialBundleId,
  deliveryTimesSentence,
  drawsPerVial,
  formatMinor,
  perVialMinor,
  savingPercent,
  shipsFree,
  type BundleId,
} from "@/config/funnel";
import { formatCutoffHour } from "@/lib/delivery-date";
import { useFunnel, usePackQuery } from "@/components/funnel/FunnelState";
import { PaymentMarks } from "@/components/funnel/PaymentMarks";
import { WelcomeVialPanel } from "@/components/mailing-list/WelcomeVialPanel";
import {
  CheckMark,
  CheckoutRow,
  DeliveryLine,
  ModeSwitch,
  PlusMark,
  PriceLine,
  UpsellNudge,
} from "@/components/funnel/buy/parts";
import {
  PlanCheckoutRow,
  PlanPicker,
  PlanPriceLine,
  TopBadge,
  usePlanChoice,
  usePlanQuery,
} from "@/components/funnel/buy/PlanPicker";
import { planHeadline } from "@/components/funnel/buy/plans";
import { planDeliverySentence } from "@/config/plans";

/**
 * The home page's buy box, Shopify style (chosen 8 Oct 2026 from three
 * drafts). Title and price, then the switch between a monthly plan and a
 * one-time purchase. One-time shows every pack as a tile with its per-vial
 * price, saving and free delivery, the recommended 10-pack preselected and
 * the 5-pack badged as the best seller, then how far the order is from free delivery and the
 * step up to the next pack; the plan shows the plan picker. Then the
 * button (which offers that step once more before Stripe), the trust line,
 * the payment marks and the mailing-list signup. The delivery detail that used to sit open in the panel is one
 * collapsed row at the foot.
 */
export function BuyBoxPills({ cryptoEnabled }: { cryptoEnabled: boolean }) {
  const { bundle, vials, select, mode, setMode } = useFunnel();
  const { choice, setChoice, plan } = usePlanChoice();
  usePackQuery();
  usePlanQuery(setChoice, setMode);
  const groupId = useId();
  const bestId = bestPerVialBundleId();
  const times = deliveryTimesSentence();
  const once = mode === "once";

  // The three reasons to buy here and now, beside the button where the
  // decision is made. The price claim only ever appears with the link to
  // the guarantee that substantiates it (LOWEST_PRICE_BADGE); empty claims
  // drop out, so a withdrawn one disappears here too.
  const checks: { label: string; href?: string }[] = [
    { label: LOWEST_PRICE_BADGE, href: "#guarantee" },
    { label: DELIVERY.dispatchLine ? `Same working day dispatch, order by ${formatCutoffHour()}` : "" },
    { label: "Secure checkout by Stripe" },
  ].filter((c) => c.label);

  return (
    <div className="max-w-[32rem]">
      <h2 id="buy-heading" className="text-3xl sm:text-4xl">
        {PRODUCT.name} {VIAL_ML}ml
      </h2>
      <div className="mt-4">{once ? <PriceLine /> : <PlanPriceLine plan={plan} />}</div>
      <p className="mt-4 text-base text-ink-soft">
        Sealed multi-dose vial. <span className="tabular">{drawsPerVial(1)}</span> draws at 1ml, or{" "}
        <span className="tabular">{drawsPerVial(2)}</span> at 2ml.
      </p>

      <div className="mt-7">
        <ModeSwitch mode={mode} onChange={setMode} planLine={planHeadline()} />
      </div>

      {once ? (
        <>
          <fieldset className="mt-6 border-0 p-0">
            <legend id={groupId} className="text-sm font-semibold text-ink">
              Pack size
            </legend>
            {/* Each tile carries what a pack is worth against the others:
                the price of one vial in it, the saving on buying singly, and
                whether it ships free on its own. The pack's total stays in
                the price line above, once. */}
            <div role="radiogroup" aria-labelledby={groupId} className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4">
              {BUNDLES.map((b) => {
                const selected = b.id === bundle.id;
                const saving = savingPercent(b);
                const free = shipsFree(b.priceMinor);
                // The derived value claim first; otherwise the pack's own
                // label ("Most popular", "Recommended"). The recommended
                // pack's badge is filled, the rest outlined.
                const badge = b.id === bestId ? "Best value" : b.label;
                return (
                  <label
                    key={b.id}
                    className={[
                      "relative flex min-h-[76px] cursor-pointer flex-col items-center justify-center rounded-control border px-2 py-2.5 text-center",
                      "transition-colors duration-150",
                      "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                      selected
                        ? "border-brand bg-cta-tint ring-1 ring-brand"
                        : "border-line-strong/50 bg-surface hover:border-brand/40",
                    ].join(" ")}
                    style={{ transitionTimingFunction: "var(--ease-out)" }}
                  >
                    <input
                      type="radio"
                      name="pack-pills"
                      value={b.id}
                      checked={selected}
                      onChange={() => select(b.id as BundleId)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-ink">
                      <span className="tabular">{b.vials}</span> {b.vials === 1 ? "vial" : "vials"}
                    </span>
                    <span className="tabular text-xs text-ink-soft">{formatMinor(perVialMinor(b))} each</span>
                    {saving > 0 ? <span className="tabular text-[11px] text-ink-soft">Save {saving}%</span> : null}
                    {free ? <span className="text-[11px] font-semibold text-brand-deep">Free delivery</span> : null}
                    {badge ? (
                      b.id === DEFAULT_BUNDLE_ID ? (
                        <TopBadge>{badge}</TopBadge>
                      ) : (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-brand/25 bg-paper px-2 text-[10px] font-semibold leading-4 text-brand-deep">
                          {badge}
                        </span>
                      )
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {/* How close the order is to free delivery, then the step up
              that gets it there, then the button. */}
          <DeliveryLine className="mt-5" />
          <div className="mt-4 empty:hidden">
            <UpsellNudge />
          </div>
          <div className="mt-5">
            <CheckoutRow cryptoEnabled={cryptoEnabled} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-6">
            <PlanPicker choice={choice} onChange={setChoice} />
          </div>
          <div className="mt-6">
            <PlanCheckoutRow plan={plan} />
          </div>
        </>
      )}

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm text-ink-soft">
            <CheckMark />
            {c.href ? (
              <a href={c.href} className="underline decoration-line underline-offset-4 hover:text-ink">
                {c.label}
              </a>
            ) : (
              c.label
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <PaymentMarks />
      </div>
      <div className="mt-6">
        <WelcomeVialPanel vials={once ? vials : plan.pack.vials} compact />
      </div>

      <details className="group mt-6 border-y border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          Delivery and returns
          <PlusMark />
        </summary>
        <ul className="space-y-2 pb-5 text-sm text-ink-soft">
          {DELIVERY.note ? <li>{DELIVERY.note}</li> : null}
          {DELIVERY.mode === "threshold" && DELIVERY.priceMinor !== null ? (
            <li>
              Below that, delivery is <span className="tabular">{formatMinor(DELIVERY.priceMinor)}</span>.
            </li>
          ) : null}
          <li>{planDeliverySentence()}</li>
          {times ? <li>{times}</li> : null}
          {DELIVERY.dispatchLine ? <li>{DELIVERY.dispatchLine}</li> : null}
          <li>You pay on Stripe&rsquo;s secure page, which also takes your delivery address.</li>
          <li>
            <Link href={RETURNS.path} className="link">
              Returns and refunds
            </Link>
          </li>
        </ul>
      </details>
    </div>
  );
}
