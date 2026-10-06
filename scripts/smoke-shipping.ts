// Smoke test for buying carrier labels (lib/shipping/shipments.ts) against a
// real SQLite database, with SmartTrack played by a stubbed fetch — so every
// branch that decides "was a label bought?" can be driven on purpose:
// sign-in down, refused, timed out, reconciled either way, bought, voided.
//
// Refuses the real database. Point it at a throwaway file with the schema:
//
//   export DATABASE_URL="file:/tmp/smoke-shipping.db"
//   npx prisma migrate deploy
//   npx tsx scripts/smoke-shipping.ts
process.env.SMARTTRACK_API_KEY = "smoke-key";
process.env.SMARTTRACK_API_SECRET = "smoke-secret";
process.env.SMARTTRACK_ENV = "uat";

import { prisma } from "../lib/db";
import { SETTING_KEYS, writeSetting } from "../lib/settings";
import {
  autoBuyLabel,
  createShipmentLabel,
  labelProblems,
  reconcileShipment,
  shipmentLabelPdf,
  ShippingError,
  voidShipment,
} from "../lib/shipping/shipments";

if (!process.env.DATABASE_URL || /data\/baclab\.db/.test(process.env.DATABASE_URL)) {
  console.error("Refusing to run: set DATABASE_URL to a throwaway database (see the header of this file).");
  process.exit(1);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

async function rejects(fn: () => Promise<unknown>, includes: string, msg: string) {
  try {
    await fn();
  } catch (err) {
    const text = (err as Error).message;
    assert(err instanceof ShippingError && text.includes(includes), `${msg} (${text})`);
    return;
  }
  throw new Error(`FAIL: ${msg} — did not throw`);
}

// ── A pretend SmartTrack ────────────────────────────────────────────
type Mode = "ok" | "refuse" | "timeout" | "authdown";
let mode: Mode = "ok";
let labelExists = false;
const calls: { path: string; body: Record<string, unknown> }[] = [];
const PDF = Buffer.from("%PDF-1.7 smoke label").toString("base64");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const path = url.replace(/^https:\/\/(qa|www)\.smarttrack\.co\/api\/v2\//, "");
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
  calls.push({ path, body });

  if (path === "token") {
    if (mode === "authdown") {
      return json({ title: "SQLSTATE[42S02]: Base table or view not found", type: "about:blank", status: 500 }, 500);
    }
    return json({ access_token: "tok", expires_in: 3600, token_type: "Bearer" });
  }
  if (path === "generate-label") {
    if (mode === "timeout") throw new TypeError("fetch failed");
    if (mode === "refuse") {
      return json({ success: false, code: 400, data: [], message: "Please fix below error", errors: ["Please enter valid receiver postcode"] });
    }
    return json({
      success: true,
      code: 201,
      message: "Shipment created successfully",
      data: { tracking_number: ["JD0001"], order_reference: body.order_reference, id: 9001, label_bin_str: PDF },
    });
  }
  if (path === "get-label") {
    return labelExists
      ? json({ status: "success", status_code: 201, data: { order_reference: body.order_reference, tracking_number: ["JD0002"], label_bin_str: PDF } })
      : json({ success: false, code: 400, data: [], message: "Please fix below error", errors: ["Order reference Not found"] });
  }
  if (path === "void-labels") {
    return json({ success: true, code: 200, message: "Shipment deleted successfully", data: ["deleted"] });
  }
  return json({ success: false, errors: [`unexpected ${path}`] }, 404);
}) as typeof fetch;

const generateCalls = () => calls.filter((c) => c.path === "generate-label").length;

async function main() {
  // ── Fixtures ──────────────────────────────────────────────────────
  await prisma.shipment.deleteMany();
  await prisma.pickLine.deleteMany();
  await prisma.order.deleteMany({ where: { customerName: "Label Smoke" } });

  await prisma.postalService.upsert({
    where: { code: "STYDL3HPA" },
    create: { code: "STYDL3HPA", name: "Mini Pack 72", priority: 20, maxWeightGrams: 3000, maxLengthMm: 250, maxWidthMm: 250, maxHeightMm: 250, sizeFormula: "L+W+H", sizeLimitMm: 900 },
    update: { active: true },
  });
  await prisma.sku.upsert({
    where: { code: "BACLAB-10ML-X5" },
    create: { code: "BACLAB-10ML-X5", name: "Bacteriostatic Water 10ml vial — 5-pack", weightGrams: 180, lengthMm: 110, widthMm: 60, heightMm: 45 },
    update: { weightGrams: 180, lengthMm: 110, widthMm: 60, heightMm: 45, serviceCode: null, active: true },
  });
  const existingWh = await prisma.warehouse.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (existingWh) {
    await prisma.warehouse.update({ where: { id: existingWh.id }, data: { contactName: "Dispatch", addressLine1: "Unit 1", city: "Leeds", postcode: "LS1 1AA" } });
  } else {
    await prisma.warehouse.create({ data: { code: "MAIN", name: "Main", contactName: "Dispatch", addressLine1: "Unit 1", city: "Leeds", postcode: "LS1 1AA" } });
  }

  const orderData = {
    status: "paid",
    customerName: "Label Smoke",
    customerEmail: "smoke@example.com",
    shippingAddress: JSON.stringify({ line1: "22 Acacia Avenue", line2: null, city: "Leeds", country: "GB", postalCode: "LS2 2BB" }),
    items: JSON.stringify([{ productId: "x", slug: "baclab-10ml", name: "Vial", qty: 5, unitPrice: "21.99", lineTotal: "21.99", bundleId: "five", bundleQty: 1 }]),
    currency: "GBP",
    totalAmount: 21.99,
    paymentMethod: "card",
  };
  const order = await prisma.order.create({ data: orderData });
  const shipments = () => prisma.shipment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
  const orderStatus = async () => (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status;

  // ── 1. Sign-in down: nothing sent, nothing bought ───────────────
  mode = "authdown";
  await rejects(() => createShipmentLabel({ orderId: order.id, actor: "smoke" }), "No label was bought", "sign-in failure buys nothing");
  let rows = await shipments();
  assert(rows[0]?.status === "FAILED", "…and the attempt is recorded as FAILED, not left pending");
  assert(generateCalls() === 0, "…and generate-label was never called");

  // ── 2. Refused ──────────────────────────────────────────────────
  mode = "refuse";
  await rejects(() => createShipmentLabel({ orderId: order.id, actor: "smoke" }), "receiver postcode", "a refusal carries SmartTrack's reason");
  rows = await shipments();
  assert(rows[1]?.status === "FAILED" && rows[1].reference === `${order.id}-2`, "the second attempt has its own reference and failed");

  // ── 3. No answer: stays PENDING, blocks a second purchase ───────
  mode = "timeout";
  await rejects(() => createShipmentLabel({ orderId: order.id, actor: "smoke" }), "not known whether", "a timeout says the outcome is unknown");
  rows = await shipments();
  assert(rows[2]?.status === "PENDING", "the unknown attempt stays PENDING");
  await rejects(() => createShipmentLabel({ orderId: order.id, actor: "smoke" }), "already has a label", "a pending label blocks buying another");

  // ── 4. Reconcile: SmartTrack has no such label ──────────────────
  labelExists = false;
  assert((await reconcileShipment(rows[2]!.id)) === "FAILED", "reconcile marks it FAILED when SmartTrack never made it");
  assert((await orderStatus()) === "paid", "no label bought so far, so the order is still paid");

  // ── 5. Bought ───────────────────────────────────────────────────
  mode = "ok";
  const before = generateCalls();
  const { shipmentId, packed } = await createShipmentLabel({ orderId: order.id, actor: "smoke" });
  const bought = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  assert(bought.status === "CREATED" && bought.environment === "uat", "a successful call is CREATED, tagged UAT");
  assert(packed && (await orderStatus()) === "packed", "buying the label moves the order from paid to packed");
  assert(bought.trackingNumbers === '["JD0001"]', "tracking number stored");
  assert(bought.serviceCode === "STYDL3HPA" && bought.serviceChoice === "auto", "the automatically chosen service was used");
  const sent = calls.filter((c) => c.path === "generate-label")[before]!.body as {
    order_reference: string;
    service_code: string;
    receiver_postcode: string;
    sender_address_line_1: string;
    description: string;
    parcel: { weight: number; length: number; width: number; height: number }[];
  };
  assert(sent.order_reference === `${order.id}-4`, "the fourth attempt's reference was sent");
  assert(sent.parcel[0]!.weight === 0.18 && sent.parcel[0]!.length === 11 && sent.parcel[0]!.height === 4.5, "the parcel went in kg and cm");
  assert(sent.receiver_postcode === "LS2 2BB" && sent.sender_address_line_1 === "Unit 1", "addresses went through");
  assert(sent.description === "Leave at doorstep", "the default delivery instructions went in the description");
  const pdf = await shipmentLabelPdf(shipmentId);
  assert(pdf?.subarray(0, 4).toString() === "%PDF", "the stored label is served as a PDF");

  // ── 6. Void ─────────────────────────────────────────────────────
  process.env.SMARTTRACK_ENV = "live";
  process.env.SMARTTRACK_API_KEY = "smoke-live-key";
  await rejects(() => voidShipment(shipmentId), "UAT", "a UAT label cannot be voided while connected to live");
  process.env.SMARTTRACK_ENV = "uat";
  process.env.SMARTTRACK_API_KEY = "smoke-key";
  await voidShipment(shipmentId);
  const voided = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  assert(voided.status === "VOIDED" && voided.voidedAt !== null, "voiding marks it VOIDED");
  assert((await orderStatus()) === "packed", "…and leaves the order packed");
  const voidCall = calls.filter((c) => c.path === "void-labels").at(-1)!;
  assert(JSON.stringify(voidCall.body) === JSON.stringify({ order_reference: { "0": `${order.id}-4` } }), "void sends the reference keyed as SmartTrack documents");

  // ── 7. Reconcile: SmartTrack did make it ────────────────────────
  await prisma.order.update({ where: { id: order.id }, data: { status: "paid" } });
  mode = "timeout";
  await rejects(() => createShipmentLabel({ orderId: order.id, actor: "smoke" }), "not known whether", "another timeout");
  assert((await orderStatus()) === "paid", "an unknown outcome does not mark the order packed");
  const pending = (await shipments()).at(-1)!;
  labelExists = true;
  assert((await reconcileShipment(pending.id)) === "CREATED", "reconcile recovers a label that was bought");
  const recovered = await prisma.shipment.findUniqueOrThrow({ where: { id: pending.id } });
  assert(recovered.trackingNumbers === '["JD0002"]' && recovered.labelPdf === PDF, "…with its tracking number and label");
  assert((await orderStatus()) === "packed", "…and the order moves to packed, as if bought first time");

  // ── 8. Sign-in down during reconcile says nothing about the label ─
  mode = "ok";
  await voidShipment(recovered.id);
  mode = "timeout";
  await rejects(() => createShipmentLabel({ orderId: order.id, actor: "smoke" }), "not known whether", "a third timeout");
  const third = (await shipments()).at(-1)!;
  process.env.SMARTTRACK_API_KEY = "smoke-key-rotated"; // forces a fresh sign-in
  mode = "authdown";
  await rejects(() => reconcileShipment(third.id), "sign-in failed", "reconcile reports a sign-in failure");
  assert((await prisma.shipment.findUniqueOrThrow({ where: { id: third.id } })).status === "PENDING", "…and leaves the label PENDING");

  // ── 9. Bought automatically when the order is paid ─────────────
  mode = "ok";
  process.env.SMARTTRACK_API_KEY = "smoke-key";
  await prisma.setting.deleteMany({ where: { key: SETTING_KEYS.autoLabels } });
  const auto = await prisma.order.create({ data: orderData });
  const autoOrder = () => prisma.order.findUniqueOrThrow({ where: { id: auto.id } });
  const flagged = async (id: string) => (await labelProblems()).some((o) => o.id === id);

  let callsBefore = generateCalls();
  await autoBuyLabel(auto.id); // still UAT
  assert((await autoOrder()).labelError?.includes("UAT") === true && generateCalls() === callsBefore, "in UAT nothing is bought automatically, and the order says why");
  assert(await flagged(auto.id), "…which puts it in the missing-label warning");

  process.env.SMARTTRACK_ENV = "live";
  mode = "refuse";
  await autoBuyLabel(auto.id);
  const refused = await autoOrder();
  assert(refused.status === "paid" && refused.labelError?.includes("receiver postcode") === true, "a refused label leaves the order paid, with SmartTrack's reason");
  assert(await flagged(auto.id), "…and still in the warning");

  mode = "ok";
  await autoBuyLabel(auto.id);
  const autoBought = await autoOrder();
  assert(autoBought.status === "packed" && autoBought.labelError === null, "a label bought automatically moves the order to packed and clears the reason");
  assert(!(await flagged(auto.id)), "…and takes it out of the warning");
  const autoShipment = await prisma.shipment.findFirst({ where: { orderId: auto.id, status: "CREATED" } });
  assert(autoShipment?.actor === "system" && autoShipment.environment === "live", "the label is recorded as bought by the system, in LIVE");

  const off = await prisma.order.create({ data: orderData });
  const offOrder = () => prisma.order.findUniqueOrThrow({ where: { id: off.id } });
  await writeSetting(SETTING_KEYS.autoLabels, "off");
  callsBefore = generateCalls();
  await autoBuyLabel(off.id);
  assert((await offOrder()).labelError === null && generateCalls() === callsBefore, "switched off, nothing is bought and nothing is flagged");
  await writeSetting(SETTING_KEYS.autoLabels, "on");

  delete process.env.SMARTTRACK_API_KEY;
  await autoBuyLabel(off.id);
  assert((await offOrder()).labelError?.includes("not connected") === true, "with SmartTrack not connected, the order says so");

  await prisma.order.update({ where: { id: off.id }, data: { status: "shipped" } });
  assert(!(await flagged(off.id)), "an order shipped by hand leaves the warning");

  console.log("\nAll shipping smoke checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
