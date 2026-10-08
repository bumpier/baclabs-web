/**
 * Test suite for /admin/finance: rates by date, what each order costs to
 * send, grouping by day/week/month, and the date ranges. Run with
 * `npm run test:finance`. Exits non-zero on any failure, like
 * scripts/test-takings.ts. No database: lib/finance/ledger.ts is pure.
 */
import {
  bucket,
  customerMix,
  deliveryMix,
  firstOrders,
  ledgerRow,
  packMix,
  summarise,
  warnings,
  type LedgerContext,
  type LedgerOrder,
  type LedgerShipment,
} from "@/lib/finance/ledger";
import { granularityFor, presetRange, previousRange, resolveRange } from "@/lib/finance/range";
import { DEFAULT_FULFILMENT_MINOR, parsePounds, rateOn, vatInside, type Rate } from "@/lib/finance/rates";
import { dayKeysBetween, daysInRange, formatMonth, monthKey, shopRangeBounds, weekKey } from "@/lib/saleTime";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

// ── Rates by date
const rates: Rate[] = [
  { kind: "fulfilment", key: "", amountMinor: 100, effectiveFrom: "1970-01-01" },
  { kind: "fulfilment", key: "", amountMinor: 120, effectiveFrom: "2026-10-05" },
  { kind: "postage", key: "RM48", amountMinor: 310, effectiveFrom: "2026-09-01" },
  { kind: "postage", key: "RM48", amountMinor: 330, effectiveFrom: "2026-10-05" },
  { kind: "postage", key: "AMZND", amountMinor: 420, effectiveFrom: "1970-01-01" },
];
check("a rate applies from its own day", rateOn(rates, "postage", "RM48", "2026-10-05") === 330);
check("…and not the day before", rateOn(rates, "postage", "RM48", "2026-10-04") === 310);
check("before any rate there is no price", rateOn(rates, "postage", "RM48", "2026-08-31") === null);
check("an unknown service has no price", rateOn(rates, "postage", "NOPE", "2026-10-05") === null);
check("rates of another kind are ignored", rateOn(rates, "fulfilment", "RM48", "2026-10-05") === null);

check("VAT inside £24 is £4", vatInside(2400) === 400);
check("VAT inside £3.90 rounds to 65p", vatInside(390) === 65);
check(
  "prices are read from what an admin types",
  parsePounds("£1.20") === 120 && parsePounds("3.9") === 390 && parsePounds("1") === 100
);
check(
  "non-prices are refused",
  parsePounds("") === null && parsePounds("-1") === null && parsePounds("1.234") === null && parsePounds("abc") === null
);

// ── One order
const at = (iso: string) => new Date(iso);
const label = (over: Partial<LedgerShipment> = {}): LedgerShipment => ({
  status: "CREATED",
  environment: "live",
  serviceCode: "RM48",
  createdAt: at("2026-10-06T09:00:00Z"),
  ...over,
});
const order = (over: Partial<LedgerOrder> = {}): LedgerOrder => ({
  id: "o1",
  status: "paid",
  customerName: "A",
  customerEmail: "a@example.com",
  items: JSON.stringify([{ qty: 5, bundleId: "five", bundleName: "5-vial pack", bundleQty: 1 }]),
  amountPaidMinor: 2589,
  totalAmount: "21.99",
  deliveryMinor: 390,
  deliveryOption: "standard",
  paidAt: at("2026-10-06T08:55:00Z"),
  createdAt: at("2026-10-06T08:50:00Z"),
  shipments: [label()],
  ...over,
});
const ctx = (over: Partial<LedgerContext> = {}): LedgerContext => ({
  rates,
  vatFrom: null,
  firstOrderByEmail: new Map([["a@example.com", "o1"]]),
  ...over,
});

const plain = ledgerRow(order(), ctx());
check("the sale day is the UK day of payment", plain.day === "2026-10-06");
check("goods are what was charged less delivery", plain.goodsMinor === 2199 && plain.deliveryMinor === 390);
check("a live label is priced on the day it was bought", plain.postageMinor === 330 && plain.postageStatus === "label");
check("one label is one package at the day's fulfilment rate", plain.packages === 1 && plain.fulfilmentMinor === 120);
check(
  "after costs is takings less postage and fulfilment",
  plain.afterCostsMinor === 2589 - 330 - 120,
  String(plain.afterCostsMinor)
);
check("no discount when charged in full", plain.discountMinor === 0);
check("vials and the pack are read from the items", plain.vials === 5 && plain.welcomeVials === 0 && plain.pack === "five");
check("the customer's first order is new", plain.customer === "new");

check(
  "a label bought before a price change keeps the old price",
  ledgerRow(order({ shipments: [label({ createdAt: at("2026-10-04T09:00:00Z") })] }), ctx()).postageMinor === 310
);

const uat = ledgerRow(order({ shipments: [label({ environment: "uat" })] }), ctx());
check("a UAT label costs nothing and leaves postage unknown", uat.postageMinor === 0 && uat.postageStatus === "no_label");
const voided = ledgerRow(order({ shipments: [label({ status: "VOIDED" }), label({ serviceCode: "AMZND" })] }), ctx());
check("a voided label costs nothing; its replacement does", voided.postageMinor === 420 && voided.packages === 1);
const pending = ledgerRow(order({ id: "p1", shipments: [label({ status: "PENDING" })] }), ctx());
check("a pending label leaves postage unknown", pending.postageStatus === "pending" && pending.postageMinor === 0);
const unpriced = ledgerRow(order({ id: "u1", shipments: [label({ serviceCode: "NEW1" })] }), ctx());
check(
  "a service with no price is flagged",
  unpriced.postageStatus === "no_rate" && unpriced.unpricedServices[0] === "NEW1"
);
const twoLabels = ledgerRow(order({ shipments: [label(), label({ serviceCode: "AMZND" })] }), ctx());
check(
  "two live labels are two packages",
  twoLabels.packages === 2 && twoLabels.postageMinor === 750 && twoLabels.fulfilmentMinor === 240
);
const noLabel = ledgerRow(order({ id: "n1", status: "shipped", shipments: [] }), ctx());
check("an order sent without a label is still one package", noLabel.packages === 1 && noLabel.postageStatus === "no_label");
check(
  "fulfilment falls back to £1 with no rate typed in",
  ledgerRow(order(), ctx({ rates: [] })).fulfilmentMinor === DEFAULT_FULFILMENT_MINOR
);

const discounted = ledgerRow(order({ amountPaidMinor: 2589 - 440 }), ctx());
check("a promotion code shows as a discount", discounted.discountMinor === 440);
const legacy = ledgerRow(order({ amountPaidMinor: null, deliveryMinor: null, shipments: [] }), ctx());
check(
  "an order from before amounts were recorded has no known discount",
  legacy.discountMinor === null && legacy.takenMinor === 2199
);
const odd = ledgerRow(order({ amountPaidMinor: 9999 }), ctx());
check("charged more than goods and delivery is flagged, not a negative discount", odd.discountOdd && odd.discountMinor === 0);

const welcome = ledgerRow(
  order({
    items: JSON.stringify([
      { qty: 10, bundleId: "ten" },
      { qty: 3, welcome: true },
    ]),
  }),
  ctx()
);
check(
  "welcome vials count as vials and separately",
  welcome.vials === 13 && welcome.welcomeVials === 3 && welcome.pack === "ten"
);
const retired = ledgerRow(order({ items: JSON.stringify([{ qty: 7, bundleId: "seven", bundleName: "7-vial pack" }]) }), ctx());
check("a retired pack keeps its id", retired.pack === "seven");
const broken = ledgerRow(order({ id: "x1", items: "not json" }), ctx());
check("unreadable items are flagged, not thrown", broken.itemsUnreadable && broken.vials === 0 && broken.pack === "loose");

const vatDay = ledgerRow(order(), ctx({ vatFrom: "2026-10-06" }));
check(
  "VAT applies from the registration day",
  vatDay.vatMinor === vatInside(2199) + vatInside(390),
  String(vatDay.vatMinor)
);
check("…and comes off after costs", vatDay.afterCostsMinor === 2589 - vatDay.vatMinor - 330 - 120);
check("VAT does not apply the day before registration", ledgerRow(order(), ctx({ vatFrom: "2026-10-07" })).vatMinor === 0);

const cancelled = ledgerRow(order({ id: "c9", status: "cancelled" }), ctx());
check("a cancelled order pays no fulfilment", cancelled.packages === 0 && cancelled.fulfilmentMinor === 0);
check("…but a live label on it was still paid for", cancelled.postageMinor === 330 && cancelled.afterCostsMinor === -330);

// ── New and returning customers
const firsts = firstOrders([
  { id: "b2", customerEmail: "B@Example.com", paidAt: at("2026-10-02T10:00:00Z"), createdAt: at("2026-10-02T10:00:00Z") },
  { id: "b1", customerEmail: "b@example.com ", paidAt: at("2026-09-01T10:00:00Z"), createdAt: at("2026-09-01T10:00:00Z") },
  { id: "c1", customerEmail: "", paidAt: null, createdAt: at("2026-09-01T10:00:00Z") },
]);
check("emails are matched without case or spaces", firsts.get("b@example.com") === "b1" && firsts.size === 1);
check(
  "a repeat order is returning",
  ledgerRow(order({ id: "b2", customerEmail: "B@Example.com" }), ctx({ firstOrderByEmail: firsts })).customer === "returning"
);
check("an order with no email is unknown", ledgerRow(order({ customerEmail: "" }), ctx()).customer === "unknown");

// ── Adding up
const rows = [
  plain,
  ledgerRow(
    order({
      id: "o2",
      amountPaidMinor: 2199,
      deliveryMinor: 0,
      deliveryOption: "next_day",
      shipments: [label({ serviceCode: "AMZND" })],
    }),
    ctx()
  ),
  ledgerRow(order({ id: "o3", shipments: [] }), ctx()),
  cancelled,
];
const totals = summarise(rows);
check("cancelled orders are not counted as sales", totals.orders === 3 && totals.cancelledOrders === 1);
check("taken adds up", totals.takenMinor === 2589 + 2199 + 2589, String(totals.takenMinor));
check("goods plus delivery is taken", totals.goodsMinor + totals.deliveryMinor === totals.takenMinor);
check("postage counts sold orders only", totals.postageMinor === 330 + 420);
check("a cancelled order's label is its own line", totals.cancelledLabelMinor === 330);
check(
  "after costs takes everything off, the cancelled label too",
  totals.afterCostsMinor ===
    totals.takenMinor - totals.postageMinor - totals.fulfilmentMinor - totals.cancelledLabelMinor,
  String(totals.afterCostsMinor)
);
const customers = customerMix(rows).map((l) => `${l.kind}:${l.orders}`).join(" ");
check("returning customers are told apart", customers === "new:1 returning:2", customers);

const mix = deliveryMix(rows)
  .map((l) => `${l.option}:${l.priceMinor}:${l.orders}:${l.postageMinor}:${l.marginMinor}:${l.postageUnknown}`)
  .join(" ");
check(
  "delivery mix shows postage against each option",
  mix === "standard:390:2:330:450:1 next_day:0:1:420:-420:0",
  mix
);
const packs = packMix([welcome, plain, retired]).map((l) => l.pack).join(" ");
check("pack mix in the shop's order", packs === "five ten seven", packs);

const w = warnings([...rows, noLabel, pending, unpriced, broken]);
check("an unlabelled paid order awaits a label", w.awaitingLabel.some((r) => r.id === "o3"));
check("an order sent without a label is its own warning", w.sentWithoutLabel.length === 1);
check("a pending label is warned", w.pendingLabel.length === 1);
check("an unpriced service is warned", w.unpriced[0]?.serviceCode === "NEW1");
check("a cancelled order with a label is warned", w.cancelledWithLabel.length === 1);
check("unreadable items are warned", w.unreadableItems.length === 1);

// ── Monthly plans (lib/plans/kinds.ts)
const planBox = ledgerRow(
  order({
    id: "pb1", kind: "plan_box", amountPaidMinor: 0, totalAmount: "0", deliveryMinor: 0, deliveryOption: "standard",
    items: JSON.stringify([{ qty: 5, bundleId: "five", bundleName: "5-vial pack, plan box 2 of 6", bundleQty: 1, lineTotal: "0.00" }]),
  }),
  ctx()
);
check("a plan box brings no money", planBox.takenMinor === 0 && planBox.goodsMinor === 0 && planBox.kind === "plan_box");
check("…but its postage and fulfilment are counted", planBox.postageMinor === 330 && planBox.packages === 1 && planBox.fulfilmentMinor === 120);
check("…as a cost after shipping", planBox.afterCostsMinor === -450, String(planBox.afterCostsMinor));
check("…and its vials went out", planBox.vials === 5);
check("…and it is nobody's new or returning order", planBox.customer === "unknown");
const boxDay = ledgerRow(
  order({ id: "pb2", kind: "plan_box", amountPaidMinor: 0, totalAmount: "0", deliveryMinor: 0, paidAt: at("2026-11-08T07:00:00Z"), createdAt: at("2026-11-08T07:00:00Z"), shipments: [label({ createdAt: at("2026-11-08T07:01:00Z") })] }),
  ctx()
);
check("a plan box's costs land on its own ship day", boxDay.day === "2026-11-08" && boxDay.postageMinor === 330);
const upgradeRow = ledgerRow(
  order({ id: "up1", kind: "plan_upgrade", amountPaidMinor: 10746, totalAmount: "107.46", deliveryMinor: 0, deliveryOption: null, items: "[]", shipments: [] }),
  ctx()
);
check("an upgrade is money with nothing to send", upgradeRow.takenMinor === 10746 && upgradeRow.packages === 0 && upgradeRow.fulfilmentMinor === 0 && upgradeRow.afterCostsMinor === 10746);
const planRows = [plain, planBox, upgradeRow];
const planTotals = summarise(planRows);
check("only sales count as orders", planTotals.orders === 1);
check("taken includes the upgrade, not the box", planTotals.takenMinor === 2589 + 10746);
check("the average is over sales", planTotals.averageMinor === 13335);
check("postage and packages include the box", planTotals.postageMinor === 660 && planTotals.packages === 2 && planTotals.fulfilmentMinor === 240);
check("after costs adds up", planTotals.afterCostsMinor === 2139 - 450 + 10746, String(planTotals.afterCostsMinor));
check("pack mix counts sales only", packMix(planRows).map((l) => `${l.pack}:${l.orders}`).join(" ") === "five:1");
check("new and returning counts sales only", customerMix(planRows).map((l) => `${l.kind}:${l.orders}`).join(" ") === "new:1");
check(
  "the delivery mix counts sales only",
  deliveryMix(planRows).map((l) => `${l.option}:${l.priceMinor}:${l.orders}`).join(" ") === "standard:390:1"
);
const planWarnings = warnings([upgradeRow]);
check("an upgrade never awaits a label", planWarnings.awaitingLabel.length === 0 && planWarnings.sentWithoutLabel.length === 0);

// ── Weeks, months and ranges
check("a week starts on Monday", weekKey("2026-10-07") === "2026-10-05" && weekKey("2026-10-05") === "2026-10-05");
check("Sunday belongs to the week before", weekKey("2026-10-11") === "2026-10-05");
check("the clocks-forward Sunday is in its week", weekKey("2026-03-29") === "2026-03-23");
check("the clocks-back Sunday is in its week", weekKey("2026-10-25") === "2026-10-19");
check("a week can start in the old year", weekKey("2027-01-01") === "2026-12-28");
check("a month is its first seven characters", monthKey("2026-10-25") === "2026-10");
check(
  "a range counts both ends",
  daysInRange("2026-10-01", "2026-10-31") === 31 && daysInRange("2026-10-07", "2026-10-07") === 1
);
check(
  "days across the clock change are each listed once",
  dayKeysBetween("2026-10-24", "2026-10-26").join(" ") === "2026-10-24 2026-10-25 2026-10-26"
);
const oct = shopRangeBounds("2026-10-01", "2026-10-31");
check(
  "a range runs from UK midnight to UK midnight",
  oct.start.toISOString() === "2026-09-30T23:00:00.000Z" && oct.end.toISOString() === "2026-11-01T00:00:00.000Z",
  `${oct.start.toISOString()} → ${oct.end.toISOString()}`
);

const weeks = bucket(rows, "2026-10-01", "2026-10-14", "week");
const weekSpans = weeks.map((b) => `${b.key}:${b.from}:${b.to}`).join(" ");
check(
  "weekly buckets are clipped to the range and keep empty weeks",
  weekSpans === "2026-09-28:2026-10-01:2026-10-04 2026-10-05:2026-10-05:2026-10-11 2026-10-12:2026-10-12:2026-10-14",
  weekSpans
);
check("an order lands in its week", weeks[1]!.totals.orders === 3 && weeks[0]!.totals.orders === 0);
check("week labels read w/c", weeks[1]!.label === "w/c 5 Oct", weeks[1]!.label);
const days = bucket(rows, "2026-10-05", "2026-10-07", "day");
check("daily buckets include days with no sales", days.length === 3 && days[1]!.totals.orders === 3);
const months = bucket([], "2026-09-15", "2026-10-02", "month").map((b) => b.label);
check(
  "months are labelled by name",
  months.length === 2 && months[0] === formatMonth("2026-09") && months[1] === formatMonth("2026-10"),
  months.join(" ")
);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
check("last 7 days ends today", same(presetRange("7d", "2026-10-07"), { from: "2026-10-01", to: "2026-10-07" }));
check("this month on the 1st is one day", same(presetRange("this-month", "2026-10-01"), { from: "2026-10-01", to: "2026-10-01" }));
check("last month in January is December", same(presetRange("last-month", "2027-01-15"), { from: "2026-12-01", to: "2026-12-31" }));
check("this year starts on 1 January", presetRange("this-year", "2026-10-07").from === "2026-01-01");
check(
  "the previous period is the same length, just before",
  same(previousRange({ from: "2026-10-01", to: "2026-10-07" }), { from: "2026-09-24", to: "2026-09-30" })
);

const today = "2026-10-07";
const byDefault = resolveRange({}, today);
check("no parameters means the last 30 days", byDefault.from === "2026-09-08" && byDefault.preset === "30d");
check("a junk preset falls back to the default", resolveRange({ range: "forever" }, today).preset === "30d");
const swapped = resolveRange({ from: "2026-10-05", to: "2026-10-01" }, today);
check(
  "dates the wrong way round are swapped",
  swapped.from === "2026-10-01" && swapped.to === "2026-10-05" && swapped.preset === null
);
check("a future end becomes today", resolveRange({ from: "2026-10-01", to: "2027-01-01" }, today).to === today);
check("a range matching a preset is recognised", resolveRange({ from: "2026-10-01", to: today }, today).preset === "7d");
check(
  "a range is capped at two years",
  daysInRange(resolveRange({ from: "2020-01-01", to: today }, today).from, today) === 731
);
check(
  "granularity: days, then weeks, then months",
  granularityFor(31) === "day" && granularityFor(90) === "week" && granularityFor(365) === "month"
);

if (failures > 0) {
  console.error(`\n${failures} finance check(s) failed.`);
  process.exit(1);
}
console.log("✓ Finance rules pass");
