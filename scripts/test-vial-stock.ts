/**
 * Test suite for the vial count on /admin/stock (lib/vial-stock.ts): what an
 * order takes, where the count starts, the low-stock line and the rate. Run
 * with `npm run test:vialstock`. Exits non-zero on any failure, like
 * scripts/test-takings.ts.
 */
import { LOW_STOCK_VIALS, summariseVialStock, vialsOnOrder, type SentOrder } from "@/lib/vial-stock";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const lines = (...qtys: unknown[]) => JSON.stringify(qtys.map((qty) => ({ productId: "p", qty })));
const order = (paidAt: string, ...qtys: number[]): SentOrder => ({ paidAt: new Date(paidAt), items: lines(...qtys) });
const DELIVERIES = [
  { vials: 250, receivedOn: "2026-09-20" },
  { vials: 1000, receivedOn: "2026-10-08" },
];
const NOW = new Date("2026-10-12T12:00:00Z");

// ── What one order takes
check("a pack, loose vials and a welcome vial all count", vialsOnOrder(lines(10, 2, 1)) === 13, String(vialsOnOrder(lines(10, 2, 1))));
check("unreadable items take nothing", vialsOnOrder("not json") === 0);
check("items that are not a list take nothing", vialsOnOrder('{"qty":5}') === 0);
check("odd quantities are ignored", vialsOnOrder(lines("5", -3, 2.5, null, 4)) === 4, String(vialsOnOrder(lines("5", -3, 2.5, null, 4))));

// ── Nothing booked in
const empty = summariseVialStock([], [order("2026-10-01T10:00:00Z", 5)], NOW);
check("no deliveries: no count and no warning", empty.since === null && empty.low === false && empty.sent === 0);

// ── Where the count starts: UK midnight on the earliest delivery's day
const boundary = summariseVialStock(
  DELIVERIES,
  [
    order("2026-09-19T22:59:59Z", 100), // 23:59:59 on 19 Sept, UK summer time
    order("2026-09-19T23:00:00Z", 3), // 00:00 on 20 Sept
    order("2026-10-09T09:00:00Z", 10, 1),
  ],
  NOW
);
check("starts on the earliest delivery", boundary.since === "2026-09-20", String(boundary.since));
check("received adds every delivery", boundary.received === 1250, String(boundary.received));
check("an order paid before UK midnight on the first day is not counted", boundary.sent === 14, String(boundary.sent));
check("left is received less sent", boundary.left === 1236, String(boundary.left));
check("well above the line, no warning", boundary.low === false);

// ── Deliveries booked in any order; corrections take vials off
const corrected = summariseVialStock(
  [{ vials: 1000, receivedOn: "2026-10-08" }, { vials: -12, receivedOn: "2026-10-10" }, { vials: 250, receivedOn: "2026-09-20" }],
  [],
  NOW
);
check("the earliest day wins whatever order rows come in", corrected.since === "2026-09-20", String(corrected.since));
check("a minus row corrects the count", corrected.received === 1238 && corrected.left === 1238, String(corrected.left));

// ── The low-stock line
const at = (sent: number) =>
  summariseVialStock(DELIVERIES, [order("2026-10-01T10:00:00Z", sent)], NOW);
check(`exactly ${LOW_STOCK_VIALS} left warns`, at(1250 - LOW_STOCK_VIALS).low === true);
check(`${LOW_STOCK_VIALS + 1} left does not`, at(1250 - LOW_STOCK_VIALS - 1).low === false);
const over = at(1300);
check("selling past the count goes below zero, and warns", over.left === -50 && over.low === true, String(over.left));

// ── Weeks start on Monday, newest first
const weekly = summariseVialStock(
  DELIVERIES,
  [order("2026-09-20T10:00:00Z", 5), order("2026-09-21T10:00:00Z", 3), order("2026-09-22T10:00:00Z", 2)],
  NOW
);
check(
  "Sunday 20 Sept is in the week of 14 Sept; Monday 21 starts the next",
  JSON.stringify(weekly.byWeek) ===
    JSON.stringify([
      { week: "2026-09-21", orders: 2, vials: 5 },
      { week: "2026-09-14", orders: 1, vials: 5 },
    ]),
  JSON.stringify(weekly.byWeek)
);

// ── The rate and how long it lasts
const rate = summariseVialStock(
  DELIVERIES,
  [order("2026-09-25T10:00:00Z", 500), order("2026-10-01T10:00:00Z", 70), order("2026-10-11T10:00:00Z", 70)],
  NOW
);
check("the rate counts only the last 14 days", rate.perDay === 10, String(rate.perDay));
check("days left is what is left at that rate", rate.daysLeft === 61, `${rate.left} left, ${rate.daysLeft} days`);

const young = summariseVialStock(
  [{ vials: 100, receivedOn: "2026-10-08" }],
  [order("2026-10-09T10:00:00Z", 30)],
  new Date("2026-10-10T23:00:00Z") // UK midnight starting 11 Oct: three days in
);
check("a count younger than 14 days averages over its own days", young.perDay === 10, String(young.perDay));

const firstHour = summariseVialStock(
  [{ vials: 100, receivedOn: "2026-10-12" }],
  [order("2026-10-12T00:30:00Z", 5)],
  new Date("2026-10-12T00:45:00Z")
);
check("the first hours average over a whole day, not a rush", firstHour.perDay === 5, String(firstHour.perDay));

const quiet = summariseVialStock(DELIVERIES, [order("2026-09-21T10:00:00Z", 5)], NOW);
check("nothing sold lately: no days-left guess", quiet.daysLeft === null && quiet.perDay === 0);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("vial stock: all checks passed");
