/**
 * Throwaway smoke test for the card path.
 *
 * Exercises the real route handlers end to end without touching the Stripe
 * API and without moving any money:
 *   - fake keys are set BEFORE any import, so the client is never built
 *   - createBundleCheckout short-circuits to the /dev/stripe simulator when
 *     no secret key is present, so no session is created
 *   - webhook events are forged locally and signed with Stripe's own
 *     generateTestHeaderString, so signature verification is genuinely tested
 *
 * Usage — always against a THROWAWAY database, never a real one:
 *   DATABASE_URL="file:$(pwd)/data/smoke.db" npx prisma migrate deploy
 *   DATABASE_URL="file:$(pwd)/data/smoke.db" npx tsx scripts/smoke-stripe.ts
 */

// Must precede every import that reads env at module scope.
process.env.STRIPE_ENABLED = "true";
process.env.STRIPE_PRICE_SINGLE = "price_smoke_single";
process.env.STRIPE_PRICE_FIVE = "price_smoke_five";
process.env.STRIPE_PRICE_SEVEN = "price_smoke_seven";
process.env.STRIPE_PRICE_EIGHT = "price_smoke_eight";
process.env.STRIPE_PRICE_TEN = "price_smoke_ten";
process.env.STRIPE_PRICE_TWENTY = "price_smoke_twenty";
process.env.STRIPE_PRICE_FIFTY = "price_smoke_fifty";
process.env.STRIPE_PRICE_HUNDRED = "price_smoke_hundred";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:4310";
// Point FX at a dead port so the lookup fails fast and uses the static
// fallback — this test must not depend on the network.
process.env.FX_RATE_API_URL = "http://127.0.0.1:1/no-such-host";

import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { BUNDLES, bundleById, totalMinor } from "../config/funnel";

const prisma = new PrismaClient();

const ORIGIN = "http://localhost:4310";
const VIAL_SLUG = "baclab-10ml";
const WEBHOOK_SECRET = "whsec_smoke";

let passes = 0;
function assert(condition: unknown, label: string) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  passes++;
  console.log(`  ok  ${label}`);
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** POST a JSON body to the checkout route with a valid same-origin header. */
async function postCheckout(body: unknown) {
  const { POST } = await import("../app/api/checkout/route");
  const req = new Request(`${ORIGIN}/api/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: ORIGIN,
      host: "localhost:4310",
      // A fresh IP per call keeps the 10/min rate limiter out of the way.
      "x-forwarded-for": `10.0.0.${(passes % 250) + 1}`,
    },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

/** Build and sign a checkout.session.completed for an order. */
async function postWebhook(
  orderId: string,
  opts: { amountTotal: number; paymentIntent?: string; livemode?: boolean; badSignature?: boolean }
) {
  const stripe = new Stripe("sk_test_smoke", { apiVersion: "2026-07-29.dahlia" });
  const address = {
    line1: "1 Test Street",
    line2: null,
    city: "London",
    country: "GB",
    postal_code: "SW1A 1AA",
    state: null,
  };
  const event = {
    id: `evt_smoke_${orderId.slice(0, 8)}`,
    object: "event",
    api_version: "2026-07-29.dahlia",
    created: 1_780_000_000,
    livemode: opts.livemode ?? false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_smoke_${orderId.slice(0, 8)}`,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: opts.amountTotal,
        currency: "gbp",
        client_reference_id: orderId,
        metadata: { orderId },
        payment_intent: opts.paymentIntent ?? "pi_smoke_1",
        customer_details: {
          email: "smoke-stripe@example.com",
          name: "Smoke Tester",
          phone: "+44 7700 900000",
          address,
        },
        collected_information: {
          shipping_details: { name: "Smoke Tester", address },
        },
      },
    },
  };

  const payload = JSON.stringify(event);
  const signature = opts.badSignature
    ? "t=1,v1=deadbeef"
    : stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

  const { POST } = await import("../app/api/webhooks/stripe/route");
  const res = await POST(
    new Request(`${ORIGIN}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signature },
      body: payload,
    })
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function cleanup() {
  await prisma.emailLog.deleteMany({
    where: { order: { items: { contains: VIAL_SLUG } } },
  });
  await prisma.order.deleteMany({ where: { items: { contains: VIAL_SLUG } } });
  await prisma.product.deleteMany({ where: { slug: VIAL_SLUG } });
}

async function main() {
  await cleanup();

  // ── Bundle arithmetic (pure, no DB) ─────────────────────────────
  // Bundle prices are set per pack, not per vial, and do NOT divide evenly
  // into whole pence per vial (e.g. the five-pack is 2199p / 5 = 439.8p) —
  // so bundles are priced and reconciled by the pack (priceMinor × quantity
  // of packs), never by vial count.
  section("Bundle pricing");
  const five = bundleById("five")!;
  assert(totalMinor(five, 2) === 4398, "2 × five-pack = 4398p (£43.98)");

  // ── Payment config ──────────────────────────────────────────────
  section("Payment configuration");
  const { getPaymentConfig } = await import("../lib/payments/config");
  assert(getPaymentConfig().methods.includes("card"), "card is offered when STRIPE_ENABLED=true");

  // ── Fixture ─────────────────────────────────────────────────────
  await prisma.product.create({
    data: {
      slug: VIAL_SLUG,
      name: "Bacteriostatic Water 10ml",
      description: "smoke fixture",
      priceGbp: 5.99,
      stock: 20,
      weightGrams: 40,
      active: true,
    },
  });

  // ── Checkout route ──────────────────────────────────────────────
  section("Checkout route");
  const ok = await postCheckout({ tierId: "five", quantity: 2, method: "card" });
  assert(ok.status === 200, `valid order returns 200 (got ${ok.status})`);
  assert(
    typeof ok.json.paymentUrl === "string" && (ok.json.paymentUrl as string).includes("/dev/stripe"),
    "keyless run diverts to the dev simulator instead of calling Stripe"
  );

  const orderId = ok.json.orderId as string;
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert(
    Number(order.totalAmount) === 43.98,
    "order total is £43.98, taken from config not the client"
  );
  assert(order.currency === "GBP", "order is priced in GBP");
  assert(order.status === "pending", "order starts pending");
  assert(order.customerEmail === "", "card order starts with no email — Stripe collects it");
  assert(order.shippingAddress === "", "card order starts with no address — Stripe collects it");

  const items = JSON.parse(order.items) as {
    qty: number;
    unitPrice: string;
    lineTotal: string;
    bundleId: string;
    bundleQty: number;
  }[];
  assert(items[0]!.qty === 10, "2 × 5-vial pack records 10 vials for the packer");
  assert(items[0]!.unitPrice === "21.99", "unit price is the pack price, £21.99 per 5-vial pack");
  assert(items[0]!.bundleId === "five", "the bundle bought is recorded on the line");
  assert(
    Number(items[0]!.unitPrice) * items[0]!.bundleQty === Number(order.totalAmount),
    "unitPrice × bundleQty reconciles exactly to the order total"
  );
  assert(
    items[0]!.lineTotal === order.totalAmount.toString(),
    "the stored lineTotal matches the order total exactly, with no per-vial rounding"
  );

  // ── Input validation ────────────────────────────────────────────
  section("Input validation");
  const badBodies: [string, Record<string, unknown>][] = [
    ["quantity 0 is rejected", { tierId: "five", quantity: 0, method: "card" }],
    ["quantity 11 is rejected", { tierId: "five", quantity: 11, method: "card" }],
    ["unknown tier is rejected", { tierId: "enormous", quantity: 1, method: "card" }],
    [
      "a client-supplied price is rejected outright",
      { tierId: "five", quantity: 1, method: "card", priceMinor: 1 },
    ],
  ];
  for (const [label, body] of badBodies) {
    const r = await postCheckout(body);
    assert(r.status === 400, `${label} (got ${r.status})`);
  }

  // Stock is still 20 here — the webhook that decrements it runs below.
  // The 100-vial pack is comfortably over.
  const tooMany = await postCheckout({ tierId: "hundred", quantity: 1, method: "card" });
  assert(tooMany.status === 409, `insufficient stock returns 409 (got ${tooMany.status})`);
  await prisma.order.deleteMany({ where: { status: "pending", id: { not: orderId } } });

  // ── Kill switch ─────────────────────────────────────────────────
  section("Kill switch");
  process.env.STRIPE_ENABLED = "false";
  const before = await prisma.order.count();
  const killed = await postCheckout({ tierId: "five", quantity: 1, method: "card" });
  assert(
    killed.status === 400,
    `STRIPE_ENABLED=false rejects a forged card order (got ${killed.status})`
  );
  assert(
    killed.json.error === "That payment method is not available.",
    "and says so without leaking configuration"
  );
  assert((await prisma.order.count()) === before, "no order row is created while cards are off");
  process.env.STRIPE_ENABLED = "true";

  // ── Webhook ─────────────────────────────────────────────────────
  section("Webhook");
  process.env.STRIPE_SECRET_KEY = "sk_test_smoke";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const bad = await postWebhook(orderId, { amountTotal: 4398, badSignature: true });
  assert(bad.status === 400, `a forged signature is rejected with 400 (got ${bad.status})`);
  assert(
    (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status === "pending",
    "and the order stays pending"
  );

  const live = await postWebhook(orderId, { amountTotal: 4398, livemode: true });
  assert(live.status === 200, "a live-mode event on a test key is acknowledged, not processed");
  assert(
    (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status === "pending",
    "and the order stays pending (livemode mismatch guard)"
  );

  const good = await postWebhook(orderId, { amountTotal: 4398 });
  assert(good.status === 200, `a correctly signed event returns 200 (got ${good.status})`);

  const paid = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert(paid.status === "paid", "the order is marked paid");
  assert(paid.paymentRef === "pi_smoke_1", "the PaymentIntent id is recorded");
  assert(paid.paymentProvider === "stripe", "the provider is recorded");
  assert(
    paid.customerEmail === "smoke-stripe@example.com",
    "the email is backfilled from the session"
  );
  assert(paid.customerName === "Smoke Tester", "the name is backfilled from the session");
  const addr = JSON.parse(paid.shippingAddress) as { postalCode: string; city: string };
  assert(addr.postalCode === "SW1A 1AA", "the delivery postcode is backfilled from the session");
  assert(addr.city === "London", "the delivery city is backfilled from the session");

  const afterFirst = await prisma.product.findUniqueOrThrow({ where: { slug: VIAL_SLUG } });
  assert(afterFirst.stock === 10, `stock fell 20 → 10 (10 vials), got ${afterFirst.stock}`);

  // ── Idempotency ─────────────────────────────────────────────────
  section("Idempotency");
  const replay = await postWebhook(orderId, { amountTotal: 4398 });
  assert(replay.status === 200, "a replayed delivery is acknowledged");
  const afterReplay = await prisma.product.findUniqueOrThrow({ where: { slug: VIAL_SLUG } });
  assert(afterReplay.stock === 10, `stock is unchanged on replay (still ${afterReplay.stock})`);
  assert(
    (await prisma.emailLog.count({ where: { orderId, type: "confirmation" } })) <= 1,
    "the confirmation email is logged at most once"
  );

  await cleanup();
  console.log(`\n${passes} assertions passed.\n`);
}

main()
  .catch(async (err) => {
    console.error(`\n${err instanceof Error ? err.message : err}\n`);
    await cleanup().catch(() => {});
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
