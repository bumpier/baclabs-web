/**
 * PayPal for the brands: Orders v2 over REST from the server, as a redirect.
 * No PayPal script runs on our pages. The checkout creates a PayPal order
 * for ours and sends the buyer to PayPal's page; PayPal sends them back to
 * /api/payments/paypal/return, where the payment is captured
 * (paypal-settle.ts). /api/webhooks/paypal is the backup for a buyer who
 * closes the tab after approving.
 *
 * SERVER ONLY: it reads the brand's credentials from env and calls PayPal.
 *
 * CREDENTIALS are strictly the brand's own, by its id, and all four are
 * required:
 *   PAYPAL_CLIENT_ID__<ID>, PAYPAL_CLIENT_SECRET__<ID>,
 *   PAYPAL_WEBHOOK_ID__<ID>, PAYPAL_ENV__<ID> = sandbox | live
 * There is no shared PAYPAL_CLIENT_ID, no default environment and no
 * fallback to another brand's account, so a brand reaches PayPal only by
 * deliberate config. No brand lists PayPal today: all four take cards on
 * BacLab's Stripe account (lib/commerce/payments/stripe.ts), and a brand
 * moves here by its profile and these four variables alone. Never the gym
 * brand (brands/gym/profile.ts gives the reason).
 *
 * Every field below was checked against PayPal's own documentation on
 * 4 Nov 2026:
 *  - Orders v2, the OpenAPI spec v2.36 (create, capture, show order details,
 *    payment_source.paypal.experience_context, item and amount rules):
 *    https://developer.paypal.com/docs/api/orders/v2/ and
 *    https://developer.paypal.com/api/orders/v2/schema.json
 *  - Errors: https://developer.paypal.com/api/rest/reference/orders/v2/errors/
 *  - OAuth: https://developer.paypal.com/api/rest/authentication/
 *  - Webhook signature: https://developer.paypal.com/docs/api/webhooks/v1/
 *    (verify-webhook-signature) and https://developer.paypal.com/api/rest/webhooks/rest/
 *  - Hosts: https://developer.paypal.com/api/rest/production/
 */
import { DEFAULT_BRAND, type BrandProfile } from "@/brands/types";
import { brandLineName } from "@/lib/commerce/catalogue";
import type { CreatedPayment, PaymentAdapter, PaymentOrder } from "@/lib/commerce/payments/types";

export type PayPalEnvironment = "sandbox" | "live";

const API_BASE: Record<PayPalEnvironment, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/** Per call. PayPal usually answers in well under a second. */
const TIMEOUT_MS = 15_000;

export interface PayPalCredentials {
  brandId: string;
  clientId: string;
  clientSecret: string;
  webhookId: string;
  environment: PayPalEnvironment;
  apiBase: string;
}

/** `PAYPAL_CLIENT_ID__LUXURY`: one of a brand's own PayPal settings. */
export function paypalEnvName(name: "CLIENT_ID" | "CLIENT_SECRET" | "WEBHOOK_ID" | "ENV", brandId: string): string {
  return `PAYPAL_${name}__${brandId.toUpperCase()}`;
}

const warned = new Set<string>();

/**
 * The brand's own PayPal credentials, or null unless all four are set and
 * PAYPAL_ENV__<ID> is exactly "sandbox" or "live". Never BacLab's: BacLab
 * takes cards through Stripe on its own checkout. A brand with some set and
 * some missing is logged once, by name, never by value.
 */
export function paypalCredentials(brandId: string): PayPalCredentials | null {
  if (brandId === DEFAULT_BRAND) return null;
  const read = (name: Parameters<typeof paypalEnvName>[0]) => process.env[paypalEnvName(name, brandId)]?.trim() ?? "";
  const clientId = read("CLIENT_ID");
  const clientSecret = read("CLIENT_SECRET");
  const webhookId = read("WEBHOOK_ID");
  const env = read("ENV").toLowerCase();
  const environment = env === "sandbox" || env === "live" ? env : null;
  if (clientId && clientSecret && webhookId && environment) {
    return { brandId, clientId, clientSecret, webhookId, environment, apiBase: API_BASE[environment] };
  }
  if ((clientId || clientSecret || webhookId || env) && !warned.has(brandId)) {
    warned.add(brandId);
    const missing = (["CLIENT_ID", "CLIENT_SECRET", "WEBHOOK_ID", "ENV"] as const).filter((n) =>
      n === "ENV" ? !environment : !read(n)
    );
    console.error(
      `[paypal] ${brandId}: PayPal is off until ${missing.map((n) => paypalEnvName(n, brandId)).join(", ")} ${missing.length > 1 ? "are" : "is"} set` +
        (env && !environment ? ` (${paypalEnvName("ENV", brandId)} must be "sandbox" or "live")` : "")
    );
  }
  return null;
}

// ── Talking to PayPal ────────────────────────────────────────────────

/** A refusal or failure from PayPal, for the log. Never shown to a customer. */
export class PayPalError extends Error {
  constructor(
    readonly what: string,
    readonly status: number,
    /** The first `details[].issue`, or the error `name`: ORDER_ALREADY_CAPTURED, INSTRUMENT_DECLINED. */
    readonly issue: string | null,
    readonly debugId: string | null
  ) {
    super(`PayPal ${what} failed: HTTP ${status}${issue ? ` ${issue}` : ""}${debugId ? ` (debug id ${debugId})` : ""}`);
    this.name = "PayPalError";
  }
}

type Json = Record<string, unknown>;

async function readJson(res: Response): Promise<Json | null> {
  try {
    const data: unknown = await res.json();
    return data && typeof data === "object" ? (data as Json) : null;
  } catch {
    return null;
  }
}

function issueOf(data: Json | null): string | null {
  const details = data?.details;
  const first = Array.isArray(details) ? (details[0] as Json | undefined) : undefined;
  if (typeof first?.issue === "string") return first.issue;
  return typeof data?.name === "string" ? data.name : null;
}

/**
 * OAuth tokens, one per brand. PayPal's last a few hours (expires_in, in
 * seconds); each is renewed a minute before it runs out, or at once when a
 * call is refused with 401. Keyed by the client id and environment too, so a
 * changed credential is never served an old token.
 */
const tokens = new Map<string, { key: string; token: string; expiresAt: number }>();

async function accessToken(creds: PayPalCredentials, fresh = false): Promise<string> {
  const key = `${creds.environment}:${creds.clientId}`;
  const hit = tokens.get(creds.brandId);
  if (!fresh && hit && hit.key === key && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const res = await fetch(`${creds.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await readJson(res);
  if (!res.ok || typeof data?.access_token !== "string") throw new PayPalError("token", res.status, issueOf(data), res.headers.get("paypal-debug-id"));
  const seconds = typeof data.expires_in === "number" ? data.expires_in : 0;
  tokens.set(creds.brandId, { key, token: data.access_token, expiresAt: Date.now() + seconds * 1000 });
  return data.access_token;
}

/** TESTS ONLY: forget every cached token. */
export function __clearPayPalTokens(): void {
  tokens.clear();
}

async function call(
  creds: PayPalCredentials,
  method: "GET" | "POST",
  path: string,
  opts: { body?: string; requestId?: string; prefer?: string } = {}
): Promise<{ status: number; data: Json | null; debugId: string | null }> {
  const send = async (token: string) =>
    fetch(`${creds.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        // Idempotency: PayPal answers a repeat of the same id with the
        // first call's result instead of acting twice.
        ...(opts.requestId ? { "PayPal-Request-Id": opts.requestId } : {}),
        ...(opts.prefer ? { Prefer: opts.prefer } : {}),
      },
      body: opts.body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  let res = await send(await accessToken(creds));
  if (res.status === 401) res = await send(await accessToken(creds, true));
  return { status: res.status, data: await readJson(res), debugId: res.headers.get("paypal-debug-id") };
}

// ── Creating the PayPal order ────────────────────────────────────────

/** "12.34": PayPal's money value for pence. */
function gbp(minor: number): { currency_code: "GBP"; value: string } {
  return { currency_code: "GBP", value: (minor / 100).toFixed(2) };
}

/** PayPal truncates soft_descriptor to 22 characters, the most a statement shows. */
export const SOFT_DESCRIPTOR_MAX = 22;
/** PayPal truncates item names and brand_name to 127. */
const NAME_MAX = 127;

/** Where PayPal sends the buyer back to: our order's id is in it, PayPal's is not needed. */
export function paypalReturnUrl(brand: Pick<BrandProfile, "origin">, orderId: string): string {
  return `${brand.origin}/api/payments/paypal/return?order=${encodeURIComponent(orderId)}`;
}

/** Where a buyer who cancels on PayPal's page lands: the buy section, which says so. */
export function paypalCancelUrl(brand: Pick<BrandProfile, "origin">): string {
  return `${brand.origin}/?payment=cancelled`;
}

/**
 * The create-order body. Pure, so scripts/test-paypal.ts can read every
 * field. Item names are the neutral ones the order itself carries
 * ("10ml bacteriostatic water × 3"); the brand appears only as brand_name on
 * PayPal's page. The amounts are whole pence, so the breakdown always sums:
 * value = item_total + shipping, and item_total = Σ unit_amount × quantity,
 * which PayPal checks (AMOUNT_MISMATCH, ITEM_TOTAL_MISMATCH).
 */
export function paypalOrderBody(order: PaymentOrder, brand: Pick<BrandProfile, "name" | "origin" | "statementDescriptor">): Json {
  const itemTotal = order.lines.reduce((n, l) => n + l.unitMinor * l.quantity, 0);
  if (itemTotal !== order.goodsMinor) throw new Error(`paypalOrderBody: lines sum to ${itemTotal}, the order to ${order.goodsMinor}`);
  const descriptor = brand.statementDescriptor?.trim().slice(0, SOFT_DESCRIPTOR_MAX);
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        // Ours, both: custom_id comes back on the capture and on every
        // webhook about it; invoice_id is unique per PayPal account, so the
        // same order can never be paid twice under two PayPal orders.
        custom_id: order.id,
        invoice_id: order.id,
        ...(descriptor ? { soft_descriptor: descriptor } : {}),
        amount: {
          ...gbp(order.goodsMinor + order.delivery.priceMinor),
          breakdown: { item_total: gbp(itemTotal), shipping: gbp(order.delivery.priceMinor) },
        },
        items: order.lines.map((line) => ({
          name: brandLineName(line).slice(0, NAME_MAX),
          quantity: String(line.quantity),
          unit_amount: gbp(line.unitMinor),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: brand.name.slice(0, NAME_MAX),
          // PayPal collects the address from the buyer's account; the
          // capture hands it back and we ship to it (UK only: paypal-settle.ts
          // refuses to capture for any other country).
          shipping_preference: "GET_FROM_FILE",
          // "Pay Now" on PayPal's page: the buyer is not sent back to review.
          user_action: "PAY_NOW",
          locale: "en-GB",
          // No eCheque-style payments that sit pending for days: the capture
          // either clears or fails while the buyer waits.
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          return_url: paypalReturnUrl(brand, order.id),
          cancel_url: paypalCancelUrl(brand),
        },
      },
    },
  };
}

/** A PayPal page: https on paypal.com or a subdomain. Anything else is not sent to a buyer. */
export function isPayPalPage(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "paypal.com" || u.hostname.endsWith(".paypal.com"));
  } catch {
    return false;
  }
}

/**
 * The page to send the buyer to. With payment_source.paypal the documented
 * link is rel "payer-action"; "approve" is the older one, read only if the
 * other is missing.
 */
function buyerLink(data: Json | null): string | null {
  const links = Array.isArray(data?.links) ? (data.links as Json[]) : [];
  const href = (rel: string) => links.find((l) => l.rel === rel && typeof l.href === "string")?.href as string | undefined;
  return href("payer-action") ?? href("approve") ?? null;
}

async function createPayment(order: PaymentOrder, ctx: { brand: BrandProfile }): Promise<CreatedPayment> {
  const creds = paypalCredentials(ctx.brand.id);
  if (!creds) throw new Error(`PayPal is not configured for ${ctx.brand.id}`);
  const res = await call(creds, "POST", "/v2/checkout/orders", {
    body: JSON.stringify(paypalOrderBody(order, ctx.brand)),
    requestId: `create-${order.id}`,
    prefer: "return=minimal",
  });
  if (res.status !== 200 && res.status !== 201) throw new PayPalError("create order", res.status, issueOf(res.data), res.debugId);
  const url = buyerLink(res.data);
  const ref = typeof res.data?.id === "string" ? res.data.id : null;
  if (!ref || !url || !isPayPalPage(url)) throw new PayPalError("create order (no buyer link)", res.status, null, res.debugId);
  return { url, ref };
}

export const paypalAdapter: PaymentAdapter = {
  id: "paypal",
  label: "PayPal",
  configured: (brand) => paypalCredentials(brand.id) !== null,
  createPayment,
};

// ── Reading a PayPal order ───────────────────────────────────────────

/** Our address shape (lib/orderAddress.ts), as the Stripe webhook writes it. */
export interface PayPalAddress {
  line1: string;
  line2: string | null;
  city: string;
  country: string;
  postalCode: string;
}

export interface PayPalOrderSummary {
  /** PayPal's order id. */
  id: string;
  /** CREATED | SAVED | APPROVED | VOIDED | COMPLETED | PAYER_ACTION_REQUIRED. */
  status: string;
  /** Ours, from purchase_units[0].custom_id. */
  customId: string | null;
  /** The one capture, once there is one. */
  capture: {
    id: string;
    /** COMPLETED | DECLINED | PARTIALLY_REFUNDED | PENDING | REFUNDED | FAILED. */
    status: string;
    amountMinor: number;
    currency: string;
    /** status_details.reason, for a pending or declined one. */
    reason: string | null;
  } | null;
  name: string;
  email: string;
  phone: string;
  address: PayPalAddress | null;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : undefined);

/** Pence from PayPal's "12.34". */
export function paypalMinor(value: unknown): number {
  const n = Number(str(value));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/**
 * What we need from a PayPal order (create, capture or show details). Name,
 * email and phone come from payment_source.paypal first, then the older
 * `payer`; the address and the delivery name from purchase_units[0].shipping.
 * The phone is there only when the account's settings share it.
 */
export function readPayPalOrder(data: Json | null): PayPalOrderSummary {
  const unit = obj(first(data?.purchase_units));
  const payments = obj(unit.payments);
  const c = first(payments.captures) as Json | undefined;
  const amount = obj(c?.amount);
  const shipping = obj(unit.shipping);
  const address = obj(shipping.address);
  const source = obj(obj(data?.payment_source).paypal);
  const payer = obj(data?.payer);
  const fullName = (n: Json) => [str(n.given_name), str(n.surname)].filter(Boolean).join(" ");
  const phoneOf = (p: Json) => str(obj(p.phone_number).national_number);
  return {
    id: str(data?.id),
    status: str(data?.status),
    customId: str(unit.custom_id) || null,
    capture: c
      ? {
          id: str(c.id),
          status: str(c.status),
          amountMinor: paypalMinor(amount.value),
          currency: str(amount.currency_code),
          reason: str(obj(c.status_details).reason) || null,
        }
      : null,
    name: str(obj(shipping.name).full_name) || fullName(obj(source.name)) || fullName(obj(payer.name)),
    email: str(source.email_address) || str(payer.email_address),
    phone: phoneOf(source) || phoneOf(obj(payer.phone)),
    address: str(address.address_line_1)
      ? {
          line1: str(address.address_line_1),
          line2: str(address.address_line_2) || null,
          city: str(address.admin_area_2),
          country: str(address.country_code),
          postalCode: str(address.postal_code),
        }
      : null,
  };
}

/** The order at PayPal, or null when PayPal no longer has it (404). Throws on anything else. */
export async function getPayPalOrder(creds: PayPalCredentials, paypalOrderId: string): Promise<PayPalOrderSummary | null> {
  const res = await call(creds, "GET", `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
  if (res.status === 404) return null;
  if (res.status !== 200) throw new PayPalError("show order", res.status, issueOf(res.data), res.debugId);
  return readPayPalOrder(res.data);
}

export type CaptureAnswer = { ok: true; order: PayPalOrderSummary } | { ok: false; status: number; issue: string | null };

/**
 * Capture an approved order. Keyed on OUR order (`capture-<id>`), so the
 * return route and the webhook, racing or repeated, are one capture at
 * PayPal: a repeat gets the first one's result. A refusal PayPal explains
 * (4xx with an issue) comes back as an answer; a network failure or a 5xx
 * throws, so a webhook can be retried.
 */
export async function capturePayPalOrder(creds: PayPalCredentials, paypalOrderId: string, ourOrderId: string): Promise<CaptureAnswer> {
  const res = await call(creds, "POST", `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    body: "{}",
    requestId: `capture-${ourOrderId}`,
    // The full order: payer, shipping and the capture itself.
    prefer: "return=representation",
  });
  if (res.status === 200 || res.status === 201) return { ok: true, order: readPayPalOrder(res.data) };
  if (res.status >= 400 && res.status < 500) return { ok: false, status: res.status, issue: issueOf(res.data) };
  throw new PayPalError("capture", res.status, issueOf(res.data), res.debugId);
}

// ── Webhooks ─────────────────────────────────────────────────────────

/**
 * Which PayPal environment sent a webhook, from the host of its
 * PAYPAL-CERT-URL header: api.sandbox.paypal.com (or api-m.) for sandbox,
 * api.paypal.com for live. Not a documented field: PayPal's samples show it,
 * and the verification below is the real guard (we verify with the brand's
 * own environment and webhook id, which a sandbox event can never pass in
 * live). This only lets an event from the wrong environment be logged and
 * ignored by name, like Stripe's livemode check. null: not a PayPal host.
 */
export function certEnvironment(certUrl: string | null): PayPalEnvironment | null {
  if (!certUrl) return null;
  try {
    const u = new URL(certUrl);
    if (u.protocol !== "https:") return null;
    if (u.hostname.endsWith(".sandbox.paypal.com")) return "sandbox";
    if (u.hostname === "paypal.com" || u.hostname.endsWith(".paypal.com")) return "live";
    return null;
  } catch {
    return null;
  }
}

/** The transmission headers verify-webhook-signature needs, by the names PayPal sends them. */
const SIGNATURE_HEADERS = {
  auth_algo: "paypal-auth-algo",
  cert_url: "paypal-cert-url",
  transmission_id: "paypal-transmission-id",
  transmission_sig: "paypal-transmission-sig",
  transmission_time: "paypal-transmission-time",
} as const;

/**
 * Ask PayPal whether a webhook is genuine and meant for this brand's
 * webhook (PAYPAL_WEBHOOK_ID__<ID>). false without calling when a header is
 * missing. The event goes back exactly as it arrived (PayPal's rule): the
 * raw text is spliced into the request, never parsed and re-serialised.
 * Throws when PayPal cannot be asked, so the webhook is retried.
 */
export async function verifyPayPalWebhook(creds: PayPalCredentials, headers: Headers, rawBody: string): Promise<boolean> {
  const fields: string[] = [];
  for (const [field, header] of Object.entries(SIGNATURE_HEADERS)) {
    const value = headers.get(header);
    if (!value) return false;
    fields.push(`${JSON.stringify(field)}:${JSON.stringify(value)}`);
  }
  fields.push(`"webhook_id":${JSON.stringify(creds.webhookId)}`);
  const body = `{${fields.join(",")},"webhook_event":${rawBody}}`;
  const res = await call(creds, "POST", "/v1/notifications/verify-webhook-signature", { body });
  if (res.status !== 200) throw new PayPalError("verify webhook", res.status, issueOf(res.data), res.debugId);
  return res.data?.verification_status === "SUCCESS";
}

/** A webhook event's envelope, as far as we read it. */
export interface PayPalEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  resource?: Json;
}

/**
 * What a webhook event says about which order it is: our id (custom_id, on
 * a capture or on an order's purchase unit), the capture's id (a capture
 * event's own id, or a refund's link up to its capture), and PayPal's order
 * id (an order event's own id, or a capture's related order).
 */
export function eventRefs(event: PayPalEvent): { orderId: string | null; captureId: string | null; paypalOrderId: string | null } {
  const r = obj(event.resource);
  const unit = obj(first(r.purchase_units));
  const links = Array.isArray(r.links) ? (r.links as Json[]) : [];
  const up = links.find((l) => l.rel === "up" && typeof l.href === "string")?.href as string | undefined;
  const upCapture = up?.match(/\/v2\/payments\/captures\/([^/?#]+)/)?.[1] ?? null;
  const isCapture = event.resource_type === "capture" || (event.event_type.startsWith("PAYMENT.CAPTURE.") && !upCapture);
  const isOrder = event.resource_type === "checkout-order" || event.event_type.startsWith("CHECKOUT.ORDER.");
  return {
    orderId: str(r.custom_id) || str(unit.custom_id) || null,
    captureId: isCapture ? str(r.id) || null : upCapture,
    paypalOrderId: isOrder ? str(r.id) || null : str(obj(obj(r.supplementary_data).related_ids).order_id) || null,
  };
}
