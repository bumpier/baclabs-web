"use client";

import { useCallback, useEffect, useState } from "react";
import { PRODUCT, totalMinor as packsTotalMinor, type Bundle } from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { hasTrackingConsent } from "@/components/consent/consent-store";
import { useFunnel } from "@/components/funnel/FunnelState";

/**
 * Back from Stripe, a page restored from the back/forward cache would still
 * say "Redirecting…" with its button disabled. Clear it when that happens.
 */
export function useResetOnRestore(reset: () => void) {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [reset]);
}

/**
 * Pay for the current selection: the analytics event, the POST to
 * /api/checkout and the redirect to Stripe. Lifted out of the old
 * VialChooser so the buy box keeps charging exactly as it did.
 *
 * `checkoutPack` pays for a pack other than the selection: the upsell
 * dialog's offer, which the buy box never switches to.
 */
export function useCheckout() {
  const funnel = useFunnel();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useResetOnRestore(useCallback(() => setPending(false), []));

  async function checkoutPack(bundle: Bundle, quantity: number) {
    const totalMinor = packsTotalMinor(bundle, quantity);
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
        body: JSON.stringify({
          tierId: bundle.id,
          quantity,
          method: "card",
          trackingConsent: hasTrackingConsent(),
        }),
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

  // Takes no arguments, so it can be an onClick handler as it stands.
  function checkout() {
    return checkoutPack(funnel.bundle, funnel.quantity);
  }

  return { checkout, checkoutPack, pending, error };
}

/**
 * Pay for a monthly plan: one Stripe payment for the whole plan. Sends a pack
 * and a term, never an amount (PlanCheckoutSchema); the route prices it.
 */
export function usePlanCheckout(plan: { key: string; pack: { id: string; sku: string; vials: number }; months: number; totalMinor: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useResetOnRestore(useCallback(() => setPending(false), []));

  async function checkout() {
    setError(null);
    setPending(true);
    trackEvent("begin_checkout", {
      currency: "GBP",
      value: plan.totalMinor / 100,
      bundleId: plan.pack.id,
      quantity: 1,
      items: [
        {
          item_id: `${plan.pack.sku}-plan-${plan.months}`,
          item_name: `${PRODUCT.name} ${plan.pack.vials} × ${PRODUCT.size}, ${plan.months}-month plan`,
          price: plan.totalMinor / 100,
          quantity: 1,
        },
      ],
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "card",
          plan: { pack: plan.pack.id, months: plan.months },
          trackingConsent: hasTrackingConsent(),
        }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return { checkout, pending, error };
}
