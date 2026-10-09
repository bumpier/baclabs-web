import type { TrackingEvent, TrackingStage, TrackingSummary } from "@/lib/shipping/tracking";

/**
 * Asking Amazon itself where an Amazon Shipping parcel is, as a second
 * opinion beside SmartTrack's tracking (lib/shipping/tracking.ts).
 *
 * This is the JSON behind the public page at track.amazon.co.uk/tracking/{id}:
 * no account or key, but also undocumented, so nothing about its shape is
 * trusted. progressTracker and eventHistory arrive as JSON *strings* inside
 * the JSON. Anything unreadable comes back as "no answer" (null), never as a
 * stage, so a change on Amazon's side can only ever lose the second opinion,
 * not invent one.
 *
 * Royal Mail has no equivalent: its tracking API is for Royal Mail account
 * holders only and its tracking page refuses scripts, so Royal Mail parcels
 * are read through SmartTrack alone.
 */

const TRACKER_URL = "https://track.amazon.co.uk/api/tracker/";

/** Squash "IN_TRANSIT", "InTransit" and "in transit" into one form. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

const BEFORE_CARRIER =
  /^(pretransit|ready(for(receive|pickup|collection))?$|creat|label|shipmentcreated|pickupsched|pickupcancel|pickuprequest|manifest|inforeceived|notpickedup)/;
const PROBLEM = /^(lost|rejected|undeliverable|returninitiated|returning|returned|returntosender|damaged|destroyed|addressproblem)/;
// "Received" alone (not "ReadyForReceive"): seen on 9 Oct 2026 only in
// parcels Amazon had collected, never in ones still waiting at our door.
const WITH_CARRIER =
  /^(pickupdone|pickedup|collected|departed|depart|arriv|intransit|outfordelivery|deliveryattempt|attempt|availableforpickup|readyforcustomerpickup|carrierreceived|received$|sorted|hub|delayed|customs)/;

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** A field that may be an object, or that object serialised as a string. */
function unwrap(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** The first array of objects at, or one level under, `v`. */
function firstObjectArray(v: unknown): Record<string, unknown>[] {
  const isObjects = (a: unknown): a is Record<string, unknown>[] =>
    Array.isArray(a) && a.length > 0 && a.every((x) => asRecord(x));
  if (isObjects(v)) return v;
  const r = asRecord(v);
  if (!r) return [];
  for (const value of Object.values(r)) if (isObjects(value)) return value;
  return [];
}

function toEvent(raw: Record<string, unknown>, now: Date): TrackingEvent | null {
  const code = asText(raw.eventCode) || asText(raw.code) || asText(raw.status);
  const when = asText(raw.eventTime) || asText(raw.eventDateTime) || asText(raw.time) || asText(raw.timestamp);
  const at = when ? new Date(when) : null;
  if (!code || !at || Number.isNaN(at.getTime()) || at.getTime() > now.getTime() + 60 * 60 * 1000) return null;
  const summary = asRecord(raw.statusSummary);
  const description = asText(summary?.localisedStringId) || asText(raw.eventDescription) || code;
  return { code, description, at };
}

export function amazonStageOfCode(code: string): TrackingStage | "unknown" {
  const c = norm(code);
  if (c === "delivered") return "delivered";
  if (PROBLEM.test(c)) return "problem";
  if (WITH_CARRIER.test(c)) return "in_transit";
  if (BEFORE_CARRIER.test(c)) return "awaiting";
  return "unknown";
}

export interface AmazonTracking {
  summary: TrackingSummary;
  /** Amazon's own one-word status, as given ("" when it gave none). */
  status: string;
}

/**
 * Read a tracker response. Null when Amazon does not know the number or
 * the response cannot be read: no answer, rather than "not shipped".
 */
export function parseAmazonTracking(data: unknown, now = new Date()): AmazonTracking | null {
  const root = asRecord(data);
  if (!root) return null;
  const progress = asRecord(unwrap(root.progressTracker));
  const errors = Array.isArray(progress?.errors) ? progress.errors : [];
  if (errors.length > 0) return null;

  const status = asText(asRecord(progress?.summary)?.status);
  const events = firstObjectArray(unwrap(root.eventHistory))
    .flatMap((e) => toEvent(e, now) ?? [])
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (!status && events.length === 0) return null;

  const stageAt = (e: TrackingEvent) => amazonStageOfCode(e.code);
  const latest = events.at(-1) ?? null;
  const delivered = events.find((e) => stageAt(e) === "delivered") ?? null;
  const withCarrier = events.find((e) => ["in_transit", "problem", "delivered"].includes(stageAt(e))) ?? null;
  const unknownCodes = [...new Set(events.map((e) => e.code).filter((c) => amazonStageOfCode(c) === "unknown"))];

  // The events decide where they can; the one-word status fills in when
  // they are missing or say less.
  const fromStatus = status ? amazonStageOfCode(status) : "unknown";
  if (status && fromStatus === "unknown" && !unknownCodes.includes(status)) unknownCodes.push(status);
  let stage: TrackingStage = "awaiting";
  if (delivered || fromStatus === "delivered") stage = "delivered";
  else if ((latest && stageAt(latest) === "problem") || fromStatus === "problem") stage = "problem";
  else if (withCarrier || fromStatus === "in_transit") stage = "in_transit";

  return {
    status,
    summary: {
      stage,
      shippedAt: withCarrier?.at ?? null,
      deliveredAt: delivered?.at ?? null,
      latest,
      unknownCodes,
    },
  };
}

/** Ask Amazon about one tracking number. Throws on a network or HTTP failure. */
export async function fetchAmazonTracking(trackingNumber: string): Promise<unknown> {
  const res = await fetch(TRACKER_URL + encodeURIComponent(trackingNumber), {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BacLab order check)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Amazon tracker answered HTTP ${res.status}`);
  return res.json();
}
