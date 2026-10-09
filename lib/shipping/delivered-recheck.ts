import type { TrackingSummary } from "@/lib/shipping/tracking";

/**
 * Putting right orders marked delivered that tracking says were not:
 * the decisions behind scripts/recheck-delivered.ts. Pure.
 *
 * Until 9 Oct 2026 the catch-up page's "Labelled, but never scanned" button
 * marked a whole group delivered, so many orders whose label was only ever
 * made read "Delivered". Each is moved to where its tracking says the
 * parcel really is:
 *
 *   a delivery scan     → stays delivered, with the scan's date
 *   a carrier scan only → shipped
 *   no carrier scan     → packed ("Label created"), which the tracking cron
 *                         then moves on like any other label
 *
 * No answer from any source leaves the order alone.
 */

const RANK = { awaiting: 0, in_transit: 1, problem: 1, delivered: 2 } as const;

const earliest = (...dates: (Date | null | undefined)[]) =>
  dates.reduce<Date | null>((min, d) => (d && (!min || d < min) ? d : min), null);

/**
 * Two opinions on one parcel (SmartTrack, and Amazon's own tracker for
 * Amazon parcels) as one. A scan either source has seen happened, so the
 * further-on stage wins; on a tie SmartTrack's reading stands.
 */
export function combineTracking(...sources: (TrackingSummary | null)[]): TrackingSummary | null {
  const answered = sources.filter((s): s is TrackingSummary => s !== null);
  if (answered.length === 0) return null;
  const best = answered.reduce((a, b) => (RANK[b.stage] > RANK[a.stage] ? b : a));
  return {
    ...best,
    shippedAt: earliest(...answered.map((s) => s.shippedAt)),
    deliveredAt: earliest(...answered.filter((s) => s.stage === "delivered").map((s) => s.deliveredAt)),
    unknownCodes: [...new Set(answered.flatMap((s) => s.unknownCodes))],
  };
}

export type RecheckAction = "confirmed" | "shipped" | "packed" | "unchecked";

export interface Correction {
  action: RecheckAction;
  /** The order's new values; null for "unchecked", which changes nothing. */
  data: { status: string; shippedAt: Date | null; deliveredAt: Date | null } | null;
}

export function correctionFor(
  order: { shippedAt: Date | null; deliveredAt: Date | null },
  tracking: TrackingSummary | null
): Correction {
  if (!tracking) return { action: "unchecked", data: null };
  switch (tracking.stage) {
    case "delivered": {
      const deliveredAt = tracking.deliveredAt ?? order.deliveredAt;
      return {
        action: "confirmed",
        data: { status: "delivered", shippedAt: order.shippedAt ?? tracking.shippedAt ?? deliveredAt, deliveredAt },
      };
    }
    case "in_transit":
    case "problem":
      return {
        action: "shipped",
        data: { status: "shipped", shippedAt: tracking.shippedAt ?? order.shippedAt, deliveredAt: null },
      };
    case "awaiting":
      return { action: "packed", data: { status: "packed", shippedAt: null, deliveredAt: null } };
  }
}

export type CarrierGroup = "amazon" | "royalmail" | "other";

/** Which carrier a label is with, from what SmartTrack and our services call it. */
export function carrierGroup(...names: (string | null | undefined)[]): CarrierGroup {
  const text = names.filter(Boolean).join(" ");
  if (/amazon/i.test(text)) return "amazon";
  if (/royal ?mail/i.test(text)) return "royalmail";
  return "other";
}
