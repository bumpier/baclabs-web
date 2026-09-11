"use client";

import { useEffect, useState } from "react";
import {
  formatMinor,
  formatMinorShort,
  freeDeliveryBadge,
  PRICE_MATCH_BADGE,
  remainingForFreeDeliveryMinor,
  shipsFree,
  VIAL_ML,
} from "@/config/funnel";
import { useFunnel } from "@/components/funnel/FunnelState";
import { useHeroCtaPassed } from "@/lib/use-hero-cta-passed";

/**
 * Mobile-only bottom bar: what is currently selected, and a way back to the
 * purchase block.
 *
 * Two rules govern when it shows:
 *  1. Not until the hero CTA has scrolled away — before that it is noise.
 *     This is now an observer on the hero CTA itself rather than a hard-coded
 *     `scrollY > 520`, which on a 390×844 phone fired about 100px of scroll
 *     before the button it replaces had actually gone.
 *  2. Never while the purchase block itself is on screen — a floating button
 *     covering the real button it points at is a dark pattern, not a
 *     convenience.
 *
 * The page reserves space at its foot so the bar can never cover the footer's
 * legal links.
 *
 * Its travel lives in `.sheet-bottom` rather than an inline transform, so the
 * reduced-motion block can remove the slide while keeping the fade.
 */
export function StickyBuyBar() {
  const { bundle, quantity, totalMinor } = useFunnel();
  const heroCtaPassed = useHeroCtaPassed();
  const [buyBlockVisible, setBuyBlockVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById("buy");
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setBuyBlockVisible(entry.isIntersecting),
      // Any part of the block on screen counts as "they can see the real one".
      { rootMargin: "-80px 0px -120px 0px" }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  const shown = heroCtaPassed && !buyBlockVisible;
  const totalVials = bundle.vials * quantity;

  // The same two functions the purchase block and the Stripe session call, so
  // this bar can never promise free delivery on a basket that will be charged
  // for it. `remainingForFreeDeliveryMinor` returns 0 both when the order
  // already ships free and when no threshold applies, which is why the free
  // case is tested first and the plain badge is the fallback.
  const toFreeDelivery = remainingForFreeDeliveryMinor(totalMinor);
  const deliveryLine = shipsFree(totalMinor)
    ? "Free UK delivery"
    : toFreeDelivery > 0
      ? `${formatMinorShort(toFreeDelivery)} to free delivery`
      : freeDeliveryBadge();

  return (
    <div
      className="sheet-bottom no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 shadow-bar lg:hidden"
      data-shown={shown ? "true" : "false"}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      // `.sheet-bottom` also sets visibility, which keeps this out of the tab
      // order and off the accessibility tree while it is hidden.
      aria-hidden={!shown}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-soft">
            <span className="tabular">{totalVials}</span> ×{" "}
            {totalVials === 1 ? "vial" : "vials"}, {VIAL_ML}ml
          </p>
          <p className="tabular text-lg font-semibold leading-tight text-ink">
            {formatMinor(totalMinor)}
          </p>
          {/* Third line, carrying two claims. Kept to ONE line deliberately:
              the page reserves a fixed strip of space for this bar, so a
              fourth line would sit over the footer links rather than above
              them. The delivery half is the live one — it counts down to the
              threshold as the basket grows. */}
          <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-soft">
            {deliveryLine ? (
              <>
                <span className="truncate font-medium text-ink">{deliveryLine}</span>
                <span aria-hidden="true">&middot;</span>
              </>
            ) : null}
            <a
              href="#guarantee"
              className="truncate underline decoration-line underline-offset-2"
            >
              {PRICE_MATCH_BADGE}
            </a>
          </p>
        </div>
        <a
          href="#buy"
          className="btn-cta !min-h-[48px] !w-auto shrink-0 !px-6"
          tabIndex={shown ? undefined : -1}
        >
          Buy now
        </a>
      </div>
    </div>
  );
}
