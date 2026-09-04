// Throwaway smoke test for the self-hosted crypto webhook receiver. Run with:
//   DATABASE_URL=file:$(pwd)/data/baclab.db npx tsx scripts/smoke-crypto-webhook.ts
//
// Covers the two genuinely new pieces: the X-Webhook-Signature scheme
// (sign/verify over raw bytes — valid / tampered / missing header) and the
// confirmed-webhook → order transition, including idempotency on retry.

// Set the webhook secret before exercising the signer/verifier.
process.env.CRYPTO_WEBHOOK_SECRET = "smoke-test-secret";

import { prisma } from "../lib/db";
import { verifyWebhookSignature, signWebhookBody, GATEWAY_PROVIDER } from "../lib/crypto-gateway";
import { POST as cryptoWebhook } from "../app/api/crypto-webhook/route";
import { fulfillPaidOrder } from "../lib/payments/fulfillment";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

const URL = "http://localhost:3000/api/crypto-webhook";

// Fixture slugs for the stock-decrement smoke cases — cleaned up on every run.
const STOCK_PRODUCT_SLUG = "smoke-crypto-stock";
const FULFILL_SEQ_SLUG = "smoke-crypto-fulfill-seq";
const FULFILL_CONC_SLUG = "smoke-crypto-fulfill-conc";

/** A request with a correctly-computed X-Webhook-Signature over the raw body. */
function signedRequest(payload: unknown): Request {
  const raw = JSON.stringify(payload);
  return new Request(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signWebhookBody(raw) },
    body: raw,
  });
}

function confirmedPayload(orderId: string, over: Record<string, unknown> = {}) {
  return {
    event: "payment.confirmed",
    payment: {
      paymentId: "pay_smoke_1",
      orderId,
      currency: "BTC",
      amount: "0.001",
      wallet: "bc1qsmoke",
      status: "confirmed",
      txHash: "0xsmoketxhash",
      confirmations: 3,
      confirmationsRequired: 1,
      confirmedAt: "2026-06-18T00:00:00.000Z",
      ...over,
    },
  };
}

async function cleanup() {
  const orders = await prisma.order.findMany({
    where: { customerEmail: { contains: "smoke-crypto" } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  await prisma.emailLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.product.deleteMany({
    where: { slug: { in: [STOCK_PRODUCT_SLUG, FULFILL_SEQ_SLUG, FULFILL_CONC_SLUG] } },
  });
}

async function pendingOrder(email: string) {
  return prisma.order.create({
    data: {
      customerName: "Smoke Customer",
      customerEmail: email,
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]", // no items => no stock to decrement
      currency: "USD",
      totalAmount: 90,
      subtotalUsd: 90,
      paymentMethod: "btc",
      status: "pending",
    },
  });
}

async function main() {
  await cleanup();

  // ── 1) Signature scheme, over the RAW bytes ──────────────────────
  const raw = JSON.stringify(confirmedPayload("xyz"));
  const sig = signWebhookBody(raw);
  assert(verifyWebhookSignature(raw, sig), "valid signature verifies");
  assert(sig.startsWith("sha256="), "signature has sha256= prefix");
  // Tamper the body but keep the original signature — must fail.
  const tampered = raw.replace('"amount":"0.001"', '"amount":"9.999"');
  assert(tampered !== raw, "tampered body actually differs");
  assert(!verifyWebhookSignature(tampered, sig), "tampered body fails verification");
  assert(!verifyWebhookSignature(raw, null), "missing signature fails");
  assert(!verifyWebhookSignature(raw, "sha256=deadbeef"), "wrong signature fails");
  // Wrong secret produces a different signature for the same body.
  assert(signWebhookBody(raw, "other-secret") !== sig, "different secret => different signature");

  // ── 2) pending order ─────────────────────────────────────────────
  const order = await pendingOrder("customer.smoke-crypto@test.local");

  // ── 3) confirmed webhook flips pending → paid and records the audit ──
  const res = await cryptoWebhook(signedRequest(confirmedPayload(order.id)));
  assert(res.status === 200, "confirmed webhook returns 200");
  const paid = await prisma.order.findUnique({ where: { id: order.id } });
  assert(paid!.status === "paid", "order marked paid");
  assert(paid!.paymentRef === "pay_smoke_1", "paymentRef set to gateway paymentId");
  assert(paid!.paymentProvider === GATEWAY_PROVIDER, "paymentProvider recorded");
  const audit = JSON.parse(paid!.notes ?? "{}");
  assert(audit.txHash === "0xsmoketxhash", "txHash recorded in notes audit");
  assert(audit.amount === "0.001" && audit.currency === "BTC", "crypto amount + currency recorded");
  // ── 4) retry is a no-op (idempotent) ─────────────────────────────
  const retry = await cryptoWebhook(signedRequest(confirmedPayload(order.id)));
  assert(retry.status === 200, "retry returns 200");
  const stillPaid = await prisma.order.findUnique({ where: { id: order.id } });
  assert(stillPaid!.status === "paid", "retry leaves the order paid and changes nothing");

  // ── 5) missing signature header → 401, no state change ───────────
  const order2 = await pendingOrder("customer2.smoke-crypto@test.local");
  const noSigReq = new Request(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(confirmedPayload(order2.id)),
  });
  const noSigRes = await cryptoWebhook(noSigReq);
  assert(noSigRes.status === 401, "missing signature rejected with 401");
  assert((await prisma.order.findUnique({ where: { id: order2.id } }))!.status === "pending",
    "order unchanged after missing signature");

  // ── 6) tampered body (valid sig for a DIFFERENT body) → 401 ──────
  const goodRaw = JSON.stringify(confirmedPayload(order2.id));
  const badReq = new Request(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signWebhookBody(goodRaw) },
    body: goodRaw.replace('"amount":"0.001"', '"amount":"9.999"'),
  });
  const badRes = await cryptoWebhook(badReq);
  assert(badRes.status === 401, "tampered body rejected with 401");
  assert((await prisma.order.findUnique({ where: { id: order2.id } }))!.status === "pending",
    "order unchanged after tampered body");

  // ── 7) test ping (test:true) → 200, never fulfills ──────────────
  const pingRes = await cryptoWebhook(
    signedRequest({ event: "payment.confirmed", test: true, payment: confirmedPayload(order2.id).payment })
  );
  assert(pingRes.status === 200, "test ping returns 200");
  assert((await prisma.order.findUnique({ where: { id: order2.id } }))!.status === "pending",
    "test ping does not fulfill a real order");

  // ── 8) unknown orderId → 200 ack, no throw ──────────────────────
  const unknownRes = await cryptoWebhook(signedRequest(confirmedPayload("order_does_not_exist")));
  assert(unknownRes.status === 200, "unknown orderId acked with 200");

  // ── 9) non-confirmed status → 200 no-op ─────────────────────────
  const order3 = await pendingOrder("customer3.smoke-crypto@test.local");
  const pendingStatusRes = await cryptoWebhook(
    signedRequest(confirmedPayload(order3.id, { status: "pending" }))
  );
  assert(pendingStatusRes.status === 200, "non-confirmed status acked with 200");
  assert((await prisma.order.findUnique({ where: { id: order3.id } }))!.status === "pending",
    "non-confirmed status does not fulfill");

  // ── 10) stock decrement — double delivery must decrement exactly once ──
  // Exercises the code this task actually changed: fulfillPaidOrder's
  // updateMany claim + the stock-decrement loop moved into it. Delivering
  // the same confirmed payload twice is the double-delivery case the claim
  // guard exists for; a transcription slip in the moved loop or an inverted
  // guard would show up here as stock 6 (decremented twice) or 10
  // (never decremented) instead of 8.
  const stockProduct = await prisma.product.create({
    data: {
      slug: STOCK_PRODUCT_SLUG,
      name: "Smoke Stock Fixture",
      description: "Fixture product for the crypto webhook stock-decrement smoke test.",
      priceGbp: 21,
      stock: 10,
    },
  });
  const stockOrder = await prisma.order.create({
    data: {
      customerName: "Smoke Stock Customer",
      customerEmail: "stock.smoke-crypto@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: JSON.stringify([
        {
          productId: stockProduct.id,
          slug: stockProduct.slug,
          name: stockProduct.name,
          qty: 2,
          unitPrice: "27.00",
          unitPriceUsd: "27.00",
        },
      ]),
      currency: "USD",
      totalAmount: 54,
      subtotalUsd: 54,
      paymentMethod: "btc",
      status: "pending",
    },
  });

  const stockPayload = confirmedPayload(stockOrder.id, { paymentId: "pay_smoke_stock" });
  const stockRes1 = await cryptoWebhook(signedRequest(stockPayload));
  assert(stockRes1.status === 200, "stock: first delivery returns 200");
  const stockRes2 = await cryptoWebhook(signedRequest(stockPayload));
  assert(stockRes2.status === 200, "stock: duplicate delivery of same payload returns 200");

  const paidStockOrder = await prisma.order.findUnique({ where: { id: stockOrder.id } });
  assert(paidStockOrder!.status === "paid", "stock: order marked paid");
  assert(paidStockOrder!.paymentProvider === GATEWAY_PROVIDER, "stock: paymentProvider is GATEWAY_PROVIDER");
  const stockAudit = JSON.parse(paidStockOrder!.notes ?? "{}");
  assert(stockAudit.paymentId === "pay_smoke_stock", "stock: audit note records paymentId");

  const stockProductAfter = await prisma.product.findUnique({ where: { id: stockProduct.id } });
  assert(stockProductAfter!.stock === 8, "stock: decremented exactly once (10 - 2 = 8, not 6)");

  // ── 11) fulfillPaidOrder direct — sequential re-entry ────────────
  // Section 10 delivers through the ROUTE, but the route's own
  // status !== "pending" guard (route.ts:85-87) intercepts the 2nd
  // delivery before fulfillPaidOrder is ever called again — so section 10
  // alone cannot prove anything about fulfillPaidOrder's internals. Here we
  // call fulfillPaidOrder directly, bypassing the route entirely, so its
  // own early-return-on-already-paid check (fulfillment.ts:14) is what's
  // actually exercised.
  const seqProduct = await prisma.product.create({
    data: {
      slug: FULFILL_SEQ_SLUG,
      name: "Smoke Fulfill Sequential Fixture",
      description: "Fixture product for the fulfillPaidOrder sequential re-entry smoke test.",
      priceGbp: 21,
      stock: 10,
    },
  });
  const seqOrder = await prisma.order.create({
    data: {
      customerName: "Smoke Fulfill Sequential Customer",
      customerEmail: "fulfill-seq.smoke-crypto@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: JSON.stringify([
        {
          productId: seqProduct.id,
          slug: seqProduct.slug,
          name: seqProduct.name,
          qty: 3,
          unitPrice: "27.00",
          unitPriceUsd: "27.00",
        },
      ]),
      currency: "USD",
      totalAmount: 81,
      subtotalUsd: 81,
      paymentMethod: "btc",
      status: "pending",
    },
  });

  const seqResult1 = await fulfillPaidOrder(seqOrder.id, { paymentRef: "x", provider: GATEWAY_PROVIDER });
  assert(seqResult1.alreadyPaid === false, "fulfillPaidOrder direct: sequential 1st call claims (alreadyPaid=false)");
  const seqResult2 = await fulfillPaidOrder(seqOrder.id, { paymentRef: "x", provider: GATEWAY_PROVIDER });
  assert(seqResult2.alreadyPaid === true, "fulfillPaidOrder direct: sequential 2nd call is a no-op (alreadyPaid=true)");

  const seqProductAfter = await prisma.product.findUnique({ where: { id: seqProduct.id } });
  assert(seqProductAfter!.stock === 7, "fulfillPaidOrder direct: sequential stock decremented exactly once (10 - 3 = 7)");

  // ── 12) fulfillPaidOrder direct — concurrent re-entry ────────────
  // Fires both calls WITHOUT awaiting in between, then awaits together, so
  // both reach the top-of-function status check and the updateMany claim
  // before either has committed. SQLite serialises writes under the hood,
  // so this is re-entrancy under contention rather than genuine parallel
  // execution — but it still forces both calls' updateMany claims to race
  // for the same row, so whichever call loses genuinely reaches the
  // count === 0 branch (fulfillment.ts:28). This is the case that actually
  // exercises the atomic claim guard; section 11 above only proves the
  // separate, non-atomic short-circuit at fulfillment.ts:14.
  const concProduct = await prisma.product.create({
    data: {
      slug: FULFILL_CONC_SLUG,
      name: "Smoke Fulfill Concurrent Fixture",
      description: "Fixture product for the fulfillPaidOrder concurrent re-entry smoke test.",
      priceGbp: 21,
      stock: 10,
    },
  });
  const concOrder = await prisma.order.create({
    data: {
      customerName: "Smoke Fulfill Concurrent Customer",
      customerEmail: "fulfill-conc.smoke-crypto@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: JSON.stringify([
        {
          productId: concProduct.id,
          slug: concProduct.slug,
          name: concProduct.name,
          qty: 3,
          unitPrice: "27.00",
          unitPriceUsd: "27.00",
        },
      ]),
      currency: "USD",
      totalAmount: 81,
      subtotalUsd: 81,
      paymentMethod: "btc",
      status: "pending",
    },
  });

  const concOpts = { paymentRef: "y", provider: GATEWAY_PROVIDER };
  const [concA, concB] = await Promise.all([
    fulfillPaidOrder(concOrder.id, concOpts),
    fulfillPaidOrder(concOrder.id, concOpts),
  ]);
  assert(
    concA.alreadyPaid !== concB.alreadyPaid,
    "fulfillPaidOrder direct: concurrent calls — exactly one claims, the other sees alreadyPaid (XOR, order not asserted)"
  );

  const concProductAfter = await prisma.product.findUnique({ where: { id: concProduct.id } });
  assert(concProductAfter!.stock === 7, "fulfillPaidOrder direct: concurrent stock decremented exactly once (10 - 3 = 7, not 4)");

  await cleanup();
  console.log("\nAll smoke checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
