/**
 * Test suite for putting right orders wrongly marked delivered
 * (lib/shipping/delivered-recheck.ts) and for reading Amazon's own tracker
 * (lib/shipping/amazon-tracking.ts). Run with `npm run test:recheck`.
 * Exits non-zero on any failure, like scripts/test-tracking.ts.
 *
 * The Amazon payloads are made up in the shape of the real "not found"
 * reply (progressTracker and eventHistory as JSON strings); its event
 * shape is unconfirmed, which is why unreadable replies must come out null.
 */
import { amazonStageOfCode, parseAmazonTracking } from "@/lib/shipping/amazon-tracking";
import { carrierGroup, combineTracking, correctionFor } from "@/lib/shipping/delivered-recheck";
import type { TrackingSummary } from "@/lib/shipping/tracking";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : String(d));
const NOW = new Date("2026-10-09T12:00:00Z");
const at = (s: string) => new Date(s);

function amazonReply(status: string | null, events: { eventCode: string; eventTime: string }[] | null, errors: unknown[] = []) {
  return {
    shipmentProfileType: null,
    progressTracker: JSON.stringify({ errors, summary: { status, metadata: {} }, trackerSource: "AMZL" }),
    eventHistory: events ? JSON.stringify({ eventHistory: events.map((e) => ({ ...e, statusSummary: {} })) }) : null,
  };
}

function summary(stage: TrackingSummary["stage"], shippedAt: string | null = null, deliveredAt: string | null = null): TrackingSummary {
  return {
    stage,
    shippedAt: shippedAt ? at(shippedAt) : null,
    deliveredAt: deliveredAt ? at(deliveredAt) : null,
    latest: null,
    unknownCodes: [],
  };
}

// ── Amazon's tracker ────────────────────────────────────────────────

{
  const notFound = amazonReply(null, null, [{ errorCode: "TRACKING_ID_NOT_FOUND", errorMessage: "INVALID TRACKING_ID" }]);
  check("an unknown number is no answer, not 'not shipped'", parseAmazonTracking(notFound, NOW) === null);
  check("garbage is no answer", parseAmazonTracking("<html>", NOW) === null && parseAmazonTracking({}, NOW) === null);
  check("an unparseable progressTracker string is no answer", parseAmazonTracking({ progressTracker: "{oops" }, NOW) === null);
}

{
  const r = parseAmazonTracking(
    amazonReply("DELIVERED", [
      { eventCode: "CreationConfirmed", eventTime: "2026-10-01T16:00:00Z" },
      { eventCode: "PickupDone", eventTime: "2026-10-01T18:30:00Z" },
      { eventCode: "OutForDelivery", eventTime: "2026-10-02T07:10:00Z" },
      { eventCode: "Delivered", eventTime: "2026-10-02T11:42:00Z" },
    ]),
    NOW
  );
  check("a delivered parcel reads delivered", r?.summary.stage === "delivered", r?.summary.stage);
  check("delivered at the delivery scan", iso(r?.summary.deliveredAt) === "2026-10-02T11:42:00.000Z", iso(r?.summary.deliveredAt));
  check("shipped at the pickup, not label creation", iso(r?.summary.shippedAt) === "2026-10-01T18:30:00.000Z", iso(r?.summary.shippedAt));
  check("no unknown codes", r?.summary.unknownCodes.length === 0, r?.summary.unknownCodes.join());
}

{
  const r = parseAmazonTracking(amazonReply("ReadyForReceive", [{ eventCode: "CreationConfirmed", eventTime: "2026-10-05T15:00:00Z" }]), NOW);
  check("a label Amazon has not collected reads awaiting", r?.summary.stage === "awaiting", r?.summary.stage);
  check("…with no shipped date", r?.summary.shippedAt === null);
}

{
  const r = parseAmazonTracking(amazonReply("IN_TRANSIT", null), NOW);
  check("the one-word status alone still counts", r?.summary.stage === "in_transit", r?.summary.stage);
  const d = parseAmazonTracking(amazonReply("Delivered", null), NOW);
  check("'Delivered' alone reads delivered (no date)", d?.summary.stage === "delivered" && d.summary.deliveredAt === null);
}

{
  const r = parseAmazonTracking(
    amazonReply("DeliveryAttempted", [
      { eventCode: "PickupDone", eventTime: "2026-10-03T18:00:00Z" },
      { eventCode: "DeliveryAttempted", eventTime: "2026-10-04T10:00:00Z" },
    ]),
    NOW
  );
  check("a failed attempt is with the carrier, not delivered", r?.summary.stage === "in_transit", r?.summary.stage);
  const lost = parseAmazonTracking(amazonReply("Lost", [{ eventCode: "PickupDone", eventTime: "2026-10-03T18:00:00Z" }]), NOW);
  check("lost is a problem", lost?.summary.stage === "problem", lost?.summary.stage);
}

{
  const r = parseAmazonTracking(amazonReply("SomethingNew", [{ eventCode: "Teleported", eventTime: "2026-10-03T18:00:00Z" }]), NOW);
  check("unknown codes never count as a scan", r?.summary.stage === "awaiting", r?.summary.stage);
  check("…and are reported", !!r?.summary.unknownCodes.includes("Teleported") && !!r?.summary.unknownCodes.includes("SomethingNew"), r?.summary.unknownCodes.join());
}

{
  const r = parseAmazonTracking(amazonReply(null, [{ eventCode: "Delivered", eventTime: "2026-10-12T09:00:00Z" }]), NOW);
  check("a delivery dated days ahead of now is not believed", r === null || r.summary.stage !== "delivered", r?.summary.stage);
}

check("DeliveryAttempted is not 'delivered'", amazonStageOfCode("DeliveryAttempted") === "in_transit");
check("Undeliverable is not 'delivered'", amazonStageOfCode("UNDELIVERABLE") === "problem");
check("ReadyForPickup (at our door) is awaiting", amazonStageOfCode("ReadyForPickup") === "awaiting");
check("AvailableForPickup (at a pickup point) is with the carrier", amazonStageOfCode("AvailableForPickup") === "in_transit");

// ── Combining SmartTrack and Amazon ─────────────────────────────────

check("no answers combine to no answer", combineTracking(null, null) === null);
{
  const c = combineTracking(summary("awaiting"), summary("in_transit", "2026-10-02T09:00:00Z"));
  check("a scan Amazon saw and SmartTrack missed counts", c?.stage === "in_transit", c?.stage);
  check("…with its date", iso(c?.shippedAt) === "2026-10-02T09:00:00.000Z", iso(c?.shippedAt));
}
{
  const c = combineTracking(summary("delivered", "2026-10-02T09:00:00Z", "2026-10-03T12:00:00Z"), summary("in_transit", "2026-10-01T18:00:00Z"));
  check("delivered beats in transit", c?.stage === "delivered");
  check("shipped is the earliest scan either saw", iso(c?.shippedAt) === "2026-10-01T18:00:00.000Z", iso(c?.shippedAt));
  check("delivered date from the source that saw delivery", iso(c?.deliveredAt) === "2026-10-03T12:00:00.000Z", iso(c?.deliveredAt));
}
check("one answer alone stands", combineTracking(summary("awaiting"), null)?.stage === "awaiting");

// ── What each wrongly delivered order becomes ───────────────────────

{
  const catchUp = { shippedAt: null, deliveredAt: null };
  const byHand = { shippedAt: at("2026-10-02T10:00:00Z"), deliveredAt: at("2026-10-06T15:00:00Z") };

  const none = correctionFor(catchUp, null);
  check("no answer changes nothing", none.action === "unchecked" && none.data === null);

  const label = correctionFor(catchUp, summary("awaiting"));
  check("never scanned goes back to label created", label.action === "packed" && label.data?.status === "packed");
  check("…with no dates", label.data?.shippedAt === null && label.data?.deliveredAt === null);
  const labelByHand = correctionFor(byHand, summary("awaiting"));
  check("a hand-made date is cleared too", labelByHand.data?.shippedAt === null && labelByHand.data?.deliveredAt === null);

  const moving = correctionFor(catchUp, summary("in_transit", "2026-10-03T08:00:00Z"));
  check("scanned but not delivered becomes shipped", moving.action === "shipped" && moving.data?.status === "shipped");
  check("…shipped at the scan, not delivered", iso(moving.data?.shippedAt) === "2026-10-03T08:00:00.000Z" && moving.data?.deliveredAt === null);
  check("a problem parcel is shipped too", correctionFor(catchUp, summary("problem", "2026-10-03T08:00:00Z")).data?.status === "shipped");

  const done = correctionFor(catchUp, summary("delivered", "2026-10-02T09:00:00Z", "2026-10-03T12:00:00Z"));
  check("really delivered stays delivered", done.action === "confirmed" && done.data?.status === "delivered");
  check("…and gains the real dates", iso(done.data?.deliveredAt) === "2026-10-03T12:00:00.000Z" && iso(done.data?.shippedAt) === "2026-10-02T09:00:00.000Z");
  const doneByHand = correctionFor(byHand, summary("delivered", "2026-10-02T09:00:00Z", "2026-10-03T12:00:00Z"));
  check("the scan's delivery date replaces the click's", iso(doneByHand.data?.deliveredAt) === "2026-10-03T12:00:00.000Z");
  check("a known shipped date is kept", iso(doneByHand.data?.shippedAt) === "2026-10-02T10:00:00.000Z");
  const undated = correctionFor(byHand, summary("delivered"));
  check("delivered with no scan date keeps the order's date", iso(undated.data?.deliveredAt) === "2026-10-06T15:00:00.000Z");
}

// ── Which carrier ───────────────────────────────────────────────────

check("SmartTrack's Amazon name", carrierGroup("NW Amazon", "", "") === "amazon");
check("SmartTrack's Royal Mail name", carrierGroup("Royal Mail Nenix") === "royalmail");
check("falls back to the service", carrierGroup("", "Royal Mail Tracked 48") === "royalmail");
check("anything else", carrierGroup("", null, undefined) === "other");

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("All recheck-delivered checks passed.");
