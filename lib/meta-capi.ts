import { getBrandMetaPixelId } from "@/lib/settings";
import { brandFor, type BrandProfile } from "@/brands/registry";
import { buildPurchaseEvent, type PurchaseOrder } from "@/lib/meta-capi-event";

/**
 * Meta Conversions API — the sending half. The event itself is built in
 * lib/meta-capi-event.ts; see there for consent and deduplication.
 *
 * Configured by environment, not the admin panel, because the access token is
 * a secret and the Setting table is readable by every admin:
 *
 *  - META_CAPI_ACCESS_TOKEN     — from Events Manager → the pixel → Settings →
 *                                 Conversions API → Generate access token.
 *                                 Unset means no server events.
 *  - META_CAPI_TEST_EVENT_CODE  — optional. Routes events to Events Manager's
 *                                 "Test events" tab instead of live reporting.
 *                                 Remove once verified.
 *  - META_GRAPH_API_VERSION     — optional, defaults below.
 *  - META_CAPI_ACCESS_TOKEN__<BRAND> — optional, per brand (e.g. __GYM): a
 *                                 token for that brand's own dataset. Unset
 *                                 falls back to META_CAPI_ACCESS_TOKEN.
 *
 * Each order reports to its own brand's pixel (getBrandMetaPixelId in
 * lib/settings.ts), the one in force for that brand's browser pages, so the
 * two reports always land on the same dataset and no brand's sales show up
 * in another's.
 */

const DEFAULT_GRAPH_API_VERSION = "v26.0";

function graphApiVersion(): string {
  const configured = process.env.META_GRAPH_API_VERSION?.trim() ?? "";
  return /^v\d+\.\d+$/.test(configured) ? configured : DEFAULT_GRAPH_API_VERSION;
}

/** The access token for one brand's events, or undefined when it has none. Read at call time. */
export function capiAccessToken(b: Pick<BrandProfile, "id">): string | undefined {
  return (
    process.env[`META_CAPI_ACCESS_TOKEN__${b.id.toUpperCase()}`]?.trim() ||
    process.env.META_CAPI_ACCESS_TOKEN?.trim() ||
    undefined
  );
}

/**
 * Report a paid order to Meta. NEVER THROWS and never needs awaiting: the
 * order is already paid, and a Meta outage must not fail the payment webhook
 * — the provider's retry would find a non-pending order and do nothing.
 */
export async function sendMetaPurchase(order: PurchaseOrder): Promise<void> {
  try {
    const b = brandFor(order.brand);
    const token = capiAccessToken(b);
    if (!token) return;

    const event = buildPurchaseEvent(order, {
      eventTime: Math.floor(Date.now() / 1000),
      // On the brand's own site. Deliberately without the order id — see
      // purchaseEventId().
      eventSourceUrl: `${b.origin}/order-confirmation`,
    });
    if (!event) return;

    const pixelId = await getBrandMetaPixelId(b);
    if (!pixelId) return;

    const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
    const body = JSON.stringify({
      data: [event],
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
      // In the body rather than the query string, so it stays out of any
      // request log along the way.
      access_token: token,
    });
    const url = `https://graph.facebook.com/${graphApiVersion()}/${pixelId}/events`;

    // One retry, for a network failure or a 5xx. A 4xx is a bad token or a
    // malformed event, which a retry cannot fix.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          console.log(`[meta-capi] Purchase sent for order ${order.id} (${event.event_id})`);
          return;
        }
        const detail = (await res.text()).slice(0, 500);
        console.error(`[meta-capi] Purchase for order ${order.id} rejected: HTTP ${res.status} ${detail}`);
        if (res.status < 500) return;
      } catch (err) {
        console.error(`[meta-capi] Purchase for order ${order.id} failed to send`, (err as Error).message);
      }
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  } catch (err) {
    console.error(`[meta-capi] Purchase for order ${order.id} could not be built`, err);
  }
}
