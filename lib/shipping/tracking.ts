import { shopWallClockToDate } from "@/lib/saleTime";

/**
 * Reading SmartTrack tracking (get-tracking/{number}) and deciding where a
 * parcel has got to. Pure: no database, no network — the sync that acts on
 * it is lib/shipping/tracking-sync.ts.
 *
 * SmartTrack maps every carrier's scans onto its own event codes (docs:
 * "Tracking Events and Codes"). Only codes that mean the carrier physically
 * has the parcel move an order to shipped — an allow-list, so the event
 * SmartTrack logs when the label is made ("144 Data Received") or a code we
 * have never seen can never send the customer an "on its way" email for a
 * parcel still on the shelf. Unknown codes are reported back so they can be
 * added here once seen.
 *
 * Codes SmartTrack could not map (158/160, "Not mapped") and unknown ones
 * carry the carrier's own wording, so those alone are also read for a plain
 * "delivered" or a clear carrier scan.
 */

export type TrackingStage = "awaiting" | "in_transit" | "delivered" | "problem";

export interface TrackingEvent {
  code: string;
  description: string;
  at: Date;
}

export interface ParsedTracking {
  carrierName: string;
  /** Oldest first. */
  events: TrackingEvent[];
}

export interface TrackingSummary {
  stage: TrackingStage;
  /** The first time the carrier had the parcel. */
  shippedAt: Date | null;
  /** The delivery scan. */
  deliveredAt: Date | null;
  latest: TrackingEvent | null;
  /** Codes in this tracking that none of the lists below know. */
  unknownCodes: string[];
}

export const DELIVERED_CODES = new Set(["121", "159"]); // Delivered, Drop Off: Delivered

/** The carrier has the parcel and nothing is wrong. */
export const CARRIER_CODES = new Set([
  "111", // Out for delivery
  "116", // Consignee Unavailable
  "117", // Customs Clearance
  "120", // Delayed
  "123", // Delivery Attempt
  "126", // Dispatched
  "133", // Picked Up
  "134", // Partially Collected
  "137", // In Transit
  "140", // Collected
  "141", // Dimensions Check
  "145", // Departed
  "146", // Arrived
  "147", // Partial Delivery
  "148", // Carrier Received
  "149", // Arrived at destination
  "151", // Offload
  "154", // Carded
  "156", // Forwarded
  "161", // Processed: Not mapped
]);

/** The carrier has (or had) the parcel, and something has gone wrong. */
export const PROBLEM_CODES = new Set([
  "112", // Address Problem
  "115", // Problem
  "118", // Damaged Parcel
  "119", // Damaged
  "125", // Undelivered
  "127", // Failure
  "138", // Returned
  "150", // Misroute
  "152", // Destroyed
  "153", // Seize
  "157", // Lost
  "163", // Ready To Return
  "164", // Returning
]);

/** Known, and not yet with the carrier. */
export const BEFORE_CARRIER_CODES = new Set([
  "113", // Awaiting
  "114", // Collection
  "124", // Pending
  "128", // Held
  "130", // Label Problem
  "131", // Not Picked Up
  "136", // Hold
  "144", // Data Received
  "155", // Others
  "162", // Pickup Request Received
  "170", // Ready To Dispatch
  "171", // Pickup Request Cancelled
]);

const NOT_DELIVERED =
  /\b(not|undeliver\w*|attempt\w*|fail\w*|unable|could ?n[o']t|cannot|to be delivered|will be delivered|out for delivery|being delivered|delivery (attempt|office)|expected|estimated)\b/i;
const DELIVERED_WORDS = /\bdelivered\b/i;
const CARRIER_WORDS =
  /\b(collected|picked up|in transit|out for delivery|arrived at|departed|accepted at|(received|processed|sorted) (at|by|in)|at (the )?(depot|hub|sorting|delivery office))\b/i;
const NOT_CARRIER = /\b(awaiting|ready|information|label|pre-?advice|expected|electronic|manifest|data)\b/i;

function readsDelivered(text: string): boolean {
  return DELIVERED_WORDS.test(text) && !NOT_DELIVERED.test(text);
}

function readsWithCarrier(text: string): boolean {
  return CARRIER_WORDS.test(text) && !NOT_CARRIER.test(text);
}

function isKnown(code: string): boolean {
  return (
    DELIVERED_CODES.has(code) ||
    CARRIER_CODES.has(code) ||
    PROBLEM_CODES.has(code) ||
    BEFORE_CARRIER_CODES.has(code)
  );
}

function isDeliveredEvent(e: TrackingEvent): boolean {
  if (DELIVERED_CODES.has(e.code)) return true;
  return !isKnown(e.code) && readsDelivered(e.description);
}

function isCarrierEvent(e: TrackingEvent): boolean {
  if (CARRIER_CODES.has(e.code) || PROBLEM_CODES.has(e.code) || isDeliveredEvent(e)) return true;
  return !isKnown(e.code) && readsWithCarrier(e.description);
}

// ── Parsing ─────────────────────────────────────────────────────────

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Events SmartTrack's clock puts more than an hour ahead of ours are not believed. */
const FUTURE_SLACK_MS = 60 * 60 * 1000;

function toEvent(raw: unknown, codeKey: string, descKeys: string[], timeKey: string, now: Date): TrackingEvent | null {
  const r = asRecord(raw);
  if (!r) return null;
  const at = shopWallClockToDate(asText(r[timeKey]));
  if (!at || at.getTime() > now.getTime() + FUTURE_SLACK_MS) return null;
  const description = descKeys.map((k) => asText(r[k])).find(Boolean) ?? "";
  return { code: asText(r[codeKey]), description, at };
}

/**
 * The `data` of a get-tracking response, read without trusting its shape:
 * shipment_detail.events[], else the date-grouped tracking_events, else
 * last_event alone. Anything unreadable is dropped, never thrown on.
 */
export function parseTracking(data: unknown, now = new Date()): ParsedTracking {
  const root = asRecord(data);
  const detail = asRecord(root?.shipment_detail);
  const carrierName = asText(detail?.carrier_name);

  let events: TrackingEvent[] = [];
  if (Array.isArray(detail?.events)) {
    events = detail.events.flatMap((e) => toEvent(e, "event_code", ["event_desc"], "event_datetime", now) ?? []);
  }
  if (events.length === 0) {
    const grouped = asRecord(root?.tracking_events);
    if (grouped) {
      events = Object.values(grouped)
        .flatMap((day) => (Array.isArray(day) ? day : []))
        .flatMap((e) => toEvent(e, "status_code_id", ["carrier_desc", "event_content"], "date_time", now) ?? []);
    }
  }
  if (events.length === 0 && detail?.last_event) {
    const last = toEvent(detail.last_event, "event_code", ["event_desc"], "event_datetime", now);
    if (last) events = [last];
  }

  // The same scan can be listed twice; oldest first.
  const seen = new Set<string>();
  events = events
    .filter((e) => {
      const key = `${e.at.getTime()}|${e.code}|${e.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return { carrierName, events };
}

// ── Deciding ────────────────────────────────────────────────────────

export function classifyTracking(events: TrackingEvent[]): TrackingSummary {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const latest = sorted.at(-1) ?? null;
  const delivered = sorted.find(isDeliveredEvent) ?? null;
  const firstWithCarrier = sorted.find(isCarrierEvent) ?? null;
  const unknownCodes = [...new Set(sorted.map((e) => e.code).filter((c) => !isKnown(c)))];

  let stage: TrackingStage = "awaiting";
  if (delivered) stage = "delivered";
  else if (latest && PROBLEM_CODES.has(latest.code)) stage = "problem";
  else if (firstWithCarrier) stage = "in_transit";

  return {
    stage,
    shippedAt: firstWithCarrier?.at ?? null,
    deliveredAt: delivered?.at ?? null,
    latest,
    unknownCodes,
  };
}

export const TRACKING_STAGE_LABELS: Record<TrackingStage, string> = {
  awaiting: "Waiting for the carrier",
  in_transit: "With the carrier",
  delivered: "Delivered",
  problem: "Delivery problem",
};
