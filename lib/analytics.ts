/**
 * Analytics event layer.
 *
 * One vocabulary for the app, fanned out to whichever providers happen to be
 * configured. Every function is a no-op when nothing is installed, so calling
 * these is always safe and never needs a guard at the call site.
 *
 * Providers:
 *  - Meta Pixel — NEXT_PUBLIC_META_PIXEL_ID  (pre-existing, preserved)
 *  - GA4        — NEXT_PUBLIC_GA4_ID          (optional, added)
 *
 * Both are also allow-listed in the CSP in next.config.js. Without those
 * entries the pixel scripts are blocked and report nothing.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export interface EventParams {
  /** Value in major units (pounds), as GA4 and Meta both expect. */
  value?: number;
  currency?: string;
  bundleId?: string;
  vials?: number;
  quantity?: number;
  transactionId?: string;
  items?: { item_id: string; item_name: string; price: number; quantity: number }[];
}

type EventName = "view_item" | "select_bundle" | "begin_checkout" | "purchase";

/** GA4 name and Meta name for each of our events. */
const MAP: Record<EventName, { ga4: string; meta: string; metaStandard: boolean }> = {
  view_item: { ga4: "view_item", meta: "ViewContent", metaStandard: true },
  // Meta has no standard "chose a variant" event, so this goes out as a custom
  // event rather than being mislabelled as AddToCart.
  select_bundle: { ga4: "select_item", meta: "SelectBundle", metaStandard: false },
  begin_checkout: { ga4: "begin_checkout", meta: "InitiateCheckout", metaStandard: true },
  purchase: { ga4: "purchase", meta: "Purchase", metaStandard: true },
};

export function trackEvent(name: EventName, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  const spec = MAP[name];

  try {
    window.gtag?.("event", spec.ga4, {
      currency: params.currency,
      value: params.value,
      transaction_id: params.transactionId,
      items: params.items,
    });
  } catch {
    // Analytics must never break a purchase.
  }

  try {
    window.fbq?.(spec.metaStandard ? "track" : "trackCustom", spec.meta, {
      currency: params.currency,
      value: params.value,
      content_type: "product",
      content_ids: params.bundleId ? [params.bundleId] : undefined,
      num_items: params.quantity,
    });
  } catch {
    // As above.
  }
}

/** Re-fire a page view. The App Router soft-navigates, which pixels miss. */
export function trackPageView(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", "page_view", { page_location: url });
  } catch {
    /* no-op */
  }
  try {
    window.fbq?.("track", "PageView");
  } catch {
    /* no-op */
  }
}
