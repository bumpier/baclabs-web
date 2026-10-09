"use client";

import {
  DELIVERY,
  formatMinor,
  formatMinorShort,
  freeDeliveryName,
  remainingForFreeDeliveryMinor,
  shipsFree,
} from "@/config/funnel";

/**
 * How far an order is from free delivery: one line and a bar filling toward
 * the threshold. The same functions the Stripe session calls, so the bar
 * cannot show free what will be charged. Renders nothing unless delivery
 * has a threshold, so it never implies an offer the shop doesn't make.
 *
 * `scale` swaps the sentence for the bar's two ends ("£34.99 in your order",
 * "Free from £40"), for the upsell dialog, whose heading already says how
 * far away free delivery is.
 */
export function FreeDeliveryMeter({
  goodsMinor,
  scale = false,
  className = "",
}: {
  goodsMinor: number;
  scale?: boolean;
  className?: string;
}) {
  if (DELIVERY.mode !== "threshold" || DELIVERY.freeFromMinor === null) return null;
  const free = shipsFree(goodsMinor);
  const toFree = remainingForFreeDeliveryMinor(goodsMinor);
  // A sliver even for one vial, so the bar reads as a bar and not a gap.
  const filled = free ? 100 : Math.min(100, Math.max(4, Math.round((goodsMinor / DELIVERY.freeFromMinor) * 100)));

  const bar = (
    <div aria-hidden="true" className={`h-1.5 overflow-hidden rounded-full bg-line ${scale ? "" : "mt-2"}`}>
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${filled}%`, transitionTimingFunction: "var(--ease-out)" }}
      />
    </div>
  );

  if (scale) {
    return (
      <div className={className}>
        {bar}
        <p className="mt-1.5 flex justify-between gap-3 text-xs text-ink-soft">
          <span>
            <span className="tabular">{formatMinor(goodsMinor)}</span> in your order
          </span>
          <span>
            Free from <span className="tabular">{formatMinorShort(DELIVERY.freeFromMinor)}</span>
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p aria-live="polite" className="text-sm text-ink">
        {free ? (
          <>
            <span className="font-semibold">Free {freeDeliveryName()}</span> on this order
          </>
        ) : (
          <>
            <span className="tabular font-semibold">{formatMinor(toFree)}</span> away from free {freeDeliveryName()}
          </>
        )}
      </p>
      {/* The sentence above says it; the bar only shows it. */}
      {bar}
    </div>
  );
}
