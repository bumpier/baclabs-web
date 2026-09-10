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

/**
 * Run `fn` once the provider's global exists.
 *
 * Both bootstraps mount with strategy="afterInteractive", i.e. AFTER
 * hydration, so an effect that fires on first paint — the Purchase tracker on
 * the confirmation page — can run a few milliseconds before window.fbq or
 * window.gtag is defined. A bare `window.fbq?.()` at that moment silently
 * drops the event, and because the tracker guards against double-firing it
 * is never retried: the conversion is lost for good. (Measured in a headless
 * run: tracker at 416ms, fbq defined at 421ms.)
 *
 * Once the global exists the vendor's own stub queues calls until the full
 * script arrives, so waiting for the global is all that is needed. Give up
 * after 10s — that is a pixel that is not configured or has been blocked.
 */
function whenDefined(
  key: "fbq" | "gtag",
  fn: () => void,
  deadline: number = Date.now() + 10_000
): void {
  if (typeof window[key] === "function") {
    fn();
    return;
  }
  if (Date.now() > deadline) return;
  setTimeout(() => whenDefined(key, fn, deadline), 100);
}

export function trackEvent(name: EventName, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  const spec = MAP[name];

  whenDefined("gtag", () => {
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
  });

  whenDefined("fbq", () => {
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
  });
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
