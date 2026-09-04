// Throwaway smoke test for order emails + repurchase nudges. Run with:
//   DATABASE_URL=file:../data/baclab.db npx tsx scripts/smoke-nudge.ts seed|check|cleanup
import { prisma } from "../lib/db";
import {
  sendOrderShippedEmail,
  unsubscribeUrl,
} from "../lib/customer-email";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

const EMAILS = ["nudge-a@example.com", "nudge-b@example.com", "nudge-c@example.com"];

async function cleanup() {
  const orders = await prisma.order.findMany({
    where: { customerEmail: { in: EMAILS } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  await prisma.emailLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.emailOptOut.deleteMany({ where: { email: { in: EMAILS } } });
  await prisma.product.deleteMany({ where: { slug: "smoke-nudge-tea" } });
  console.log("cleaned up");
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function makeOrder(email: string, productId: string, createdAt: Date, status = "paid") {
  return prisma.order.create({
    data: {
      status,
      customerName: "Smoke Test",
      customerEmail: email,
      customerPhone: "+10000000000",
      shippingAddress: JSON.stringify({ line1: "1 Test St", line2: null, city: "Test", country: "Testland", postalCode: null }),
      items: JSON.stringify([
        { productId, slug: "smoke-nudge-tea", name: "Smoke Nudge Tea", qty: 1, unitPrice: "10.00", unitPriceUsd: "10.00" },
      ]),
      currency: "AED",
      totalAmount: 10,
      subtotalUsd: 10,
      paymentMethod: "usdt",
      createdAt,
    },
  });
}

async function seed() {
  await cleanup();
  const product = await prisma.product.create({
    data: {
      slug: "smoke-nudge-tea",
      name: "Smoke Nudge Tea",
      description: "Throwaway smoke-test product",
      priceGbp: 10,
      stock: 100,
      supplyDays: 7, // 1 unit lasts 7 days → due at day 3 (7 − 4 lead)
      active: false, // keep out of the storefront
    },
  });
  // A: due → should be nudged
  const a = await makeOrder(EMAILS[0], product.id, daysAgo(10));
  // B: due but opted out → skipped
  await prisma.emailOptOut.create({ data: { email: EMAILS[1] } });
  await makeOrder(EMAILS[1], product.id, daysAgo(10));
  // C: due but customer placed a newer order → skipped
  await makeOrder(EMAILS[2], product.id, daysAgo(10));
  await makeOrder(EMAILS[2], product.id, daysAgo(1));
  console.log(JSON.stringify({ orderA: a.id, unsubA: unsubscribeUrl(EMAILS[0]) }));
}

async function check() {
  const logs = await prisma.emailLog.findMany({
    where: { order: { customerEmail: { in: EMAILS } } },
    include: { order: { select: { customerEmail: true } } },
  });
  const nudges = logs.filter((l) => l.type === "nudge");
  assert(nudges.length === 1, `exactly one nudge logged (got ${nudges.length})`);
  assert(nudges[0].order.customerEmail === EMAILS[0], "nudge went to order A only");

  // Shipped sender: sends once, dedupes on second call
  const orderA = await prisma.order.findFirstOrThrow({ where: { customerEmail: EMAILS[0] } });
  await sendOrderShippedEmail(orderA);
  await sendOrderShippedEmail(orderA);
  const shipped = await prisma.emailLog.count({ where: { orderId: orderA.id, type: "shipped" } });
  assert(shipped === 1, "shipped email logged exactly once despite two calls");

  const optedOut = await prisma.emailOptOut.findUnique({ where: { email: EMAILS[0] } });
  assert(optedOut !== null, "unsubscribe link created opt-out for nudge-a");
  console.log("ALL CHECKS PASSED");
}

const cmd = process.argv[2];
const run = cmd === "seed" ? seed : cmd === "check" ? check : cmd === "cleanup" ? cleanup : null;
if (!run) {
  console.error("usage: smoke-nudge.ts seed|check|cleanup");
  process.exit(1);
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
