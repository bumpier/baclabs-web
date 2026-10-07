/**
 * Test suite for reading SmartTrack tracking (lib/shipping/tracking.ts) and
 * the UK wall-clock parsing it relies on (lib/saleTime.ts). Run with
 * `npm run test:tracking`. Exits non-zero on any failure, like
 * scripts/test-takings.ts.
 *
 * The payloads are the samples in SmartTrack's docs (Get Tracking), cut
 * down; the event codes are their "Tracking Events and Codes" table.
 */
import { shopWallClockToDate } from "@/lib/saleTime";
import { classifyTracking, parseTracking, type TrackingEvent } from "@/lib/shipping/tracking";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : String(d));
const NOW = new Date("2026-10-07T12:00:00Z");

function event(code: string, desc: string, when: string) {
  return { event_datetime: when, event_code: code, event_desc: desc, city: "", country: "United Kingdom" };
}

function payload(events: ReturnType<typeof event>[], extra: Record<string, unknown> = {}) {
  return {
    shipment_detail: {
      tracking_number: "JD0002210161163746",
      carrier_name: "Royal Mail",
      status: "Received",
      status_code: "14",
      last_event: events[0] ?? null,
      events,
      ...extra,
    },
    tracking_events: {},
  };
}

const summarise = (data: unknown) => classifyTracking(parseTracking(data, NOW).events);

// ── UK wall clock → moment
check(
  "a winter time is UTC",
  iso(shopWallClockToDate("2026-01-15 09:30:00")) === "2026-01-15T09:30:00.000Z",
  iso(shopWallClockToDate("2026-01-15 09:30:00"))
);
check(
  "a summer time is an hour ahead of UTC",
  iso(shopWallClockToDate("2026-07-01 09:30:00")) === "2026-07-01T08:30:00.000Z",
  iso(shopWallClockToDate("2026-07-01 09:30:00"))
);
check("seconds are optional", iso(shopWallClockToDate("2026-07-01 09:30")) === "2026-07-01T08:30:00.000Z");
check("a T separator is accepted", iso(shopWallClockToDate("2026-01-15T09:30:00")) === "2026-01-15T09:30:00.000Z");
check("31 September is not a date", shopWallClockToDate("2026-09-31 10:00:00") === null);
check("25 o'clock is not a time", shopWallClockToDate("2026-09-30 25:00:00") === null);
check("an empty string is not a time", shopWallClockToDate("") === null);
check("a zoned ISO string is not a wall clock", shopWallClockToDate("2026-09-30T10:00:00Z") === null);

// ── Reading the response
const docs = payload([
  event("146", "Arrived at Sort Facility Hamburg - GBR", "2026-10-06 11:20:21"),
  event("144", "Data Received", "2026-10-05 14:08:52"),
]);
const parsed = parseTracking(docs, NOW);
check("the carrier name is read", parsed.carrierName === "Royal Mail");
check("events come out oldest first", parsed.events.map((e) => e.code).join(",") === "144,146", parsed.events.map((e) => e.code).join(","));
check("event times are UK time", iso(parsed.events[0]?.at) === "2026-10-05T13:08:52.000Z", iso(parsed.events[0]?.at));

const grouped = parseTracking(
  {
    shipment_detail: { carrier_name: "Yodel", events: [] },
    tracking_events: {
      "2026-10-06": [{ date_time: "2026-10-06 11:20:21", status_code_id: "146", carrier_desc: "Arrived", event_content: "Arrived" }],
      "2026-10-05": [{ date_time: "2026-10-05 14:08:52", status_code_id: "144", carrier_desc: "", event_content: "Data Received" }],
    },
  },
  NOW
);
check("with no events list, the date-grouped events are read", grouped.events.map((e) => e.code).join(",") === "144,146");
check("…falling back to event_content for the wording", grouped.events[0]?.description === "Data Received");

const onlyLast = parseTracking({ shipment_detail: { last_event: event("137", "In transit", "2026-10-06 08:00:00") } }, NOW);
check("with nothing else, last_event is read", onlyLast.events.length === 1 && onlyLast.events[0]?.code === "137");

check(
  "a numeric event code is read as text",
  parseTracking(payload([{ ...event("x", "In transit", "2026-10-06 08:00:00"), event_code: 137 as unknown as string }]), NOW).events[0]?.code === "137"
);
check(
  "a scan listed twice is kept once",
  parseTracking(payload([event("146", "Arrived", "2026-10-06 11:20:21"), event("146", "Arrived", "2026-10-06 11:20:21")]), NOW).events.length === 1
);
check(
  "an event dated in the future is dropped",
  parseTracking(payload([event("121", "Delivered", "2026-10-09 10:00:00")]), NOW).events.length === 0
);
check("an event without a readable time is dropped", parseTracking(payload([event("121", "Delivered", "yesterday")]), NOW).events.length === 0);

for (const junk of [null, undefined, "", 42, [], {}, { shipment_detail: "x" }, { shipment_detail: { events: "x" } }]) {
  const p = parseTracking(junk, NOW);
  check(`unreadable data (${JSON.stringify(junk)}) gives no events`, p.events.length === 0 && p.carrierName === "");
}

// ── Deciding
const ev = (code: string, description: string, at: string): TrackingEvent => ({ code, description, at: new Date(at) });

let s = classifyTracking([]);
check("no events: waiting for the carrier", s.stage === "awaiting" && s.shippedAt === null && s.latest === null);

s = classifyTracking([ev("144", "Data Received", "2026-10-05T13:00:00Z")]);
check("only Data Received (the label being made) is not shipped", s.stage === "awaiting" && s.shippedAt === null);
check("…and the latest event is still reported", s.latest?.code === "144");

s = classifyTracking([ev("144", "Data Received", "2026-10-05T13:00:00Z"), ev("170", "Ready To Dispatch", "2026-10-05T15:00:00Z")]);
check("Ready To Dispatch is not shipped", s.stage === "awaiting");

s = classifyTracking([ev("999", "Something new", "2026-10-05T13:00:00Z")]);
check("an unknown code with no clear wording is not shipped", s.stage === "awaiting");
check("…and is reported as unknown", s.unknownCodes.join() === "999");

s = summarise(docs);
check("Arrived after Data Received is with the carrier", s.stage === "in_transit");
check("…shipped at the first carrier scan", iso(s.shippedAt) === "2026-10-06T10:20:21.000Z", iso(s.shippedAt));
check("…not delivered", s.deliveredAt === null);
check("…and every code is known", s.unknownCodes.length === 0);

for (const [code, name] of [["133", "Picked Up"], ["140", "Collected"], ["148", "Carrier Received"], ["126", "Dispatched"], ["111", "Out for delivery"]] as const) {
  check(`${name} (${code}) counts as shipped`, classifyTracking([ev(code, name, "2026-10-06T08:00:00Z")]).stage === "in_transit");
}

s = classifyTracking([
  ev("144", "Data Received", "2026-10-05T13:00:00Z"),
  ev("133", "Picked Up", "2026-10-05T17:00:00Z"),
  ev("111", "Out for delivery", "2026-10-06T07:00:00Z"),
  ev("121", "Delivered", "2026-10-06T11:42:00Z"),
]);
check("121 is delivered", s.stage === "delivered");
check("…at the delivery scan", iso(s.deliveredAt) === "2026-10-06T11:42:00.000Z");
check("…shipped at the pick-up", iso(s.shippedAt) === "2026-10-05T17:00:00.000Z");

s = classifyTracking([ev("159", "Drop Off: Delivered", "2026-10-06T11:42:00Z")]);
check("159 (Drop Off: Delivered) is delivered", s.stage === "delivered");
check("…and a parcel delivered with no earlier scan shipped then too", iso(s.shippedAt) === "2026-10-06T11:42:00.000Z");

s = classifyTracking([ev("133", "Picked Up", "2026-10-05T17:00:00Z"), ev("112", "Address Problem", "2026-10-06T09:00:00Z")]);
check("a problem as the latest event is a delivery problem", s.stage === "problem");
check("…and the parcel did ship", iso(s.shippedAt) === "2026-10-05T17:00:00.000Z");

s = classifyTracking([ev("112", "Address Problem", "2026-10-06T09:00:00Z"), ev("146", "Arrived", "2026-10-06T15:00:00Z")]);
check("a problem followed by a normal scan is back in transit", s.stage === "in_transit");

s = classifyTracking([ev("138", "Returned", "2026-10-06T09:00:00Z")]);
check("Returned is a problem, not shipped-and-fine", s.stage === "problem");

// The carrier's own wording, when SmartTrack could not map it.
check("an unmapped 'Delivered to safe place' is delivered", classifyTracking([ev("158", "Delivered to safe place", "2026-10-06T11:00:00Z")]).stage === "delivered");
check("an unmapped 'Item delivered' is delivered", classifyTracking([ev("160", "Item delivered", "2026-10-06T11:00:00Z")]).stage === "delivered");
for (const text of [
  "Not delivered - nobody home",
  "Delivery attempted",
  "Your item will be delivered today",
  "Out for delivery",
  "Undelivered",
  "Expected to be delivered tomorrow",
]) {
  check(`an unmapped '${text}' is not delivered`, classifyTracking([ev("158", text, "2026-10-06T11:00:00Z")]).stage !== "delivered");
}
check(
  "an unmapped 'Item collected by Royal Mail' is with the carrier",
  classifyTracking([ev("158", "Item collected by Royal Mail", "2026-10-06T11:00:00Z")]).stage === "in_transit"
);
check(
  "an unmapped 'We've received electronic information about your item' is not shipped",
  classifyTracking([ev("158", "We've received electronic information about your item", "2026-10-06T11:00:00Z")]).stage === "awaiting"
);
check(
  "a KNOWN pre-carrier code is never read for words",
  classifyTracking([ev("144", "Data Received - delivered to carrier system", "2026-10-06T11:00:00Z")]).stage === "awaiting"
);

if (failures > 0) {
  console.error(`\n${failures} tracking check(s) failed.`);
  process.exit(1);
}
console.log("All tracking checks passed.");
