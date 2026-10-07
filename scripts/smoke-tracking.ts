// Smoke test for moving orders on from SmartTrack tracking
// (lib/shipping/tracking-sync.ts) and the catch-up groups
// (lib/shipping/catch-up.ts), against a real SQLite database with
// SmartTrack played by a stubbed fetch, like scripts/smoke-shipping.ts.
//
// Refuses the real database. Point it at a throwaway file with the schema:
//
//   export DATABASE_URL="file:/tmp/smoke-tracking.db"
//   npx prisma migrate deploy
//   npx tsx scripts/smoke-tracking.ts
process.env.SMARTTRACK_API_KEY = "smoke-key";
process.env.SMARTTRACK_API_SECRET = "smoke-secret";
process.env.SMARTTRACK_ENV = "live";
delete process.env.RESEND_API_KEY;

import { prisma } from "../lib/db";
import { SETTING_KEYS, writeSetting } from "../lib/settings";
import { orderTracking, syncTracking, trackingProblems } from "../lib/shipping/tracking-sync";
import { catchUpGroups, closeCatchUpGroup } from "../lib/shipping/catch-up";
import { MANUAL_MOVES } from "../lib/order-status";

if (!process.env.DATABASE_URL || /data\/baclab\.db/.test(process.env.DATABASE_URL)) {
  console.error("Refusing to run: set DATABASE_URL to a throwaway database (see the header of this file).");
  process.exit(1);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

// Emails go nowhere without a Resend key; in dev their body is logged, which
// is caught here so the shipped email's contents can be checked.
const emails: string[] = [];
const log = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("[dev email]")) emails.push(args[0]);
  else log(...args);
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);
const near = (d: Date | null | undefined, expected: Date) => !!d && Math.abs(d.getTime() - expected.getTime()) < 5000;

// SmartTrack writes event times as UK wall-clock time with no zone.
const ukFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function ukWall(d: Date): string {
  const p: Record<string, string> = {};
  for (const part of ukFmt.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

// ── A pretend SmartTrack ────────────────────────────────────────────
type Scan = [code: string, desc: string, at: Date];
const tracking: Record<string, Scan[] | "none" | "error"> = {};
const asked: string[] = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const path = String(input).replace(/^https:\/\/(qa|www)\.smarttrack\.co\/api\/v2\//, "");
  if (path === "token") return json({ access_token: "tok", expires_in: 3600, token_type: "Bearer" });
  if (path.startsWith("get-tracking/")) {
    const number = decodeURIComponent(path.slice("get-tracking/".length));
    asked.push(number);
    const t = tracking[number];
    if (!t || t === "none") {
      return json({ success: false, code: 400, data: [], message: "No Tracking data found", errors: ["No Tracking data found"] }, 400);
    }
    if (t === "error") return json({ title: "Server Error", status: 500 }, 500);
    const events = [...t]
      .sort((x, y) => y[2].getTime() - x[2].getTime())
      .map(([code, desc, at]) => ({ event_datetime: ukWall(at), event_code: code, event_desc: desc, city: "", country: "United Kingdom" }));
    return json({
      success: true,
      code: 200,
      message: "Tracking data found",
      data: { shipment_detail: { tracking_number: number, carrier_name: "Royal Mail", last_event: events[0], events }, tracking_events: {} },
    });
  }
  return json({ success: false, errors: [`unexpected ${path}`] }, 404);
}) as typeof fetch;

// ── Fixtures ────────────────────────────────────────────────────────
const NAME = "Tracking Smoke";
let n = 0;

async function makeOrder(status: string, soldAgo: number, extra: { labelError?: string } = {}) {
  return prisma.order.create({
    data: {
      status,
      customerName: NAME,
      customerEmail: `tracking-smoke-${++n}@example.com`,
      shippingAddress: JSON.stringify({ line1: "1 Test St", city: "Leeds", country: "GB", postalCode: "LS1 1AA" }),
      items: JSON.stringify([{ productId: "x", slug: "baclab-10ml", name: "Vial", qty: 1, unitPrice: "5.99" }]),
      currency: "GBP",
      totalAmount: 5.99,
      paymentMethod: "card",
      deliveryOption: "standard",
      paidAt: ago(soldAgo),
      createdAt: ago(soldAgo + HOUR),
      labelError: extra.labelError ?? null,
    },
  });
}

async function makeLabel(orderId: string, number: string, opts: { environment?: string; status?: string; madeAgo?: number } = {}) {
  return prisma.shipment.create({
    data: {
      orderId,
      reference: `${orderId.replace(/-/g, "")}-${number}`,
      environment: opts.environment ?? "live",
      status: opts.status ?? "CREATED",
      serviceCode: "STNINRM48",
      serviceName: "Royal Mail Tracked 48",
      weightGrams: 100,
      lengthMm: 100,
      widthMm: 50,
      heightMm: 30,
      trackingNumbers: JSON.stringify([number]),
      createdAt: ago(opts.madeAgo ?? 12 * HOUR),
    },
  });
}

const orderOf = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
const labelOf = (orderId: string) => prisma.shipment.findFirstOrThrow({ where: { orderId } });
const emailTypes = async (id: string) =>
  (await prisma.emailLog.findMany({ where: { orderId: id }, orderBy: { sentAt: "asc" } })).map((e) => e.type).join(",");
const recheck = { staleBefore: new Date(Date.now() + 60_000) };

async function main() {
  const old = await prisma.order.findMany({ where: { customerName: NAME }, select: { id: true } });
  const oldIds = old.map((o) => o.id);
  await prisma.emailLog.deleteMany({ where: { orderId: { in: oldIds } } });
  await prisma.shipment.deleteMany({ where: { orderId: { in: oldIds } } });
  await prisma.order.deleteMany({ where: { id: { in: oldIds } } });
  await prisma.setting.deleteMany({ where: { key: SETTING_KEYS.trackingUpdates } });

  // ── Orders in every situation ─────────────────────────────────────
  const a = await makeOrder("packed", 1 * DAY); // the carrier has it
  await makeLabel(a.id, "A1");
  tracking.A1 = [["144", "Data Received", ago(20 * HOUR)], ["133", "Picked Up", ago(3 * HOUR)]];

  const b = await makeOrder("shipped", 3 * DAY); // delivered today
  await prisma.order.update({ where: { id: b.id }, data: { shippedAt: ago(2 * DAY) } });
  await makeLabel(b.id, "B1", { madeAgo: 3 * DAY });
  tracking.B1 = [["133", "Picked Up", ago(2 * DAY)], ["121", "Delivered", ago(2 * HOUR)]];

  const c = await makeOrder("packed", 2 * DAY); // straight from label to delivered
  await makeLabel(c.id, "C1", { madeAgo: 2 * DAY });
  tracking.C1 = [["133", "Picked Up", ago(30 * HOUR)], ["121", "Delivered", ago(4 * HOUR)]];

  const d = await makeOrder("packed", 10 * DAY); // old: moves, but nobody is emailed
  await makeLabel(d.id, "D1", { madeAgo: 10 * DAY });
  tracking.D1 = [["133", "Picked Up", ago(9 * DAY)]];
  const d2 = await makeOrder("packed", 10 * DAY);
  await makeLabel(d2.id, "D2", { madeAgo: 10 * DAY });
  tracking.D2 = [["133", "Picked Up", ago(9 * DAY)], ["121", "Delivered", ago(8 * DAY)]];

  const e = await makeOrder("packed", 1 * DAY); // nothing at SmartTrack yet
  await makeLabel(e.id, "E1");
  tracking.E1 = "none";

  const f = await makeOrder("cancelled", 1 * DAY); // cancelled: left alone
  await makeLabel(f.id, "F1");
  tracking.F1 = [["121", "Delivered", ago(HOUR)]];

  const g = await makeOrder("packed", 1 * DAY); // a UAT label: never a real parcel
  await makeLabel(g.id, "G1", { environment: "uat" });
  tracking.G1 = [["121", "Delivered", ago(HOUR)]];

  const h = await makeOrder("paid", 1 * DAY); // label bought, but never moved to packed
  await makeLabel(h.id, "H1");
  tracking.H1 = [["140", "Collected", ago(5 * HOUR)]];

  const i = await makeOrder("packed", 1 * DAY); // SmartTrack falls over
  await makeLabel(i.id, "I1");
  tracking.I1 = "error";

  const j = await makeOrder("packed", 2 * DAY); // a delivery problem
  await makeLabel(j.id, "J1", { madeAgo: 2 * DAY });
  tracking.J1 = [["133", "Picked Up", ago(30 * HOUR)], ["112", "Address Problem", ago(2 * HOUR)]];

  const k = await makeOrder("packed", 5 * DAY); // labelled days ago, never scanned
  await makeLabel(k.id, "K1", { madeAgo: 5 * DAY });
  tracking.K1 = [["144", "Data Received", ago(5 * DAY)]];

  // ── Switched off, or not LIVE: nothing happens ────────────────────
  await writeSetting(SETTING_KEYS.trackingUpdates, "off");
  let r = await syncTracking();
  assert(!r.ran && /switched off/.test(r.reason ?? "") && asked.length === 0, "switched off on the Shipping page, nothing is checked");
  await writeSetting(SETTING_KEYS.trackingUpdates, "on");
  process.env.SMARTTRACK_ENV = "uat";
  r = await syncTracking();
  assert(!r.ran && /UAT/.test(r.reason ?? "") && asked.length === 0, "connected to UAT, nothing is checked");
  process.env.SMARTTRACK_ENV = "live";

  // ── The run ───────────────────────────────────────────────────────
  r = await syncTracking();
  assert(r.ran, "in LIVE with tracking on, it runs");
  assert(!asked.includes("F1") && !asked.includes("G1"), "a cancelled order's label and a UAT label are never asked about");
  assert(r.errors === 1 && r.remaining === 0, `one label could not be checked, none left over (${r.checked} checked)`);

  let o = await orderOf(a.id);
  assert(o.status === "shipped", "the first carrier scan moves a label-created order to shipped");
  assert(near(o.shippedAt, ago(3 * HOUR)), "…dated at that scan, read as UK time");
  assert((await emailTypes(a.id)) === "shipped", "…and sends the shipped email once");
  assert(emails.some((m) => m.includes(o.customerEmail) && m.includes("A1") && m.includes("Royal Mail")), "…carrying the tracking number and carrier");
  const la = await labelOf(a.id);
  assert(
    la.trackingStage === "in_transit" && la.carrierName === "Royal Mail" && la.trackingEvent === "Picked Up" && la.trackingCheckedAt !== null,
    "…and the label records what tracking said"
  );

  o = await orderOf(b.id);
  assert(o.status === "delivered" && near(o.deliveredAt, ago(2 * HOUR)), "a delivery scan moves a shipped order to delivered, dated at the scan");
  assert(near(o.shippedAt, ago(2 * DAY)), "…keeping when it shipped");
  assert((await emailTypes(b.id)) === "delivered", "…and sends the delivered email");

  o = await orderOf(c.id);
  assert(o.status === "delivered" && near(o.shippedAt, ago(30 * HOUR)), "an order delivered between checks goes straight to delivered, with its shipped date");
  assert((await emailTypes(c.id)) === "delivered", "…and gets only the delivered email, not a late 'on its way'");

  assert((await orderOf(d.id)).status === "shipped" && (await emailTypes(d.id)) === "", "an order sold 10 days ago moves to shipped without an email");
  assert((await orderOf(d2.id)).status === "delivered" && (await emailTypes(d2.id)) === "", "…and one delivered 8 days ago moves to delivered without an email");

  o = await orderOf(e.id);
  const le = await labelOf(e.id);
  assert(o.status === "packed" && le.trackingStage === "awaiting" && le.trackingCheckedAt !== null, "no tracking yet: the order stays label created, and the check is recorded");

  assert((await orderOf(f.id)).status === "cancelled" && (await emailTypes(f.id)) === "", "a cancelled order is untouched");
  assert((await orderOf(g.id)).status === "packed", "an order with only a UAT label is untouched");
  assert((await orderOf(h.id)).status === "shipped", "a paid order whose label was bought still moves to shipped");
  assert((await orderOf(i.id)).status === "packed", "a label SmartTrack could not answer for stays where it was");

  o = await orderOf(j.id);
  const lj = await labelOf(j.id);
  assert(o.status === "shipped" && lj.trackingStage === "problem" && lj.trackingEvent === "Address Problem", "a delivery problem: shipped, with the problem recorded");
  const { problems, notScanned } = await trackingProblems();
  assert(problems.length === 1 && problems[0]!.order.id === j.id, "…and listed in the tracking warning");
  assert(notScanned.some((x) => x.order.id === k.id) && !notScanned.some((x) => x.order.id === e.id), "a label made 5 days ago with no scan is listed; one made today is not");

  // ── Again: nothing new ────────────────────────────────────────────
  const askedBefore = asked.length;
  const emailsBefore = await prisma.emailLog.count();
  r = await syncTracking();
  assert(r.checked === 0 && asked.length === askedBefore, "a second run straight after asks about nothing checked in the last hour");
  assert((await prisma.emailLog.count()) === emailsBefore, "…and emails no one");

  // "Check tracking now" on one label checks it whatever the time.
  tracking.E1 = [["146", "Arrived at Leeds Mail Centre", ago(HOUR)]];
  r = await syncTracking({ shipmentId: (await labelOf(e.id)).id, ...recheck });
  assert(r.checked === 1 && (await orderOf(e.id)).status === "shipped", "checking one label now moves its order on");

  // A delivered order is never moved back by older-looking tracking.
  tracking.B1 = [["133", "Picked Up", ago(2 * DAY)]];
  await syncTracking({ shipmentId: (await labelOf(b.id)).id, ...recheck });
  assert((await orderOf(b.id)).status === "delivered", "tracking never moves an order backwards");

  // ── The time budget ───────────────────────────────────────────────
  for (const x of [1, 2, 3]) {
    const order = await makeOrder("packed", 1 * DAY);
    await makeLabel(order.id, `T${x}`);
    tracking[`T${x}`] = "none";
  }
  let tick = 0;
  const start = Date.now();
  r = await syncTracking({ budgetMs: 60_000, now: () => new Date(start + tick++ * 40_000) });
  assert(r.checked === 1 && r.remaining === 2, `a run that runs out of time stops and says how many are left (${r.checked} checked, ${r.remaining} left)`);
  r = await syncTracking();
  assert(r.checked === 2 && r.remaining === 0, "…and the next run checks the rest");

  // ── The catch-up groups ───────────────────────────────────────────
  const l = await makeOrder("packed", 10 * DAY); // no label on record
  const m = await makeOrder("paid", 10 * DAY, { labelError: "SmartTrack refused it" }); // the automatic label failed
  const p = await makeOrder("packed", 10 * DAY); // a label still being bought
  await makeLabel(p.id, "P1", { status: "PENDING", madeAgo: 10 * DAY });
  const q = await makeOrder("packed", 1 * DAY); // sold yesterday: left alone
  const groups = await catchUpGroups();
  const ids = (rows: { id: string }[]) => rows.map((x) => x.id);
  assert(ids(groups.noLabel).includes(l.id) && !ids(groups.noLabel).includes(m.id), "no label on record: listed, without the failed-label order");
  assert(ids(groups.labelFailed).includes(m.id), "the failed automatic label has its own group");
  assert(ids(groups.notScanned).includes(k.id), "labelled but never scanned has its own group");
  const all = [...ids(groups.noLabel), ...ids(groups.labelFailed), ...ids(groups.notScanned)];
  assert(!all.includes(p.id), "an order whose label is still being bought is in no group");
  assert(!all.includes(q.id) && !all.includes(i.id), "orders sold in the last 3 days are in no group");
  assert(groups.recent >= 2, "…and are counted as rightly waiting");

  const moved = await closeCatchUpGroup("noLabel");
  o = await orderOf(l.id);
  assert(moved === 1 && o.status === "delivered" && o.deliveredAt === null && o.shippedAt === null, "closing a group marks its orders delivered, with no dates");
  assert((await emailTypes(l.id)) === "", "…and emails no one");
  assert((await orderOf(m.id)).status === "paid" && (await orderOf(k.id)).status === "packed", "…and leaves the other groups alone");

  // ── Other bits ────────────────────────────────────────────────────
  const t = await orderTracking(a);
  assert(t?.number === "A1" && t.carrier === "Royal Mail", "the shipped email sent by hand finds the label's number and carrier");
  assert(!MANUAL_MOVES.delivered!.includes("shipped") && !MANUAL_MOVES.shipped!.includes("packed"), "by hand, orders only move forward");

  console.log("\nAll tracking smoke checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
