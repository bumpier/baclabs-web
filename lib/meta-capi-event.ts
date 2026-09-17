import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { bundleById } from "@/config/funnel";

/**
 * Meta Purchase event — the pure half. No network, no database, so it can be
 * tested with a tsx script (scripts/test-meta-capi.ts) like lib/consent.ts.
 * The sender is lib/meta-capi.ts.
 *
 * ONE PURCHASE, TWO REPORTS. The confirmation page fires the Pixel's
 * Purchase in the browser, and fulfillPaidOrder() sends the same Purchase
 * from the server through the Conversions API, so a customer who closes the
 * tab before the page loads is still counted. Meta keeps one of the two only
 * when they share an event id, which is why the id, the value and the content
 * ids all come from this file for BOTH sides.
 *
 * CONSENT. The server event only goes out for an order whose customer had
 * accepted tracking on the cookie banner at checkout. The banner promises
 * that a refusal sends Meta nothing; going round the browser does not change
 * that promise.
 */

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/**
 * The event id shared by the Pixel and the Conversions API.
 *
 * Derived from the order id rather than equal to it: the order id is the only
 * key to /order-confirmation/<id>, which shows the customer's email address,
 * so it is never handed to Meta.
 */
export function purchaseEventId(orderId: string): string {
  return `purchase_${sha256(`baclab-purchase:${orderId}`).slice(0, 32)}`;
}

/**
 * What the customer was actually charged, in pence: delivery included,
 * promotion codes applied. Orders paid before amountPaidMinor existed fall
 * back to the goods total, the only figure they recorded.
 */
export function paidMinor(order: {
  amountPaidMinor: number | null;
  totalAmount: { toString(): string };
}): number {
  return order.amountPaidMinor ?? Math.round(Number(order.totalAmount.toString()) * 100);
}

/** One content entry per order line, keyed by the bundle's SKU. */
export function purchaseContents(itemsJson: string): { id: string; quantity: number }[] {
  let items: unknown;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw as { bundleId?: string; bundleQty?: number };
    const bundle = item.bundleId ? bundleById(item.bundleId) : undefined;
    return {
      id: bundle?.sku ?? item.bundleId ?? "baclab-10ml",
      quantity: item.bundleQty ?? 1,
    };
  });
}

// ── Normalisation ──────────────────────────────────────────────────
// Meta matches customers by hashing what it holds and comparing hashes, so
// each field must be normalised exactly as Meta's customer-information
// parameters specify before it is hashed, or it never matches.

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Digits only, with the country code and no leading zero or "+". */
export function normalisePhone(raw: string, country: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  // A UK number typed nationally, e.g. 07700 900123.
  if (country.toUpperCase() === "GB" && digits.startsWith("0")) return `44${digits.slice(1)}`;
  return digits;
}

/** Lowercase letters only: names and towns lose spaces and punctuation. */
export function normaliseLetters(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^\p{L}\p{M}]/gu, "");
}

export function normalisePostcode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts[parts.length - 1]! : "" };
}

// ── Checkout-time attribution ──────────────────────────────────────
// The webhook arrives from Stripe's servers, so the customer's IP, browser
// and Meta cookies can only be read while the customer's own request is in
// hand, at checkout.

const FBP = /^fb\.\d\.\d{10,16}\.\d{1,24}$/;
const FBC = /^fb\.\d\.\d{10,16}\.[\w-]{1,500}$/;

export function readMetaCookies(cookieHeader: string | null): { fbp: string | null; fbc: string | null } {
  let fbp: string | null = null;
  let fbc: string | null = null;
  for (const part of (cookieHeader ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      continue;
    }
    if (name === "_fbp" && FBP.test(value)) fbp = value;
    if (name === "_fbc" && FBC.test(value)) fbc = value;
  }
  return { fbp, fbc };
}

export interface CheckoutAttribution {
  trackingConsent: boolean;
  clientIp: string | null;
  clientUserAgent: string | null;
  fbp: string | null;
  fbc: string | null;
}

/**
 * What to store on a new order. Without consent nothing is kept — not just
 * not sent — so an order never holds identifiers it has no use for.
 */
export function attributionFor(
  consented: boolean,
  request: { cookie: string | null; userAgent: string | null; ip: string | null }
): CheckoutAttribution {
  if (!consented) {
    return { trackingConsent: false, clientIp: null, clientUserAgent: null, fbp: null, fbc: null };
  }
  const ip = request.ip?.trim() ?? "";
  return {
    trackingConsent: true,
    clientIp: isIP(ip) ? ip : null,
    clientUserAgent: request.userAgent?.trim().slice(0, 512) || null,
    ...readMetaCookies(request.cookie),
  };
}

// ── The event ──────────────────────────────────────────────────────

export interface PurchaseOrder {
  id: string;
  items: string;
  totalAmount: { toString(): string };
  amountPaidMinor: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  trackingConsent: boolean;
  clientIp: string | null;
  clientUserAgent: string | null;
  fbp: string | null;
  fbc: string | null;
}

export interface MetaServerEvent {
  event_name: "Purchase";
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url: string;
  user_data: Record<string, string>;
  custom_data: {
    currency: "GBP";
    value: number;
    content_type: "product";
    content_ids: string[];
    contents: { id: string; quantity: number }[];
    num_items: number;
  };
}

/**
 * The Conversions API Purchase for a paid order, or null when it must not be
 * sent: no consent, or no user agent (which Meta requires on website events,
 * and which a consenting checkout always records).
 */
export function buildPurchaseEvent(
  order: PurchaseOrder,
  opts: { eventTime: number; eventSourceUrl: string }
): MetaServerEvent | null {
  if (!order.trackingConsent || !order.clientUserAgent) return null;

  let address: { city?: string; country?: string; postalCode?: string } = {};
  try {
    address = order.shippingAddress ? JSON.parse(order.shippingAddress) : {};
  } catch {
    // An unreadable address only costs match quality.
  }
  const country = address.country ?? "";
  const { first, last } = splitName(order.customerName);

  const user_data: Record<string, string> = {};
  const hashed = (key: string, value: string) => {
    if (value) user_data[key] = sha256(value);
  };
  hashed("em", normaliseEmail(order.customerEmail));
  hashed("ph", normalisePhone(order.customerPhone, country));
  hashed("fn", normaliseLetters(first));
  hashed("ln", normaliseLetters(last));
  hashed("ct", normaliseLetters(address.city ?? ""));
  hashed("zp", normalisePostcode(address.postalCode ?? ""));
  hashed("country", /^[a-z]{2}$/i.test(country) ? country.toLowerCase() : "");
  // These four are sent as they are: Meta requires them unhashed.
  user_data.client_user_agent = order.clientUserAgent;
  if (order.clientIp) user_data.client_ip_address = order.clientIp;
  if (order.fbp) user_data.fbp = order.fbp;
  if (order.fbc) user_data.fbc = order.fbc;

  const contents = purchaseContents(order.items);
  return {
    event_name: "Purchase",
    event_time: opts.eventTime,
    event_id: purchaseEventId(order.id),
    action_source: "website",
    event_source_url: opts.eventSourceUrl,
    user_data,
    custom_data: {
      currency: "GBP",
      value: paidMinor(order) / 100,
      content_type: "product",
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
    },
  };
}
