import crypto from "crypto";
import { usdToCryptoAmount } from "./crypto-rates";

// ─────────────────────────────────────────────────────────────────
// Self-hosted crypto payment gateway, addressed by CRYPTO_GATEWAY_URL.
// Two halves:
//
//  1. INBOUND webhook verification — FULLY IMPLEMENTED. On a confirmed
//     on-chain payment the gateway POSTs a `payment.confirmed` event to
//     /api/crypto-webhook with header
//        X-Webhook-Signature: sha256=<hex>
//     where  hex = HMAC-SHA256(CRYPTO_WEBHOOK_SECRET, RAW_REQUEST_BODY_BYTES).
//     `verifyWebhookSignature` checks exactly that, over the raw bytes.
//
//  2. OUTBOUND invoice creation — `createCryptoPayment` POSTs to
//     {CRYPTO_GATEWAY_URL}/create-payment with { amount, orderId, currency }
//     where amount is the crypto amount converted from the order's USD subtotal
//     (see lib/crypto-rates.ts). The gateway returns a deposit wallet, the exact
//     amount, a QR data-URI and an expiry — there is NO hosted payment page, so
//     the customer pays on our own /checkout/pay/[id] screen. The gateway
//     requires no auth header for this call.
//
// Environment:
//  - CRYPTO_WEBHOOK_SECRET  — MUST equal the gateway's WEBHOOK_SECRET.
//  - CRYPTO_GATEWAY_URL     — gateway base URL. REQUIRED; there is no
//                             default, and crypto is not offered without it.
// ─────────────────────────────────────────────────────────────────

export type CryptoPaymentMethod = "btc" | "eth" | "usdt" | "xmr";

/**
 * Internal identifier stored on Order.paymentProvider for orders this gateway
 * handled. Every reference goes through this constant — there is no literal
 * anywhere else — so changing it is safe while no orders carry the old value.
 */
export const GATEWAY_PROVIDER = "cryptogateway" as const;

const SIGNATURE_PREFIX = "sha256=";

// ── Inbound webhook payload (the gateway's fixed contract) ──────────

export interface CryptoWebhookPayment {
  paymentId: string; // gateway's id, e.g. "pay_…"
  orderId: string; // the id WE passed when creating the invoice (our Order.id)
  currency: string; // BTC | ETH | USDT | XMR
  amount: string; // crypto amount as a string, e.g. "0.001"
  wallet?: string;
  status: string; // "confirmed" on a confirmed payment
  txHash?: string;
  confirmations?: number;
  confirmationsRequired?: number;
  createdAt?: string;
  expiresAt?: string;
  confirmedAt?: string;
}

export interface CryptoWebhookEvent {
  event: string; // "payment.confirmed"
  payment?: CryptoWebhookPayment;
  test?: boolean; // present (true) on /webhook-test pings — acknowledge, never fulfill
}

// ── Signature verification ──────────────────────────────────────────

/**
 * Verify an inbound webhook over the RAW request body bytes.
 *
 * Returns false on a missing secret, a missing/empty signature header, or any
 * mismatch. Length-guarded so `timingSafeEqual` (which throws on unequal
 * lengths) is never reached with mismatched buffers. The comparison itself is
 * constant-time.
 *
 * IMPORTANT: pass the raw body string read with `await req.text()` — never a
 * re-serialised `JSON.stringify(JSON.parse(raw))`, whose bytes can differ and
 * break the HMAC.
 */
export function verifyWebhookSignature(
  raw: string,
  header: string | null | undefined
): boolean {
  const secret = process.env.CRYPTO_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const expected =
    SIGNATURE_PREFIX +
    crypto.createHmac("sha256", secret).update(raw).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Produce the `X-Webhook-Signature` value the gateway would send for a raw
 * body. Used by the smoke test (and any local tooling) to forge valid
 * deliveries. Reads CRYPTO_WEBHOOK_SECRET.
 */
export function signWebhookBody(
  raw: string,
  secret: string | undefined = process.env.CRYPTO_WEBHOOK_SECRET
): string {
  if (!secret) throw new Error("CRYPTO_WEBHOOK_SECRET is not set");
  return (
    SIGNATURE_PREFIX +
    crypto.createHmac("sha256", secret).update(raw).digest("hex")
  );
}

// ── Audit trail ─────────────────────────────────────────────────────

/**
 * Compact JSON audit record persisted to Order.notes when a payment confirms.
 * Captures the gateway's paymentId, txHash, crypto currency and amount for the
 * order's audit trail (no schema columns; stored as JSON in the notes field).
 */
export function buildAuditNote(payment: CryptoWebhookPayment): string {
  return JSON.stringify({
    provider: GATEWAY_PROVIDER,
    paymentId: payment.paymentId ?? null,
    txHash: payment.txHash ?? null,
    currency: payment.currency ?? null,
    amount: payment.amount ?? null,
    confirmedAt: payment.confirmedAt ?? null,
  });
}

// ── Outbound invoice creation ───────────────────────────────────────

export interface CreateCryptoPaymentInput {
  orderId: string;
  amount: string; // decimal string in USD, e.g. "90.00"
  method: CryptoPaymentMethod;
  customerName: string;
  customerEmail: string;
  // Origin of the storefront the customer is on — used to build the pay-page URL.
  origin: string;
}

/** The deposit details the customer needs, returned by the gateway. */
export interface CryptoPaymentDetails {
  paymentId: string; // gateway id ("pay_…"); persist on Order.paymentRef
  wallet: string; // deposit address
  amount: string; // exact crypto amount to send
  currency: string; // BTC | ETH | USDT | XMR
  qr: string | null; // data:image/...;base64 QR of the address/URI
  expiresAt: string | null; // ISO; payment window
}

export interface CreateCryptoPaymentResult {
  paymentUrl: string; // our on-site pay page (/checkout/pay/[id])
  paymentRef: string; // gateway paymentId
  payment: CryptoPaymentDetails;
}

function gatewayBaseUrl(): string {
  // NO fallback. This used to default to a gateway belonging to a different
  // storefront, so an unset CRYPTO_GATEWAY_URL silently sent real payment
  // requests to someone else's server. getPaymentConfig() will not offer
  // crypto at all unless this is set, so reaching here without it is a bug.
  const url = process.env.CRYPTO_GATEWAY_URL;
  if (!url) {
    throw new Error(
      "CRYPTO_GATEWAY_URL is not set. Refusing to create a crypto payment rather than guessing a gateway."
    );
  }
  return url.replace(/\/+$/, "");
}

/**
 * Create a payment on the gateway and return the customer's deposit details.
 * Converts the USD `amount` to the chosen coin, POSTs to /create-payment, and
 * points the customer at our own pay page (the gateway has no hosted page).
 * Throws on any failure so checkout never confirms an uncollectable order.
 */
export async function createCryptoPayment(
  input: CreateCryptoPaymentInput
): Promise<CreateCryptoPaymentResult> {
  const cryptoAmount = await usdToCryptoAmount(parseFloat(input.amount), input.method);
  const currency = input.method.toUpperCase();

  const res = await fetch(`${gatewayBaseUrl()}/create-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: cryptoAmount, orderId: input.orderId, currency }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[crypto-gateway] create-payment failed", res.status, detail.slice(0, 300));
    throw new Error("Crypto payment gateway error");
  }

  const data = (await res.json()) as Partial<CryptoPaymentDetails> & {
    paymentId?: string;
    wallet?: string;
    amount?: string;
  };
  if (!data.paymentId || !data.wallet || !data.amount) {
    console.error("[crypto-gateway] create-payment unexpected response", data);
    throw new Error("Crypto payment gateway returned an unexpected response");
  }

  const payment: CryptoPaymentDetails = {
    paymentId: data.paymentId,
    wallet: data.wallet,
    amount: data.amount,
    currency: data.currency ?? currency,
    qr: data.qr ?? null,
    expiresAt: data.expiresAt ?? null,
  };

  return {
    paymentUrl: `${input.origin}/checkout/pay/${input.orderId}`,
    paymentRef: payment.paymentId,
    payment,
  };
}

/**
 * Persisted on Order.notes while a payment is pending so the pay page can render
 * the deposit details without re-calling the gateway. Overwritten by the audit
 * note (buildAuditNote) once the webhook confirms the payment.
 */
export function buildPendingNote(p: CryptoPaymentDetails): string {
  return JSON.stringify({
    kind: "pending",
    paymentId: p.paymentId,
    wallet: p.wallet,
    amount: p.amount,
    currency: p.currency,
    qr: p.qr,
    expiresAt: p.expiresAt,
  });
}

/** Parse a pending-payment note. Returns null for anything else (e.g. the audit note). */
export function parsePendingNote(notes: string | null | undefined): CryptoPaymentDetails | null {
  if (!notes) return null;
  try {
    const o = JSON.parse(notes) as Record<string, unknown>;
    if (
      o.kind !== "pending" ||
      typeof o.paymentId !== "string" ||
      typeof o.wallet !== "string" ||
      typeof o.amount !== "string"
    ) {
      return null;
    }
    return {
      paymentId: o.paymentId,
      wallet: o.wallet,
      amount: o.amount,
      currency: typeof o.currency === "string" ? o.currency : "",
      qr: typeof o.qr === "string" ? o.qr : null,
      expiresAt: typeof o.expiresAt === "string" ? o.expiresAt : null,
    };
  } catch {
    return null;
  }
}
