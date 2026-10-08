"use client";

import { useState } from "react";
import { PRODUCT } from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { hasTrackingConsent } from "@/components/consent/consent-store";
import { useFunnel } from "@/components/funnel/FunnelState";

/**
 * Pay for the current selection: the analytics event, the POST to
 * /api/checkout and the redirect to Stripe. Lifted out of the old
 * VialChooser so the buy box keeps charging exactly as it did.
 */
export function useCheckout() {
  const { bundle, quantity, totalMinor } = useFunnel();
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

  return { checkout, pending, error };
}
