import type { TrackingSummary } from "@/lib/shipping/tracking";

/**
 * Checking orders against where their parcels really are: the decisions
 * behind scripts/recheck-orders.ts. Pure.
 *
 * Until 9 Oct 2026 the catch-up page's "Labelled, but never scanned" button
 * marked a whole group delivered, so many orders whose label was only ever
 * made read "Delivered". Tracking only ever moves orders forward, so an
 * order marked further on than its parcel is put back here:
 *
 *   delivered, and a delivery scan  → stays delivered, with the scan's dates
 *   delivered, carrier scan only    → shipped
 *   shipped or delivered, no scan   → packed ("Label created")
 *
 * An order tracking has got further than (a packed order the carrier has,
 * say) is left to the tracking cron, which moves orders forward and emails
 * the customers still waiting. No answer from any source changes nothing.
 */

const STAGE_RANK = { awaiting: 0, in_transit: 1, problem: 1, delivered: 2 } as const;
const STATUS_RANK: Record<string, number> = { paid: 0, packed: 0, shipped: 1, delivered: 2 };

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
  const best = answered.reduce((a, b) => (STAGE_RANK[b.stage] > STAGE_RANK[a.stage] ? b : a));
  return {
    ...best,
    shippedAt: earliest(...answered.map((s) => s.shippedAt)),
    deliveredAt: earliest(...answered.filter((s) => s.stage === "delivered").map((s) => s.deliveredAt)),
    unknownCodes: [...new Set(answered.flatMap((s) => s.unknownCodes))],
  };
}

export type RecheckAction =
  /** Delivered, and a delivery scan says so: it gains the scan's dates. */
  | "confirmed"
  /** Marked delivered, but the carrier still has it. */
  | "toShipped"
  /** Marked shipped or delivered, but the carrier never scanned it. */
  | "toLabel"
  /** The order already says what tracking says. */
  | "agrees"
  /** Tracking is further on; the tracking cron moves the order forward. */
  | "behind"
  /** No answer: nothing changes. */
  | "unchecked";

/** The actions that take an order back. */
export const BACKWARD: readonly RecheckAction[] = ["toShipped", "toLabel"];

export interface Correction {
  action: RecheckAction;
  /** The order's new values, when it changes. */
  data: { status: string; shippedAt: Date | null; deliveredAt: Date | null } | null;
}

export function correctionFor(
  order: { status: string; shippedAt: Date | null; deliveredAt: Date | null },
  tracking: TrackingSummary | null
): Correction {
  if (!tracking) return { action: "unchecked", data: null };
  const was = STATUS_RANK[order.status] ?? 0;
  const is = STAGE_RANK[tracking.stage];

  if (is > was) return { action: "behind", data: null };
  if (order.status === "delivered" && tracking.stage === "delivered") {
    const deliveredAt = tracking.deliveredAt ?? order.deliveredAt;
    return {
      action: "confirmed",
      data: { status: "delivered", shippedAt: order.shippedAt ?? tracking.shippedAt ?? deliveredAt, deliveredAt },
    };
  }
  if (is === was) return { action: "agrees", data: null };

  // The order says more than its parcel has done.
  if (is === 1) {
    return {
      action: "toShipped",
      data: { status: "shipped", shippedAt: tracking.shippedAt ?? order.shippedAt, deliveredAt: null },
    };
  }
  return { action: "toLabel", data: { status: "packed", shippedAt: null, deliveredAt: null } };
}

export type CarrierGroup = "amazon" | "royalmail" | "other";

/** Which carrier a label is with, from what SmartTrack and our services call it. */
export function carrierGroup(...names: (string | null | undefined)[]): CarrierGroup {
  const text = names.filter(Boolean).join(" ");
  if (/amazon/i.test(text)) return "amazon";
  if (/royal ?mail/i.test(text)) return "royalmail";
  return "other";
}
