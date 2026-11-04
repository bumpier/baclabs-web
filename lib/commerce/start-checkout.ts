"use client";

/**
 * The browser half of a brand's checkout: POST /api/checkout with the
 * contract lib/commerce/checkout.ts serves, and say what came back. The
 * redirect, the pending state and the analytics event are the caller's
 * (components/commerce/useBrandCheckout.ts), so a storefront can also call
 * this bare, from a "buy now" button that has no basket.
 *
 * Sends SKUs and counts only, never a price and never a brand: the server
 * reads the brand from the Host and prices every line from its catalogue.
 * BacLab's checkout is components/funnel/buy/useCheckout.ts, a different
 * request on a different branch of the route, and never this.
 *
 * The answer's `url` is where the browser goes to pay. It is not assumed to
 * be any one provider's page: it may be another site, or a page of this one
 * (an on-site pay page, "/checkout/pay/<id>").
 */

export interface StartCheckoutInput {
  lines: readonly { sku: string; qty: number }[];
  /**
   * The delivery option the buyer chose on this page ("standard",
   * "next_day"). Required while more than one is offered for the order.
   */
  deliveryOption?: string;
  /** One of the view's payment.methods ids. Required while more than one is offered. */
  method?: string;
  /** A trade buyer's details, for a catalogue that asks (flags.businessDetails). Both optional. */
  business?: { company?: string; vatNumber?: string };
  /** The buyer's gift note, for a catalogue that offers one (flags.giftNote). Blank sends none. */
  giftNote?: string;
  /** The cookie banner's answer at this moment (hasTrackingConsent()). */
  tracking: boolean;
}

export type StartCheckoutResult = { ok: true; url: string } | { ok: false; error: string; status: number };

const FAILED = "Something went wrong. Please try again.";

/** A site path, or an absolute http(s) URL: anything else is not somewhere to send a customer. */
export function isRedirectTarget(url: string): boolean {
  if (url.startsWith("/")) return !url.startsWith("//");
  return /^https?:\/\//i.test(url);
}

export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: input.lines.map((l) => ({ sku: l.sku, qty: l.qty })),
        ...(input.deliveryOption ? { deliveryOption: input.deliveryOption } : {}),
        ...(input.method ? { method: input.method } : {}),
        ...(input.business && (input.business.company || input.business.vatNumber) ? { business: input.business } : {}),
        ...(input.giftNote?.trim() ? { giftNote: input.giftNote } : {}),
        consent: { tracking: input.tracking },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
    if (res.ok && typeof data.url === "string" && isRedirectTarget(data.url)) return { ok: true, url: data.url };
    // Every refusal is a sentence the storefront can show as it stands.
    const error = !res.ok && typeof data.error === "string" && data.error ? data.error : FAILED;
    return { ok: false, error, status: res.status };
  } catch {
    return { ok: false, error: FAILED, status: 0 };
  }
}
