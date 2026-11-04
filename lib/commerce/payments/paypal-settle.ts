/**
 * PayPal payments landing on our orders: the buyer's return from PayPal
 * (/api/payments/paypal/return) and PayPal's webhooks (/api/webhooks/paypal).
 * Both end in fulfillPaidOrder (lib/payments/fulfillment.ts), the one path
 * every provider shares, whose atomic pending → paid claim makes every
 * repeat, race and duplicate delivery a no-op.
 *
 * SERVER ONLY: Prisma and PayPal.
 *
 * Money is taken only when WE capture (intent CAPTURE), in exactly two
 * places: the buyer's return, and the CHECKOUT.ORDER.APPROVED webhook for a
 * buyer who never came back. Both capture with the same PayPal-Request-Id,
 * so they are one capture at PayPal whichever runs first.
 */
import { NextResponse } from "next/server";
import type { Order } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { belongsToHost, brandFromHost, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import { SHIPPING_COUNTRIES } from "@/config/funnel";
import { fulfillPaidOrder } from "@/lib/payments/fulfillment";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import {
  capturePayPalOrder,
  certEnvironment,
  eventRefs,
  getPayPalOrder,
  paypalCredentials,
  verifyPayPalWebhook,
  type PayPalEvent,
  type PayPalOrderSummary,
} from "@/lib/commerce/payments/paypal";

/**
 * How a capture attempt ended, for the return route's redirect and the log.
 *  - paid / already-paid: the order is paid (now, or by an earlier delivery);
 *  - pending: PayPal is holding the capture (status_details.reason); the
 *    PAYMENT.CAPTURE.COMPLETED webhook fulfils it if it clears;
 *  - declined: the buyer's funding was refused;
 *  - not-approved: the buyer came back without approving (or cancelled);
 *  - address: the address is not one we deliver to, so nothing was captured;
 *  - failed: anything else that will not come right by retrying.
 */
export type SettleOutcome = "paid" | "already-paid" | "pending" | "declined" | "not-approved" | "address" | "failed";

/**
 * The amount check, as the Stripe webhook makes it: what PayPal captured
 * against the goods plus the delivery the order records. A message for the
 * log when they differ, else null. Never blocks: the money is taken, and
 * refusing would only strand a paid order.
 */
export function amountMismatch(
  order: Pick<Order, "id" | "totalAmount" | "deliveryMinor">,
  capture: { amountMinor: number; currency: string }
): string | null {
  const goods = Math.round(Number(order.totalAmount) * 100);
  const expected = goods + (order.deliveryMinor ?? 0);
  if (capture.currency === "GBP" && capture.amountMinor === expected) return null;
  return `[paypal] AMOUNT MISMATCH on order ${order.id}: PayPal captured ${capture.amountMinor} ${capture.currency || "(no currency)"} but the order records ${expected} GBP (goods ${goods} + delivery ${order.deliveryMinor ?? 0}). The create body is built from the same figures, so anything else means it was changed at PayPal or in the database.`;
}

/**
 * Fulfil our order from a PayPal order whose capture has cleared. The name,
 * email, phone and address PayPal collected go onto the order first, in the
 * Stripe webhook's shape, so the confirmation email and the packing slip
 * have somewhere to ship to; only while it is pending, so a staff edit is
 * never overwritten by a late duplicate.
 */
async function fulfilFrom(order: Order, pp: PayPalOrderSummary): Promise<SettleOutcome> {
  const capture = pp.capture;
  if (!capture) {
    console.error(`[paypal] order ${order.id}: PayPal order ${pp.id} is ${pp.status} with no capture`);
    return "failed";
  }
  if (capture.status === "PENDING") {
    console.warn(`[paypal] order ${order.id}: capture ${capture.id} is pending (${capture.reason ?? "no reason given"}); the webhook fulfils it if it clears`);
    return "pending";
  }
  if (capture.status !== "COMPLETED") {
    console.warn(`[paypal] order ${order.id}: capture ${capture.id} is ${capture.status} (${capture.reason ?? "no reason given"})`);
    return capture.status === "DECLINED" ? "declined" : "failed";
  }

  const mismatch = amountMismatch(order, capture);
  if (mismatch) console.error(mismatch);

  await prisma.order.updateMany({
    where: { id: order.id, status: "pending" },
    data: {
      ...(pp.email ? { customerEmail: pp.email } : {}),
      ...(pp.name ? { customerName: pp.name } : {}),
      ...(pp.phone ? { customerPhone: pp.phone } : {}),
      ...(pp.address ? { shippingAddress: JSON.stringify(pp.address) } : {}),
    },
  });

  const { alreadyPaid } = await fulfillPaidOrder(order.id, {
    provider: "paypal",
    paymentRef: capture.id,
    deliveryMinor: order.deliveryMinor ?? 0,
    ...(Number.isFinite(capture.amountMinor) ? { amountPaidMinor: capture.amountMinor } : {}),
  });
  console.log(
    `[paypal] order ${order.id} ${alreadyPaid ? "was already paid (duplicate)" : "marked paid"}: capture ${capture.id}, ${capture.amountMinor} ${capture.currency}`
  );
  return alreadyPaid ? "already-paid" : "paid";
}

/**
 * Capture the buyer's approved PayPal order and fulfil ours. Safe to call
 * any number of times, from the return route and the webhook at once:
 * PayPal sees one capture (the same request id) and fulfillPaidOrder one
 * claim. The address is read BEFORE capturing: PayPal lets the buyer pick
 * any address on their account, and we deliver to the UK only, so a
 * payment for anywhere else is never taken. Throws when PayPal cannot be
 * reached, so a webhook is retried; every answer PayPal gives is an outcome.
 */
export async function capturePayPalPayment(order: Order): Promise<SettleOutcome> {
  if (order.status !== "pending") return "already-paid";
  const creds = paypalCredentials(order.brand);
  if (!creds || !order.paymentRef) {
    console.error(`[paypal] order ${order.id}: cannot capture (${creds ? "no PayPal order on it" : `no PayPal credentials for ${order.brand}`})`);
    return "failed";
  }

  const before = await getPayPalOrder(creds, order.paymentRef);
  if (!before) {
    console.warn(`[paypal] order ${order.id}: PayPal no longer has order ${order.paymentRef} (expired?)`);
    return "failed";
  }
  if (before.customId && before.customId !== order.id) {
    console.error(`[paypal] order ${order.id}: PayPal order ${before.id} belongs to ${before.customId}; not capturing`);
    return "failed";
  }
  if (before.status === "COMPLETED") return fulfilFrom(order, before);
  if (before.status === "CREATED" || before.status === "PAYER_ACTION_REQUIRED" || before.status === "SAVED") return "not-approved";
  if (before.status !== "APPROVED") {
    console.warn(`[paypal] order ${order.id}: PayPal order ${before.id} is ${before.status}`);
    return "failed";
  }
  const country = before.address?.country ?? "";
  if (!(SHIPPING_COUNTRIES as readonly string[]).includes(country)) {
    console.warn(`[paypal] order ${order.id}: not captured, the PayPal address is in "${country || "nowhere"}"`);
    return "address";
  }

  const answer = await capturePayPalOrder(creds, before.id, order.id);
  if (answer.ok) return fulfilFrom(order, answer.order);
  switch (answer.issue) {
    case "ORDER_ALREADY_CAPTURED": {
      // Captured by the other path a moment ago: read what it captured.
      const after = await getPayPalOrder(creds, before.id);
      return after ? fulfilFrom(order, after) : "failed";
    }
    case "INSTRUMENT_DECLINED":
    case "REDIRECT_PAYER_FOR_ALTERNATE_FUNDING":
      console.warn(`[paypal] order ${order.id}: capture declined (${answer.issue})`);
      return "declined";
    case "ORDER_NOT_APPROVED":
    case "PAYER_ACTION_REQUIRED":
      return "not-approved";
    default:
      console.error(`[paypal] order ${order.id}: capture refused, HTTP ${answer.status} ${answer.issue ?? ""}`);
      return "failed";
  }
}

// ── The buyer's return ───────────────────────────────────────────────

const ORDER_ID = z.string().uuid();

/**
 * GET /api/payments/paypal/return?order=<our id>, on the brand's own host.
 * The order is looked up by OUR id and must be this host's brand's PayPal
 * order; anything else is a 404 that names nothing. PayPal's own query
 * parameters are not relied on: the PayPal order is the one we stored.
 * Paid: on to the order confirmation, with the `paid` marker
 * returnedFromPayment() reads. Otherwise: back to the buy section, where
 * `?payment=<outcome>` becomes a neutral sentence (lib/commerce/view.ts).
 */
export async function handlePayPalReturn(req: Request): Promise<Response> {
  const host = req.headers.get("host");
  const brand = brandFromHost(host);
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
  if (brand.id === DEFAULT_BRAND) return notFound();
  if (!rateLimit(`paypal-return:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const id = new URL(req.url).searchParams.get("order") ?? "";
  if (!ORDER_ID.safeParse(id).success) return notFound();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || !belongsToHost(order.brand, host) || order.paymentProvider !== "paypal") {
    if (order) console.warn(`[paypal] return for order ${id} refused on host "${host}" (order is ${order.brand}, ${order.paymentProvider})`);
    return notFound();
  }

  let outcome: SettleOutcome;
  try {
    outcome = await capturePayPalPayment(order);
  } catch (err) {
    console.error(`[paypal] return for order ${order.id} failed`, err);
    outcome = "failed";
  }
  return returnRedirect(brand, order.id, outcome);
}

/** Where a return ends up, by outcome. */
export function returnRedirect(brand: Pick<BrandProfile, "origin">, orderId: string, outcome: SettleOutcome): Response {
  const to =
    outcome === "paid" || outcome === "already-paid"
      ? `${brand.origin}/order-confirmation/${orderId}?paid=1`
      : `${brand.origin}/?payment=${outcome === "not-approved" ? "cancelled" : outcome}#buy`;
  return NextResponse.redirect(to, 303);
}

// ── Webhooks ─────────────────────────────────────────────────────────

type Answer = { status: number; body: Record<string, unknown> };
const answer = (status: number, body: Record<string, unknown>): Answer => ({ status, body });

/**
 * One event to /api/webhooks/paypal. Every brand's PayPal app posts to its
 * own host, but the event is judged by ITS ORDER, never the host:
 *  1. find our order from the event (custom_id; else the capture or PayPal
 *     order it names), and only a PayPal order of ours;
 *  2. take that order's brand's credentials, and ignore an event from the
 *     other environment (sandbox vs live) by name, like Stripe's livemode
 *     check;
 *  3. verify the signature with PayPal against that brand's webhook id. An
 *     unverified event is never acted on.
 * Then: an approved order is captured if it is not yet paid; a completed
 * capture is fulfilled if it is not yet paid; a refund or reversal is
 * logged and noted on the order, once per event. 5xx only where a retry
 * can help (PayPal retries up to 25 times over 3 days).
 */
export async function handlePayPalWebhook(raw: string, headers: Headers): Promise<Answer> {
  let event: PayPalEvent;
  try {
    event = JSON.parse(raw) as PayPalEvent;
  } catch {
    return answer(400, { error: "Invalid payload" });
  }
  if (!event || typeof event.id !== "string" || typeof event.event_type !== "string") return answer(400, { error: "Invalid payload" });

  const refs = eventRefs(event);
  let order: Order | null = null;
  if (refs.orderId && ORDER_ID.safeParse(refs.orderId).success) order = await prisma.order.findUnique({ where: { id: refs.orderId } });
  for (const ref of [refs.captureId, refs.paypalOrderId]) {
    if (!order && ref) order = await prisma.order.findFirst({ where: { paymentProvider: "paypal", paymentRef: ref } });
  }
  if (!order || order.paymentProvider !== "paypal") {
    console.warn(`[paypal] event ${event.id} (${event.event_type}) names no PayPal order of ours: acknowledged, not acted on`);
    return answer(200, { received: true, ignored: "unknown-order" });
  }

  const creds = paypalCredentials(order.brand);
  if (!creds) {
    // As Stripe's webhook does without its keys: 500, so PayPal keeps
    // retrying until the operator puts the credentials back.
    console.error(`[paypal] event ${event.id} for order ${order.id}: no PayPal credentials for ${order.brand}; refusing to process`);
    return answer(500, { error: "PayPal not configured" });
  }

  const from = certEnvironment(headers.get("paypal-cert-url"));
  if (!from) {
    console.warn(`[paypal] event ${event.id}: no PayPal certificate URL, not verifiable`);
    return answer(400, { error: "Invalid signature" });
  }
  if (from !== creds.environment) {
    console.error(
      `[paypal] environment mismatch: event ${event.id} came from PayPal ${from} but ${order.brand}'s PayPal is ${creds.environment}; ignoring it`
    );
    return answer(200, { received: true, ignored: "environment-mismatch" });
  }

  let verified: boolean;
  try {
    verified = await verifyPayPalWebhook(creds, headers, raw);
  } catch (err) {
    console.error(`[paypal] event ${event.id}: could not verify the signature`, err);
    return answer(500, { error: "Verification unavailable" });
  }
  if (!verified) {
    console.warn(`[paypal] event ${event.id}: signature verification failed`);
    return answer(400, { error: "Invalid signature" });
  }

  try {
    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED": {
        if (order.status !== "pending") return answer(200, { received: true });
        const outcome = await capturePayPalPayment(order);
        console.log(`[paypal] event ${event.id}: approved order ${order.id} → ${outcome}`);
        return answer(200, { received: true, outcome });
      }
      case "PAYMENT.CAPTURE.COMPLETED": {
        if (order.status !== "pending") return answer(200, { received: true });
        const pp = await getPayPalOrder(creds, refs.paypalOrderId ?? order.paymentRef ?? "");
        if (!pp) {
          console.error(`[paypal] event ${event.id}: completed capture for order ${order.id}, but PayPal has no order to read`);
          return answer(500, { error: "Order unreadable" });
        }
        const outcome = await fulfilFrom(order, pp);
        return answer(200, { received: true, outcome });
      }
      case "PAYMENT.CAPTURE.PENDING":
      case "PAYMENT.CAPTURE.DENIED":
        console.warn(`[paypal] event ${event.id}: ${event.event_type} for order ${order.id}`);
        return answer(200, { received: true });
      case "PAYMENT.CAPTURE.REFUNDED":
      case "PAYMENT.CAPTURE.REVERSED":
        await noteMoneyBack(order, event);
        return answer(200, { received: true });
      default:
        return answer(200, { received: true, ignored: event.event_type });
    }
  } catch (err) {
    console.error(`[paypal] event ${event.id} for order ${order.id} failed`, err);
    return answer(500, { error: "Processing failed" });
  }
}

/**
 * A refund or reversal (a chargeback, say), logged and noted on the order.
 * There is no refund column: the note is the record staff see on the order
 * page. Once per event, keyed by its id, however often PayPal sends it.
 */
async function noteMoneyBack(order: Order, event: PayPalEvent): Promise<void> {
  const r = event.resource ?? {};
  const amount = (r.amount ?? {}) as { value?: unknown; currency_code?: unknown };
  const what = event.event_type === "PAYMENT.CAPTURE.REVERSED" ? "reversed" : "refunded";
  const sum = [amount.value, amount.currency_code].filter((v) => typeof v === "string" && v).join(" ") || "amount not given";
  const line = `PayPal ${what}: ${sum} (event ${event.id}, ${new Date().toISOString().slice(0, 10)})`;
  const current = await prisma.order.findUnique({ where: { id: order.id }, select: { notes: true } });
  if (current?.notes?.includes(`event ${event.id}`)) return;
  console.warn(`[paypal] order ${order.id} (${order.brand}): ${line}`);
  await prisma.order.update({ where: { id: order.id }, data: { notes: current?.notes ? `${current.notes}\n${line}` : line } });
}
