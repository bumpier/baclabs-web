// Smoke test for the warehouse stock layer against a real SQLite database:
// receiving, kits, allocation on payment through fulfillPaidOrder, shortfall
// and retry, cancellation, adjustments, transfers, and the legacy path.
//
// It flips the shop-wide inventory_mode setting, so it REFUSES to run against
// the real database. Point it at a throwaway file with the schema applied:
//
//   export DATABASE_URL="file:/tmp/smoke-inventory.db"
//   npx prisma migrate deploy
//   npx tsx scripts/smoke-inventory.ts
import { prisma } from "../lib/db";
import { fulfillPaidOrder } from "../lib/payments/fulfillment";
import { setInventoryMode } from "../lib/inventory/mode";
import {
  adjustStock,
  allocateOrder,
  availableToSell,
  createStorefrontSkus,
  InventoryError,
  inventoryReadiness,
  onHandBySku,
  receiveStock,
  releaseOrder,
  transferStock,
} from "../lib/inventory/store";

if (!process.env.DATABASE_URL || /data\/baclab\.db/.test(process.env.DATABASE_URL)) {
  console.error("Refusing to run: set DATABASE_URL to a throwaway database (see the header of this file).");
  process.exit(1);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

async function rejects(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn();
  } catch (err) {
    assert(err instanceof InventoryError, `${msg} (${(err as Error).message})`);
    return;
  }
  throw new Error(`FAIL: ${msg} — did not throw`);
}

async function level(skuId: string, locationId: string) {
  const row = await prisma.stockLevel.findUnique({ where: { skuId_locationId: { skuId, locationId } } });
  return row?.quantity ?? 0;
}

function orderItems(productId: string, bundleId: string, vialsPer: number, bundleQty: number) {
  return JSON.stringify([
    {
      productId,
      slug: "baclab-10ml",
      name: "Bacteriostatic Water 10ml vial",
      qty: vialsPer * bundleQty,
      unitPrice: "21.99",
      lineTotal: (21.99 * bundleQty).toFixed(2),
      bundleId,
      bundleName: `${vialsPer}-vial pack`,
      bundleQty,
    },
  ]);
}

async function pendingOrder(productId: string, bundleId: string, vialsPer: number, bundleQty: number) {
  return prisma.order.create({
    data: {
      status: "pending",
      customerName: "Smoke Test",
      customerEmail: "",
      shippingAddress: JSON.stringify({ line1: "1 Test St", line2: null, city: "Leeds", country: "GB", postalCode: "LS1 1AA" }),
      items: orderItems(productId, bundleId, vialsPer, bundleQty),
      currency: "GBP",
      totalAmount: 21.99 * bundleQty,
      paymentMethod: "btc",
    },
  });
}

async function main() {
  // Clean slate, children first.
  await prisma.pickLine.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.skuComponent.deleteMany();
  await prisma.sku.deleteMany();
  await prisma.location.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany({ where: { slug: "baclab-10ml" } });
  await setInventoryMode("legacy");

  const product = await prisma.product.create({
    data: { slug: "baclab-10ml", name: "Vial", description: "Smoke fixture", priceGbp: 5.99, stock: 100, weightGrams: 25 },
  });

  // ── Setup ────────────────────────────────────────────────────────
  const created = await createStorefrontSkus();
  assert(created.includes("BACLAB-10ML") && created.includes("BACLAB-10ML-X5"), `storefront SKUs created (${created.join(", ")})`);
  assert((await createStorefrontSkus()).length === 0, "creating storefront SKUs again creates nothing");

  const vial = await prisma.sku.findUniqueOrThrow({ where: { code: "BACLAB-10ML" } });
  const x5 = await prisma.sku.findUniqueOrThrow({ where: { code: "BACLAB-10ML-X5" }, include: { components: true } });
  assert(vial.weightGrams === 25, "the vial SKU takes the product's weight");
  assert(x5.components.length === 1 && x5.components[0]!.quantity === 5, "the 5-pack is a kit of five vials");
  assert(x5.weightGrams === 0, "packs start unmeasured");

  let readiness = await inventoryReadiness();
  assert(!readiness.ready, "not ready without a location");

  const wh = await prisma.warehouse.create({ data: { code: "MAIN", name: "Main", addressLine1: "Unit 1", city: "Leeds", postcode: "LS1 1AA", contactName: "Dispatch" } });
  const faceA = await prisma.location.create({ data: { warehouseId: wh.id, code: "A-01", pickSequence: 10 } });
  const faceB = await prisma.location.create({ data: { warehouseId: wh.id, code: "A-02", pickSequence: 10 } });
  const overflow = await prisma.location.create({ data: { warehouseId: wh.id, code: "Z-99", pickSequence: 900 } });

  readiness = await inventoryReadiness();
  assert(readiness.ready, "ready once every pack has a SKU and a location exists");

  // ── Receiving ────────────────────────────────────────────────────
  await receiveStock({ skuId: vial.id, locationId: faceA.id, quantity: 3, reference: "PO-1", actor: "smoke" });
  await receiveStock({ skuId: vial.id, locationId: faceB.id, quantity: 4, reference: "PO-1", actor: "smoke" });
  await receiveStock({ skuId: vial.id, locationId: overflow.id, quantity: 50, reference: "PO-1", actor: "smoke" });
  assert((await onHandBySku()).get(vial.id) === 57, "on hand is the total across every location (3 + 4 + 50)");
  assert((await availableToSell("baclab-10ml-x5")) === 11, "a 5-pack kit can be made 11 times from 57 vials");
  assert((await availableToSell("BACLAB-10ML-X100")) === 0, "a 100-pack cannot be made");
  assert((await availableToSell("NOPE")) === null, "an unknown code is not for sale");
  await rejects(() => receiveStock({ skuId: x5.id, locationId: faceA.id, quantity: 1, reference: "", actor: "smoke" }), "a kit cannot be booked in");

  // ── Legacy mode: nothing in the warehouse moves ─────────────────
  const legacy = await pendingOrder(product.id, "five", 5, 1);
  await fulfillPaidOrder(legacy.id, { provider: "stripe" });
  assert((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock === 95, "legacy mode decrements the vial counter");
  assert((await prisma.pickLine.count({ where: { orderId: legacy.id } })) === 0, "legacy mode writes no pick lines");
  assert((await onHandBySku()).get(vial.id) === 57, "legacy mode leaves the shelves alone");

  // ── Warehouse mode: allocation on payment ───────────────────────
  await setInventoryMode("warehouse");
  const order = await pendingOrder(product.id, "five", 5, 2); // 10 vials
  const first = await fulfillPaidOrder(order.id, { provider: "stripe" });
  assert(first.alreadyPaid === false, "payment claims the order");
  assert((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock === 95, "warehouse mode leaves the vial counter alone");
  assert((await level(vial.id, faceA.id)) === 0, "pick face A emptied first (3)");
  assert((await level(vial.id, faceB.id)) === 0, "then pick face B (4)");
  assert((await level(vial.id, overflow.id)) === 47, "then the overflow for the last 3");
  const lines = await prisma.pickLine.findMany({ where: { orderId: order.id }, include: { location: true } });
  assert(
    lines.map((l) => `${l.location?.code}:${l.quantity}`).sort().join(",") === "A-01:3,A-02:4,Z-99:3",
    `the pick list says where from (${lines.map((l) => `${l.location?.code}:${l.quantity}`).join(", ")})`
  );
  const sales = await prisma.stockMovement.findMany({ where: { orderId: order.id, type: "SALE" } });
  assert(sales.reduce((n, m) => n + m.quantity, 0) === -10, "the ledger records -10 against the order");

  const again = await fulfillPaidOrder(order.id, { provider: "stripe" });
  assert(again.alreadyPaid === true, "a webhook retry is a no-op");
  assert((await prisma.pickLine.count({ where: { orderId: order.id } })) === 3, "…and allocates nothing twice");

  // ── Shortfall, then retry ────────────────────────────────────────
  const big = await pendingOrder(product.id, "ten", 10, 5); // 50 vials, 47 on hand
  await fulfillPaidOrder(big.id, { provider: "stripe" });
  const short = await prisma.pickLine.findFirst({ where: { orderId: big.id, locationId: null } });
  assert(short?.quantity === 3, "an order bigger than the shelves records the shortfall (3)");
  assert((await onHandBySku()).get(vial.id) === undefined, "the shelves are empty");

  await receiveStock({ skuId: vial.id, locationId: faceA.id, quantity: 2, reference: "PO-2", actor: "smoke" });
  let retry = await allocateOrder(big.id, "smoke");
  assert(retry.allocated === 2 && retry.shortfall === 1, "a retry allocates what has arrived and keeps the rest short");
  await receiveStock({ skuId: vial.id, locationId: faceB.id, quantity: 5, reference: "PO-3", actor: "smoke" });
  retry = await allocateOrder(big.id, "smoke");
  assert(retry.allocated === 1 && retry.shortfall === 0, "a second retry clears the shortfall");
  assert((await prisma.pickLine.count({ where: { orderId: big.id, locationId: null } })) === 0, "no shortfall line remains");
  const bigTotal = (await prisma.pickLine.findMany({ where: { orderId: big.id } })).reduce((n, l) => n + l.quantity, 0);
  assert(bigTotal === 50, "the pick list totals the 50 vials ordered");

  // ── Cancellation puts stock back where it came from ─────────────
  const beforeCancel = await level(vial.id, overflow.id);
  // Two cancels at once — a double-clicked button — must return it once.
  // On SQLite with one Prisma client these transactions run one after the
  // other, so this cannot reproduce the interleaving that releaseOrder's
  // per-row claim guards against (that needs Postgres or a second process).
  // It pins the outcome, not the race.
  const [r1, r2] = await Promise.all([releaseOrder(order.id, "smoke"), releaseOrder(order.id, "smoke")]);
  assert(r1 + r2 === 10, `racing cancels return the 10 vials once between them (${r1} + ${r2})`);
  const cancels = await prisma.stockMovement.aggregate({ where: { orderId: order.id, type: "CANCEL" }, _sum: { quantity: true } });
  assert(cancels._sum.quantity === 10, "…and the ledger credits exactly 10");
  assert((await level(vial.id, faceA.id)) === 3 && (await level(vial.id, faceB.id)) === 8, "to the pick faces they were taken from");
  assert((await level(vial.id, overflow.id)) === beforeCancel + 3, "and to the overflow");
  assert((await prisma.pickLine.count({ where: { orderId: order.id } })) === 0, "and the pick list is cleared");
  assert((await releaseOrder(legacy.id, "smoke")) === 0, "cancelling a legacy order moves nothing");

  // ── Adjustments and transfers ───────────────────────────────────
  await adjustStock({ skuId: vial.id, locationId: faceA.id, delta: -1, reason: "Damaged", reference: "", actor: "smoke" });
  assert((await level(vial.id, faceA.id)) === 2, "a negative adjustment removes stock");
  await rejects(
    () => adjustStock({ skuId: vial.id, locationId: faceA.id, delta: -5, reason: "Count", reference: "", actor: "smoke" }),
    "an adjustment cannot take a location below zero"
  );
  assert((await level(vial.id, faceA.id)) === 2, "…and the refused one changed nothing");
  await transferStock({ skuId: vial.id, fromLocationId: faceB.id, toLocationId: faceA.id, quantity: 5, actor: "smoke" });
  assert((await level(vial.id, faceA.id)) === 7 && (await level(vial.id, faceB.id)) === 3, "a transfer moves stock between locations");
  const pair = await prisma.stockMovement.findMany({ where: { type: "TRANSFER" } });
  assert(pair.length === 2 && pair[0]!.reference === pair[1]!.reference, "a transfer is two ledger rows sharing a reference");
  await rejects(
    () => transferStock({ skuId: vial.id, fromLocationId: faceB.id, toLocationId: faceA.id, quantity: 99, actor: "smoke" }),
    "cannot transfer more than is there"
  );

  // ── The ledger explains every level ─────────────────────────────
  const levels = await prisma.stockLevel.findMany();
  for (const l of levels) {
    const sum = await prisma.stockMovement.aggregate({ where: { skuId: l.skuId, locationId: l.locationId }, _sum: { quantity: true } });
    assert(sum._sum.quantity === l.quantity, `ledger sums to the level for location ${l.locationId.slice(-4)} (${l.quantity})`);
  }

  // ── Scan station ────────────────────────────────────────────────
  // `big` picks Z-99:47, A-01:2, A-02:1 — walking order A-01, A-02, Z-99.
  const { openPickList, recordPickScan, resetPicks, markPacked, PickingError } = await import("../lib/inventory/picking");
  const pickRef = `ORD-${big.id.slice(0, 8).toUpperCase()}`;
  const view = await openPickList(pickRef.toLowerCase());
  assert(view.orderId === big.id && view.lines.length === 3, "a scanned pick label opens its order");
  assert(view.lines.map((l) => l.locationCode).join(",") === "A-01,A-02,Z-99", "the lines come in walking order");
  let scan = await recordPickScan(big.id, "LOC-B-07");
  assert(scan.outcome === "bad", `a wrong shelf buzzes (${scan.message})`);
  scan = await recordPickScan(big.id, "BACLAB-10ML-X5");
  assert(scan.outcome === "bad", `a wrong item buzzes (${scan.message})`);
  scan = await recordPickScan(big.id, "LOC-A-01");
  assert(scan.outcome === "good" && scan.view.lines[0]!.picked === 2, `the right shelf beeps and ticks it off (${scan.message})`);
  scan = await recordPickScan(big.id, "loc-z-99");
  assert(scan.outcome === "good" && scan.view.lines[2]!.picked === 47, "a shelf scan counts everything taken from it");
  await rejects(() => markPacked(big.id).catch((e) => { throw e instanceof PickingError ? new InventoryError(e.message) : e; }), "cannot mark packed with one unit to go");
  scan = await recordPickScan(big.id, "BACLAB-10ML");
  assert(scan.outcome === "complete", `the last unit plays the finished chime (${scan.message})`);
  scan = await recordPickScan(big.id, "BACLAB-10ML");
  assert(scan.outcome === "bad", `one too many buzzes (${scan.message})`);
  assert((await markPacked(big.id)).status === "packed", "a fully scanned order can be marked packed");
  const cleared = await resetPicks(big.id);
  assert(!cleared.complete && cleared.lines.every((l) => l.picked === 0), "start again clears the tally");
  await recordPickScan(big.id, "LOC-A-01");
  await recordPickScan(big.id, "LOC-Z-99");
  const lastTwo = await Promise.all([recordPickScan(big.id, "BACLAB-10ML"), recordPickScan(big.id, "BACLAB-10ML")]);
  assert(
    lastTwo.filter((s) => s.outcome === "complete").length === 1 && lastTwo.filter((s) => s.outcome === "bad").length === 1,
    "two scans of the last unit together count it once"
  );
  await rejects(
    () => openPickList(`ORD-${order.id.slice(0, 8).toUpperCase()}`).catch((e) => { throw e instanceof PickingError ? new InventoryError(e.message) : e; }),
    "an order with no pick list will not open"
  );

  // ── Missing SKU: nothing half-allocated ─────────────────────────
  await prisma.skuComponent.deleteMany({ where: { kitId: x5.id } });
  await prisma.sku.delete({ where: { id: x5.id } });
  const orphan = await pendingOrder(product.id, "five", 5, 1);
  await fulfillPaidOrder(orphan.id, { provider: "stripe" });
  const orphanRow = await prisma.order.findUniqueOrThrow({ where: { id: orphan.id } });
  assert(orphanRow.status === "paid", "payment still stands when allocation fails");
  assert((await prisma.pickLine.count({ where: { orderId: orphan.id } })) === 0, "and nothing was allocated against a missing SKU");

  await setInventoryMode("legacy");
  console.log("\nAll inventory smoke checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
