"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { hasTrackingConsent } from "@/components/consent/consent-core";
import { useCart } from "@/components/commerce/cart";
import { startCheckout } from "@/lib/commerce/start-checkout";
import { priceBasket, type BasketLine } from "@/lib/commerce/view";

/**
 * Pay for the basket, or for lines given directly (a "buy now" button):
 * the begin_checkout event, the POST (startCheckout) and the move to the
 * page the checkout answers with, wherever that is (another site's payment
 * page or one of this site's). Sends the cookie banner's answer with the
 * order, so the server reports the purchase to Meta only for a customer who
 * accepted.
 *
 * `pending` stays true once the move starts, so the button does not flash
 * back to its idle label while the page navigates away; it is reset when the
 * browser restores this page from its back/forward cache (the customer
 * pressed back on the payment page). `error` is the checkout's own sentence,
 * ready to show in a role="alert" region.
 *
 * `opts` carries what the buyer chose on the page: the delivery option, the
 * payment method (one of the view's payment.methods) and, on a trade site,
 * their business details.
 */
export function useBrandCheckout() {
  const cart = useCart();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const { lines: basket, storefront } = cart;
  const checkout = useCallback(
    async (
      opts: {
        lines?: readonly BasketLine[];
        deliveryOption?: string;
        method?: string;
        business?: { company?: string; vatNumber?: string };
      } = {}
    ) => {
      const lines = opts.lines ?? basket;
      const priced = priceBasket(storefront, lines);
      if (priced.items.length === 0) {
        setError("Choose a pack first.");
        return;
      }
      setError(null);
      setPending(true);
      trackEvent("begin_checkout", {
        currency: storefront.currency,
        value: priced.goodsMinor / 100,
        quantity: priced.items.reduce((n, i) => n + i.qty, 0),
        contentIds: priced.items.map((i) => i.sku),
        items: priced.items.map((i) => ({
          item_id: i.sku,
          item_name: i.kind === "pack" ? `${i.pack.vials}-vial pack` : i.addOn.name,
          price: (i.kind === "pack" ? i.pack.priceMinor : i.addOn.priceMinor) / 100,
          quantity: i.qty,
        })),
      });
      // The checkout is the authority on every refusal, so nothing else is
      // checked here: its answer is shown word for word.
      const result = await startCheckout({
        lines: priced.items.map((i) => ({ sku: i.sku, qty: i.qty })),
        deliveryOption: opts.deliveryOption,
        method: opts.method,
        business: opts.business,
        tracking: hasTrackingConsent(),
      });
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.assign(result.url);
    },
    [basket, storefront]
  );

  const clearError = useCallback(() => setError(null), []);
  return { checkout, pending, error, clearError };
}
