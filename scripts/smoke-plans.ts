// Smoke test for monthly plans against the worktree database. Run with:
//   NEXT_PUBLIC_DELIVERY_CHOICE=on DATABASE_URL=file:../data/baclab.db npx tsx scripts/smoke-plans.ts seed-product|activation|boxes|renewals|cleanup
// NEXT_PUBLIC_DELIVERY_CHOICE=on is required: plan prices depend on it (the
// £266.70 asserted for a 12-month 5-vial plan includes £3.90 delivery per box).
// Every row it makes has an @smoke-plans.test email; cleanup removes them all.
// Emails print to the console (no RESEND_API_KEY); labels fail with
// "SmartTrack is not connected", recorded as Order.labelError, as expected.
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { planPrice, type PlanMonths, type PlanPackId } from "../config/plans";
import { planPurchaseItems, planRowData } from "../lib/plans/items";
import { afterBox, boxDueAt, renewalWindow } from "../lib/plans/schedule";
import { runPlanBoxes, runPlanRenewals } from "../lib/plans/boxes";
import { fulfillPaidOrder } from "../lib/payments/fulfillment";
import { shopDayKey } from "../lib/saleTime";

// The boxes command buys postage labels through the real code path. With
// SmartTrack credentials in the environment that would buy real ones.
if (process.env.SMARTTRACK_API_KEY) {
  console.error("Refusing to run: SMARTTRACK_API_KEY is set, and this script buys postage labels. Unset SMARTTRACK_API_KEY (and SMARTTRACK_API_SECRET) first.");
  process.exit(1);
}

const DOMAIN = "@smoke-plans.test";
const VIAL_SLUG = "baclab-10ml";
const ADDRESS = JSON.stringify({ line1: "1 Test St", line2: null, city: "London", country: "GB", postalCode: "SW1A 1AA" });

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}
/** fulfillPaidOrder fires its emails without awaiting them. */
const settle = () => new Promise((r) => setTimeout(r, 800));

async function vialProduct() {
  return (
    (await prisma.product.findUnique({ where: { slug: VIAL_SLUG } })) ??
    prisma.product.create({
      data: { slug: VIAL_SLUG, name: "Bacteriostatic Water", description: "Local test row", priceGbp: 5.99, stock: 1000, active: true },
    })
  );
}

/** A pending plan purchase, exactly as /api/checkout makes one (Task 5). */
async function pendingPlanPurchase(email: string, packId: PlanPackId, months: PlanMonths) {
  const product = await vialProduct();
  const plan = planPrice(packId, months);
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        status: "pending", customerName: "Smoke Plan", customerEmail: email, shippingAddress: ADDRESS,
        items: JSON.stringify(planPurchaseItems({ productId: product.id, slug: product.slug, plan, totalUsd: "0.00" })),
        currency: "GBP", totalAmount: new Prisma.Decimal((plan.totalMinor / 100).toFixed(2)),
        paymentMethod: "card", paymentProvider: "stripe", deliveryOption: "standard",
      },
    });
    const row = await tx.plan.create({ data: { ...planRowData(plan, "checkout"), purchaseOrderId: order.id } });
    return tx.order.update({ where: { id: order.id }, data: { planId: row.id, planBox: 1 } });
  });
}

/** A paid one-off 5-pack, `daysAgo` days old. */
async function paidOneOff(email: string, daysAgo: number) {
  const product = await vialProduct();
  const paidAt = new Date(Date.now() - daysAgo * 86_400_000);
  return prisma.order.create({
    data: {
      status: "paid", customerName: "Smoke Upgrade", customerEmail: email, shippingAddress: ADDRESS,
      items: JSON.stringify([{ productId: product.id, slug: product.slug, name: "Bacteriostatic Water 10ml vial", qty: 5, unitPrice: "21.99", unitPriceUsd: "0", lineTotal: "21.99", lineTotalUsd: "0", bundleId: "five", bundleName: "5-vial pack", bundleQty: 1 }]),
      currency: "GBP", totalAmount: new Prisma.Decimal("21.99"), amountPaidMinor: 2589, deliveryMinor: 390,
      paymentMethod: "card", paymentProvider: "stripe", deliveryOption: "standard", paidAt, createdAt: paidAt,
    },
  });
}

/** A pending upgrade, exactly as /api/checkout/plan-upgrade makes one (Task 12). */
async function pendingUpgrade(original: { id: string; customerEmail: string }, months: PlanMonths, priceMinor: number) {
  const plan = planPrice("five", months);
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        status: "pending", kind: "plan_upgrade", customerName: "Smoke Upgrade", customerEmail: original.customerEmail,
        shippingAddress: ADDRESS, items: "[]", currency: "GBP",
        totalAmount: new Prisma.Decimal((priceMinor / 100).toFixed(2)), paymentMethod: "card", paymentProvider: "stripe",
      },
    });
    const row = await tx.plan.create({
      data: { ...planRowData(plan, "upgrade"), upgradeOfOrderId: original.id, purchaseOrderId: order.id, email: original.customerEmail },
    });
    return tx.order.update({ where: { id: order.id }, data: { planId: row.id } });
  });
}

async function activation() {
  await cleanup();
  const product = await vialProduct();
  const stockBefore = product.stock;

  // A 12-month 5-vial plan bought at checkout.
  const purchase = await pendingPlanPurchase(`plan-a${DOMAIN}`, "five", 12);
  const first = await fulfillPaidOrder(purchase.id, { provider: "stripe", paymentRef: "smoke_a" });
  await settle();
  assert(first.alreadyPaid === false, "the purchase order is marked paid");
  const plan = await prisma.plan.findUniqueOrThrow({ where: { purchaseOrderId: purchase.id } });
  const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: purchase.id } });
  const anchor = shopDayKey(paidOrder.paidAt!);
  assert(plan.status === "active" && plan.boxesSent === 1 && plan.paidMinor === 26670, "the plan is active with box 1 sent and £266.70 paid");
  assert(plan.anchorDay === anchor && plan.nextBoxAt?.getTime() === boxDueAt(anchor, 2).getTime(), "box 2 is due one month on");
  assert(plan.email === `plan-a${DOMAIN}`, "the plan carries the customer's email");
  const afterOne = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock;
  assert(afterOne === stockBefore - 10, "box 1 took the 5-pack and the bonus 5-pack off the shelf");
  assert((await prisma.emailLog.count({ where: { orderId: purchase.id, type: "confirmation" } })) === 1, "one confirmation email");
  const again = await fulfillPaidOrder(purchase.id, { provider: "stripe", paymentRef: "smoke_a" });
  assert(again.alreadyPaid === true, "a webhook retry is a no-op");
  assert((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock === afterOne, "…and takes no more stock");

  // An abandoned plan checkout is deleted with its plan.
  const abandoned = await pendingPlanPurchase(`plan-b${DOMAIN}`, "ten", 3);
  await prisma.order.delete({ where: { id: abandoned.id } });
  assert((await prisma.plan.count({ where: { purchaseOrderId: abandoned.id } })) === 0, "deleting a pending purchase deletes its pending plan");

  // Upgrading a one-off 5-pack paid 2 days ago to 12 months.
  const original = await paidOneOff(`upgrade-a${DOMAIN}`, 2);
  const upgrade = await pendingUpgrade(original, 12, 24081);
  const stockBeforeUpgrade = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock;
  await fulfillPaidOrder(upgrade.id, { provider: "stripe", paymentRef: "smoke_u", amountPaidMinor: 24081 });
  await settle();
  const up = await prisma.plan.findUniqueOrThrow({ where: { purchaseOrderId: upgrade.id } });
  const box1 = await prisma.order.findUniqueOrThrow({ where: { id: original.id } });
  const originalAnchor = shopDayKey(original.paidAt!);
  assert(up.status === "active" && up.boxesSent === 1 && up.paidMinor === 2589 + 24081, "the upgraded plan is active and counts both payments");
  assert(box1.planId === up.id && box1.planBox === 1, "the original order is box 1");
  assert(up.bonusBox === 2 && up.nextBoxAt?.getTime() === boxDueAt(originalAnchor, 2).getTime(), "box 2 (with the bonus) is due a month after the original payment");
  assert((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock === stockBeforeUpgrade, "the upgrade takes no stock");
  const paidUpgrade = await prisma.order.findUniqueOrThrow({ where: { id: upgrade.id } });
  assert(paidUpgrade.items === "[]" && paidUpgrade.labelError === null, "the upgrade has no items and no label attempt");
  assert((await prisma.shipment.count({ where: { orderId: upgrade.id } })) === 0, "…and no shipment");

  // A second upgrade paid for the same order cannot take box 1.
  const twice = await pendingUpgrade(original, 6, 10746);
  await fulfillPaidOrder(twice.id, { provider: "stripe", paymentRef: "smoke_u2", amountPaidMinor: 10746 });
  const dup = await prisma.plan.findUniqueOrThrow({ where: { purchaseOrderId: twice.id } });
  assert(dup.status === "cancelled" && dup.refundMinor === 10746, "a second paid upgrade is cancelled with its payment as the refund due");
  console.log("activation: all good");
}

async function boxes() {
  await activation(); // leaves an active 12-month plan (plan-a) and an active upgraded one (upgrade-a)
  const product = await vialProduct();
  const plan = await prisma.plan.findFirstOrThrow({ where: { email: `plan-a${DOMAIN}`, status: "active" } });
  // Park the upgraded plan (its box 2 falls due two days before plan-a's) so
  // the first runs below touch plan-a alone.
  const up0 = await prisma.plan.findFirstOrThrow({ where: { email: `upgrade-a${DOMAIN}`, status: "active" } });
  await prisma.plan.update({ where: { id: up0.id }, data: { nextBoxAt: new Date("2099-01-01T00:00:00Z") } });
  const due = new Date(plan.nextBoxAt!.getTime() + 60_000);
  const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock;

  const r1 = await runPlanBoxes(due);
  const box2 = await prisma.order.findFirstOrThrow({ where: { planId: plan.id, planBox: 2 } });
  assert(r1.created === 1, "box 2 is made when due");
  assert(box2.status === "paid" && box2.kind === "plan_box" && Number(box2.totalAmount) === 0 && box2.amountPaidMinor === 0, "box 2 is a paid £0 plan box");
  assert(box2.deliveryOption === "standard" && box2.customerEmail === `plan-a${DOMAIN}` && box2.shippingAddress === ADDRESS, "box 2 goes Standard to box 1's address");
  assert(JSON.parse(box2.items).length === 1 && JSON.parse(box2.items)[0].bundleId === "five", "box 2 is one 5-pack line");
  assert((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock === stockBefore - 5, "box 2 took 5 vials");
  assert((await prisma.emailLog.count({ where: { orderId: box2.id } })) === 0, "box 2 sends no confirmation email");
  const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  assert(after.boxesSent === 2 && after.nextBoxAt?.getTime() === afterBox({ months: 12, anchorDay: plan.anchorDay! }, 2).nextBoxAt?.getTime(), "the plan moves to box 3 a month on");

  const r2 = await runPlanBoxes(due);
  assert((await prisma.order.count({ where: { planId: plan.id, planBox: 2 } })) === 1 && r2.created === 0, "a re-run makes nothing");

  // Force the race: put the plan back as if box 2 had not been counted.
  await prisma.plan.update({ where: { id: plan.id }, data: { boxesSent: 1, nextBoxAt: plan.nextBoxAt } });
  const r3 = await runPlanBoxes(due);
  assert(r3.created === 0 && (await prisma.order.count({ where: { planId: plan.id, planBox: 2 } })) === 1, "the unique (planId, planBox) stops a second box 2");
  assert((await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).boxesSent === 1, "…and rolls the plan back with it");
  await prisma.plan.update({ where: { id: plan.id }, data: { boxesSent: 2, nextBoxAt: after.nextBoxAt } });

  // The upgraded plan's box 2 carries the bonus pack. Unpark it first; at its
  // date plan-a is not due (its box 3 is a month later).
  await prisma.plan.update({ where: { id: up0.id }, data: { nextBoxAt: up0.nextBoxAt } });
  await runPlanBoxes(new Date(up0.nextBoxAt!.getTime() + 60_000));
  const upBox2 = await prisma.order.findFirstOrThrow({ where: { planId: up0.id, planBox: 2 } });
  assert(JSON.parse(upBox2.items).length === 2, "an upgraded 12-month plan's box 2 carries the bonus pack");

  // A cancelled plan makes no more boxes (other plans may make theirs on this run).
  await prisma.plan.update({ where: { id: plan.id }, data: { status: "cancelled", cancelledAt: new Date() } });
  await runPlanBoxes(new Date(after.nextBoxAt!.getTime() + 60_000));
  assert((await prisma.order.count({ where: { planId: plan.id, planBox: 3 } })) === 0, "a cancelled plan makes no box");

  // A 3-month plan runs to completion.
  const short = await pendingPlanPurchase(`plan-c${DOMAIN}`, "ten", 3);
  await fulfillPaidOrder(short.id, { provider: "stripe", paymentRef: "smoke_c" });
  for (let i = 0; i < 4; i++) {
    const p = await prisma.plan.findUniqueOrThrow({ where: { purchaseOrderId: short.id } });
    if (p.nextBoxAt) await runPlanBoxes(new Date(p.nextBoxAt.getTime() + 60_000));
  }
  const done = await prisma.plan.findUniqueOrThrow({ where: { purchaseOrderId: short.id } });
  assert(done.status === "completed" && done.boxesSent === 3 && done.nextBoxAt === null, "a 3-month plan completes after box 3");
  assert((await prisma.order.count({ where: { planId: done.id } })) === 3, "…with exactly three box orders");
  console.log("boxes: all good");
}

async function renewals() {
  await activation();
  const plan = await prisma.plan.findFirstOrThrow({ where: { email: `plan-a${DOMAIN}`, status: "active" } });
  const { from } = renewalWindow(plan.anchorDay!, plan.months);
  // Counted on plan-a's own purchase order: the upgraded plan's window opens
  // two days earlier, so run totals would include its email too.
  const sentForA = () => prisma.emailLog.count({ where: { orderId: plan.purchaseOrderId, type: "plan_renewal" } });
  await runPlanRenewals(new Date(from.getTime() - 60_000));
  assert((await sentForA()) === 0, "no renewal before the window");
  await runPlanRenewals(new Date(from.getTime() + 60_000));
  assert((await sentForA()) === 1, "the renewal email goes once the window opens");
  assert((await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).renewalEmailSentAt !== null, "…and is recorded on the plan");
  await runPlanRenewals(new Date(from.getTime() + 120_000));
  assert((await sentForA()) === 1, "…and only once");
  console.log("renewals: all good");
}

async function cleanup() {
  const orders = await prisma.order.findMany({ where: { customerEmail: { endsWith: DOMAIN } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await prisma.emailLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.shipment.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.pickLine.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.stockMovement.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.updateMany({ where: { id: { in: ids } }, data: { planId: null, planBox: null } });
  await prisma.plan.deleteMany({ where: { OR: [{ purchaseOrderId: { in: ids } }, { email: { endsWith: DOMAIN } }] } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  console.log(`cleaned up ${ids.length} order(s)`);
}

const commands: Record<string, () => Promise<unknown>> = {
  "seed-product": async () => console.log(`product ${(await vialProduct()).slug} ready`),
  activation,
  boxes,
  renewals,
  cleanup,
};
const cmd = process.argv[2] ?? "";
const run = commands[cmd];
if (!run) {
  console.error(`usage: smoke-plans.ts ${Object.keys(commands).join("|")}`);
  process.exit(1);
}
run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
