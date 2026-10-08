/**
 * Test suite for the daily takings page: the UK-day arithmetic in
 * lib/saleTime.ts and the summing in lib/dailyTakings.ts. Run with
 * `npm run test:takings`. Exits non-zero on any failure, like
 * scripts/test-consent.ts.
 *
 * The server runs in UTC, so "a day" has to be cut at UK midnight, not UTC
 * midnight — otherwise a 00:30 sale in summer lands on the day before.
 */
import { parseDayKey, shiftDayKey, shopDayBounds, shopDayKey } from "@/lib/saleTime";
import { summariseTakings, type TakingsOrder } from "@/lib/dailyTakings";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const iso = (d: Date) => d.toISOString();

// ── Which UK day a moment falls on
check(
  "a winter evening is the same day as in UTC",
  shopDayKey(new Date("2026-01-15T23:30:00Z")) === "2026-01-15"
);
check(
  "a summer sale at 00:30 UK time belongs to the new day",
  shopDayKey(new Date("2026-07-01T23:30:00Z")) === "2026-07-02",
  shopDayKey(new Date("2026-07-01T23:30:00Z"))
);

// ── Where a UK day starts and ends
const winter = shopDayBounds("2026-01-15");
check(
  "a winter day runs midnight to midnight UTC",
  iso(winter.start) === "2026-01-15T00:00:00.000Z" && iso(winter.end) === "2026-01-16T00:00:00.000Z",
  `${iso(winter.start)} → ${iso(winter.end)}`
);
const summer = shopDayBounds("2026-07-02");
check(
  "a summer day starts at 23:00 UTC the evening before",
  iso(summer.start) === "2026-07-01T23:00:00.000Z" && iso(summer.end) === "2026-07-02T23:00:00.000Z",
  `${iso(summer.start)} → ${iso(summer.end)}`
);
const forward = shopDayBounds("2026-03-29");
check(
  "the day the clocks go forward is 23 hours long",
  iso(forward.start) === "2026-03-29T00:00:00.000Z" && iso(forward.end) === "2026-03-29T23:00:00.000Z",
  `${iso(forward.start)} → ${iso(forward.end)}`
);
const back = shopDayBounds("2026-10-25");
check(
  "the day the clocks go back is 25 hours long",
  iso(back.start) === "2026-10-24T23:00:00.000Z" && iso(back.end) === "2026-10-26T00:00:00.000Z",
  `${iso(back.start)} → ${iso(back.end)}`
);
for (const moment of ["2026-07-01T23:00:00Z", "2026-03-29T12:00:00Z", "2026-10-25T23:59:59Z"]) {
  const d = new Date(moment);
  const { start, end } = shopDayBounds(shopDayKey(d));
  check(`${moment} falls inside its own day`, start <= d && d < end);
}

// ── Stepping between days and reading the ?date= parameter
check("stepping back crosses a month", shiftDayKey("2026-03-01", -1) === "2026-02-28");
check("stepping forward crosses a year", shiftDayKey("2026-12-31", 1) === "2027-01-01");
check("a real date is accepted", parseDayKey("2026-10-01") === "2026-10-01");
check("a date that does not exist is rejected", parseDayKey("2026-02-30") === null);
check("junk is rejected", parseDayKey("yesterday") === null && parseDayKey("") === null);
check("a missing parameter is rejected", parseDayKey(undefined) === null);

// ── Adding up a day
const order = (over: Partial<TakingsOrder>): TakingsOrder => ({
  status: "paid",
  amountPaidMinor: null,
  totalAmount: "0",
  deliveryMinor: null,
  deliveryOption: null,
  ...over,
});

const none = summariseTakings([]);
check(
  "a day with no sales is all zeros",
  none.takenMinor === 0 &&
    none.orders === 0 &&
    none.averageMinor === 0 &&
    none.deliveryMinor === 0 &&
    none.goodsMinor === 0 &&
    none.delivery.length === 0
);

const day = summariseTakings([
  order({ amountPaidMinor: 2498, totalAmount: "21.99", deliveryMinor: 299 }),
  order({ status: "shipped", amountPaidMinor: 5999, totalAmount: "59.99", deliveryMinor: 0 }),
  // Paid before amountPaidMinor existed: the goods total is all it recorded.
  order({ status: "delivered", amountPaidMinor: null, totalAmount: "21.99" }),
]);
check("taken is the sum of what each customer was charged", day.takenMinor === 2498 + 5999 + 2199, String(day.takenMinor));
check("every standing order is counted", day.orders === 3);
check("delivery is totalled, missing counted as none", day.deliveryMinor === 299, String(day.deliveryMinor));
check("the average is rounded to a whole penny", day.averageMinor === Math.round((2498 + 5999 + 2199) / 3), String(day.averageMinor));
check(
  "order value is what was charged less delivery",
  day.goodsMinor === 2498 - 299 + 5999 + 2199 && day.goodsMinor + day.deliveryMinor === day.takenMinor,
  String(day.goodsMinor)
);

// ── Delivery, one line per option and price
const mixed = summariseTakings([
  order({ amountPaidMinor: 2589, deliveryMinor: 0, deliveryOption: "next_day" }),
  order({ amountPaidMinor: 2589, deliveryMinor: 390, deliveryOption: "standard" }),
  order({ amountPaidMinor: 2699, deliveryMinor: 500, deliveryOption: "next_day" }),
  order({ amountPaidMinor: 2589, deliveryMinor: 390, deliveryOption: "standard" }),
  order({ amountPaidMinor: 4500, deliveryMinor: 0, deliveryOption: "next_day" }),
  // From before there was a choice.
  order({ amountPaidMinor: 2498, deliveryMinor: 299 }),
  order({ status: "cancelled", amountPaidMinor: 2699, deliveryMinor: 500, deliveryOption: "next_day" }),
]);
const lines = mixed.delivery.map((l) => `${l.option}:${l.priceMinor}:${l.orders}:${l.totalMinor}`).join(" ");
check(
  "delivery is split by option and price, in checkout's order, dearest first, no-option last",
  lines === "standard:390:2:780 next_day:500:1:500 next_day:0:2:0 null:299:1:299",
  lines
);
check(
  "the delivery lines add up to the delivery total",
  mixed.delivery.reduce((sum, l) => sum + l.totalMinor, 0) === mixed.deliveryMinor &&
    mixed.delivery.reduce((sum, l) => sum + l.orders, 0) === mixed.orders
);

const withCancelled = summariseTakings([
  order({ amountPaidMinor: 2498, deliveryMinor: 299 }),
  order({ status: "cancelled", amountPaidMinor: 5999, deliveryMinor: 299 }),
]);
check("a cancelled order is not money taken", withCancelled.takenMinor === 2498 && withCancelled.orders === 1);
check("…nor is its delivery", withCancelled.deliveryMinor === 299);
check("…nor its order value", withCancelled.goodsMinor === 2498 - 299);
check(
  "…it is reported on its own instead",
  withCancelled.cancelledOrders === 1 && withCancelled.cancelledMinor === 5999
);

// ── Monthly plans (lib/plans/kinds.ts)
const box = order({ kind: "plan_box", amountPaidMinor: 0, totalAmount: "0", deliveryMinor: 0, deliveryOption: "standard" });
const withBox = summariseTakings([order({ amountPaidMinor: 2589, totalAmount: "21.99", deliveryMinor: 390, deliveryOption: "standard" }), box]);
check("a plan box is not an order and brings no money", withBox.orders === 1 && withBox.takenMinor === 2589);
check(
  "…nor a delivery line",
  withBox.delivery.map((l) => `${l.option}:${l.priceMinor}:${l.orders}:${l.totalMinor}`).join(" ") === "standard:390:1:390"
);
const purchase = summariseTakings([order({ amountPaidMinor: 26670, totalAmount: "266.70", deliveryMinor: 0, deliveryOption: "standard" })]);
check("a plan's purchase is one sale of the whole plan", purchase.orders === 1 && purchase.takenMinor === 26670 && purchase.goodsMinor === 26670);
const upgraded = summariseTakings([
  order({ amountPaidMinor: 2589, totalAmount: "21.99", deliveryMinor: 390, deliveryOption: "standard" }),
  order({ kind: "plan_upgrade", amountPaidMinor: 10746, totalAmount: "107.46", deliveryMinor: 0 }),
]);
check("an upgrade is money taken but not another order", upgraded.orders === 1 && upgraded.takenMinor === 13335 && upgraded.averageMinor === 13335);
check("…and has no delivery line", upgraded.delivery.length === 1 && upgraded.deliveryMinor === 390);
check("a cancelled plan box is not a cancelled order", summariseTakings([{ ...box, status: "cancelled" }]).cancelledOrders === 0);

if (failures > 0) {
  console.error(`\n${failures} takings check(s) failed.`);
  process.exit(1);
}
console.log("✓ Daily takings rules pass");
