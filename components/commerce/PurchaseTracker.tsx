"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

export interface PurchaseTrackerProps {
  orderId: string;
  /** Shared with the server-side Purchase, so Meta counts the order once. */
  eventId: string;
  /** What the customer was charged, delivery and discounts included. */
  valueMinor: number;
  contentIds: string[];
  numItems: number;
  items: { item_id: string; item_name: string; price: number; quantity: number }[];
  currency?: string;
}

/**
 * Fires the `purchase` conversion once per order, on a brand's confirmation
 * page. The same guard as BacLab's (app/(baclab)/.../PurchaseTracker.tsx):
 * sessionStorage keyed on the order id, because the page re-renders while
 * the webhook is in flight and the customer may reload or come back later.
 *
 * Render it only for an order that is paid (brandOrderView's `tracker` is
 * null until then), so a pending order never reports a conversion. Its
 * props come from lib/meta-capi-event.ts, as the server's Purchase does.
 */
export function PurchaseTracker({
  orderId,
  eventId,
  valueMinor,
  contentIds,
  numItems,
  items,
  currency = "GBP",
}: PurchaseTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const key = `purchase-tracked:${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode or blocked storage: fire once per mount rather than
      // losing the conversion.
    }

    trackEvent("purchase", {
      currency,
      value: valueMinor / 100,
      transactionId: orderId,
      items,
      eventId,
      contentIds,
      quantity: numItems,
    });
  }, [orderId, eventId, valueMinor, contentIds, numItems, items, currency]);

  return null;
}
