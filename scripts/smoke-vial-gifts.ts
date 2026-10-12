// Smoke test for free vials promised by email (lib/vial-gifts.ts) against a
// real SQLite database: paid through fulfillPaidOrder, as a webhook would.
// Claims, merging, expiry judged at checkout start, cancelled and expired
// gifts, the legacy stock check, the welcome vial alongside, and plan
// upgrades (no parcel, no gift).
//
// It deletes orders and flips the shop-wide inventory_mode setting, so it
// REFUSES to run against the real database. Point it at a throwaway file:
//
//   export DATABASE_URL="file:/tmp/smoke-vial-gifts.db"
//   npx prisma migrate deploy
//   npx tsx scripts/smoke-vial-gifts.ts
import { prisma } from "../lib/db";
import { fulfillPaidOrder } from "../lib/payments/fulfillment";
import { setInventoryMode } from "../lib/inventory/mode";
import { giftExpiresAt, isGiftItem } from "../lib/vial-gifts";
import { isWelcomeItem } from "../lib/mailing-list";

if (!process.env.DATABASE_URL || /data\/baclab\.db/.test(process.env.DATABASE_URL)) {
  console.error("Refusing to run: set DATABASE_URL to a throwaway database (see the header of this file).");
  process.exit(1);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

const HOUR = 3_600_000;
let productId = "";

async function pendingOrder(email: string, opts: { kind?: string; createdAt?: Date } = {}) {
  return prisma.order.create({
    data: {
      status: "pending",
      kind: opts.kind ?? "sale",
      customerName: "Smoke Test",
      customerEmail: email,
      shippingAddress: JSON.stringify({ line1: "1 Test St", line2: null, city: "Leeds", country: "GB", postalCode: "LS1 1AA" }),
      items: JSON.stringify([
        {
          productId,
          slug: "baclab-10ml",
          name: "Bacteriostatic Water 10ml vial",
          qty: 5,
          unitPrice: "21.99",
          lineTotal: "21.99",
          bundleId: "five",
          bundleName: "5-vial pack",
          bundleQty: 1,
        },
      ]),
      currency: "GBP",
      totalAmount: 21.99,
      paymentMethod: "btc",
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

async function pay(email: string, opts: { kind?: string; createdAt?: Date } = {}) {
  const order = await pendingOrder(email, opts);
  await fulfillPaidOrder(order.id, { provider: "stripe" });
  const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  const items = JSON.parse(paid.items) as { qty: number; gift?: boolean; welcome?: boolean }[];
  return { order: paid, items, gift: items.filter(isGiftItem), welcome: items.filter(isWelcomeItem) };
}

const gift = (email: string, vials: number, over: { expiresAt?: Date; cancelledAt?: Date; reason?: string } = {}) =>
  prisma.vialGift.create({
    data: { email, vials, reason: over.reason, expiresAt: over.expiresAt ?? giftExpiresAt(new Date()), cancelledAt: over.cancelledAt },
  });

const stock = async () => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;

async function main() {
  await prisma.vialGift.deleteMany();
  await prisma.pickLine.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscriber.deleteMany({ where: { email: { endsWith: "@smoke-gifts.test" } } });
  await prisma.product.deleteMany({ where: { slug: "baclab-10ml" } });
  await setInventoryMode("legacy");
  const product = await prisma.product.create({
    data: { slug: "baclab-10ml", name: "Vial", description: "Smoke fixture", priceGbp: 5.99, stock: 100, weightGrams: 25 },
  });
  productId = product.id;

  // ── Two waiting gifts merge; cancelled and expired ones are left ────
  const a = await gift("cust@smoke-gifts.test", 3);
  const b = await gift("cust@smoke-gifts.test", 2);
  const expired = await gift("cust@smoke-gifts.test", 1, { expiresAt: new Date(Date.now() - HOUR) });
  const cancelled = await gift("cust@smoke-gifts.test", 4, { cancelledAt: new Date() });

  const first = await pay("Cust@Smoke-Gifts.TEST");
  assert(first.gift.length === 1 && first.gift[0]!.qty === 5, "two waiting gifts become one line of 5, matched whatever the case");
  assert(first.items.length === 2 && !isGiftItem(first.items[0]!), "the gift is appended after the pack");
  const claimed = await prisma.vialGift.findMany({ where: { orderId: first.order.id } });
  assert(claimed.length === 2 && claimed.every((g) => g.claimedAt) && claimed.map((g) => g.id).sort().join() === [a.id, b.id].sort().join(), "both gifts are claimed by that order");
  assert((await prisma.vialGift.findUniqueOrThrow({ where: { id: expired.id } })).orderId === null, "an expired gift is left alone");
  assert((await prisma.vialGift.findUniqueOrThrow({ where: { id: cancelled.id } })).orderId === null, "a cancelled gift is left alone");
  assert((await stock()) === 90, "stock is taken for the pack and the free vials");
  assert(first.order.totalAmount.toString() === "21.99", "the order total is unchanged");

  const second = await pay("cust@smoke-gifts.test");
  assert(second.gift.length === 0, "the next order gets nothing: a gift is used once");

  // ── Expiry is judged when checkout began ───────────────────────────
  await gift("late@smoke-gifts.test", 2, { expiresAt: new Date(Date.now() - HOUR) });
  const late = await pay("late@smoke-gifts.test", { createdAt: new Date(Date.now() - 2 * HOUR) });
  assert(late.gift[0]?.qty === 2, "a checkout begun before expiry still gets the gift when paid after it");

  // ── No email, no gift ───────────────────────────────────────────────
  const none = await pay("");
  assert(none.gift.length === 0, "an order without an email gets no gift");

  // ── Legacy stock that cannot cover the gift leaves it waiting ───────
  await prisma.product.update({ where: { id: productId }, data: { stock: 6 } });
  const short = await gift("short@smoke-gifts.test", 3);
  const shortPaid = await pay("short@smoke-gifts.test");
  assert(shortPaid.gift.length === 0, "not enough legacy stock: the gift is not added");
  assert((await prisma.vialGift.findUniqueOrThrow({ where: { id: short.id } })).orderId === null, "…and stays waiting for the next order");
  assert((shortPaid.order.notes ?? "").includes("Free vials not added"), "…and the order says why");
  assert((await stock()) === 1, "…and only the pack is taken");
  await prisma.product.update({ where: { id: productId }, data: { stock: 100 } });
  const shortLater = await pay("short@smoke-gifts.test");
  assert(shortLater.gift[0]?.qty === 3, "with stock back, the next order gets it");

  // ── The welcome vial and a gift on the same first order ─────────────
  await prisma.subscriber.create({ data: { email: "new@smoke-gifts.test", status: "subscribed", source: "admin", consentText: "smoke" } });
  await gift("new@smoke-gifts.test", 2);
  const both = await pay("new@smoke-gifts.test");
  assert(both.welcome.length === 1 && both.gift[0]?.qty === 2, "a subscriber's first order gets the welcome vial and the gift");
  assert(both.items.findIndex(isWelcomeItem) < both.items.findIndex(isGiftItem), "…welcome line first");

  // ── A plan upgrade is a payment, not a parcel ───────────────────────
  const kept = await gift("upgrade@smoke-gifts.test", 2);
  const upgrade = await pay("upgrade@smoke-gifts.test", { kind: "plan_upgrade" });
  assert(upgrade.gift.length === 0, "a plan upgrade payment gets no gift");
  assert((await prisma.vialGift.findUniqueOrThrow({ where: { id: kept.id } })).orderId === null, "…and the gift keeps waiting");

  // ── The reason names the line ───────────────────────────────────────
  await gift("thanks@smoke-gifts.test", 2, { reason: "thanks" });
  const thanked = await pay("thanks@smoke-gifts.test");
  assert(thanked.gift[0] !== undefined && (thanked.gift[0] as { name?: string }).name === "Free vials, with our thanks", "a thank-you gift is named as one");
  await gift("mixed@smoke-gifts.test", 1, { reason: "thanks" });
  await gift("mixed@smoke-gifts.test", 1);
  const mixed = await pay("mixed@smoke-gifts.test");
  assert((mixed.gift[0] as { name?: string; qty: number }).name === "Free vials" && mixed.gift[0]!.qty === 2, "mixed reasons merge under a plain name");
  assert((first.gift[0] as { name?: string }).name === "Free vials, with our apologies", "gifts added without a reason are apologies");

  // ── Paying twice does nothing twice ─────────────────────────────────
  await gift("twice@smoke-gifts.test", 1);
  const once = await pay("twice@smoke-gifts.test");
  await fulfillPaidOrder(once.order.id, { provider: "stripe" });
  const again = await prisma.order.findUniqueOrThrow({ where: { id: once.order.id } });
  assert(again.items === once.order.items, "a repeated webhook leaves the items as they were");

  console.log("\nsmoke-vial-gifts: all passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
