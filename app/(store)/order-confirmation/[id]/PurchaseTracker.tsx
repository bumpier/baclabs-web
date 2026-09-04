"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Fires the `purchase` conversion event exactly once per order.
 *
 * The guard is sessionStorage keyed on the order id, because this page
 * auto-refreshes every five seconds while the webhook is in flight and the
 * customer may also reload or return to the URL later. Without it, one order
 * would report several purchases and inflate every downstream number.
 *
 * The parent only renders this once the order is genuinely paid, so a
 * pending order never reports a conversion.
 */
export function PurchaseTracker({
  orderId,
  valueMinor,
  items,
}: {
  orderId: string;
  valueMinor: number;
  items: { item_id: string; item_name: string; price: number; quantity: number }[];
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const key = `purchase-tracked:${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode or blocked storage: fall through and fire once per mount
      // rather than losing the conversion entirely.
    }

    trackEvent("purchase", {
      currency: "GBP",
      value: valueMinor / 100,
      transactionId: orderId,
      items,
    });
  }, [orderId, valueMinor, items]);

  return null;
}
