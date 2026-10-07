import { prisma } from "@/lib/db";
import { readSetting, SETTING_KEYS } from "@/lib/settings";
import { deliveryOptionById } from "@/config/funnel";
import { smartTrackConfig } from "@/lib/smarttrack/config";
import { getTracking, SmartTrackAuthError, SmartTrackError } from "@/lib/smarttrack/client";
import { parseTrackingNumbers } from "@/lib/shipping/shipments";
import { classifyTracking, parseTracking } from "@/lib/shipping/tracking";
import type { ShippedTracking } from "@/lib/customer-email";

/**
 * Moving orders on from SmartTrack tracking: a label whose parcel the
 * carrier has scanned moves its order to shipped (and the customer gets
 * their tracking number), and a delivery scan moves it to delivered.
 *
 * Run every 30 minutes by /api/cron/tracking, for one label by "Check
 * tracking now" on the order page, and in batches by the catch-up page.
 * Only in SmartTrack LIVE, and only for LIVE labels: UAT tracking is not a
 * real parcel, and must never move a real order.
 *
 * Orders only ever move forward, and only from the statuses named in each
 * update's where-clause, so an order cancelled or moved by hand in the
 * meantime is left alone. Each label is claimed (trackingCheckedAt stamped)
 * before SmartTrack is asked, so the cron and a button press running at
 * once never both check it, and never both email.
 *
 * Emails go only to customers still waiting: the "on its way" email while
 * the order is under a week old, the "delivered" one within two days of the
 * delivery. That is what lets the first runs over weeks of old orders move
 * them without writing to anyone.
 */

/** On unless someone switched it off on the Shipping page. */
export async function getTrackingUpdates(): Promise<boolean> {
  return (await readSetting(SETTING_KEYS.trackingUpdates)) !== "off";
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A label is checked at most this often by the cron. */
const RECHECK_MS = 55 * 60 * 1000;
/** Labels older than this have stopped moving; they are no longer asked about. */
const MAX_LABEL_AGE_DAYS = 45;
export const SHIPPED_EMAIL_MAX_ORDER_AGE_DAYS = 7;
export const DELIVERED_EMAIL_MAX_AGE_DAYS = 2;
/** Order statuses tracking can still move on. Paid too: advanceToPacked can fail quietly. */
const MOVABLE = ["paid", "packed", "shipped"];

export interface TrackingSyncResult {
  /** False when tracking is not running at all; `reason` says why. */
  ran: boolean;
  reason?: string;
  checked: number;
  shipped: number;
  delivered: number;
  problems: number;
  errors: number;
  /** Labels still due a check after this run (the time budget ran out). */
  remaining: number;
  /** Event codes lib/shipping/tracking.ts does not know, to add once seen. */
  unknownCodes: string[];
}

/** Why tracking cannot run right now, or null when it can. */
export async function trackingUnavailableReason(): Promise<string | null> {
  const cfg = smartTrackConfig();
  if (!cfg) return "SmartTrack is not connected";
  if (cfg.env !== "live") return "SmartTrack is connected to UAT, whose tracking is not a real parcel";
  if (!(await getTrackingUpdates())) return "Tracking updates are switched off on the Shipping page";
  return null;
}

/** The tracking number and carrier for an order's active label, for the shipped email. */
export async function orderTracking(order: { id: string; deliveryOption: string | null }): Promise<ShippedTracking | null> {
  const shipment = await prisma.shipment.findFirst({
    where: { orderId: order.id, status: "CREATED" },
    orderBy: { createdAt: "desc" },
    select: { trackingNumbers: true, carrierName: true },
  });
  const number = shipment ? parseTrackingNumbers(shipment.trackingNumbers)[0] : undefined;
  if (!shipment || !number) return null;
  return { number, carrier: shipment.carrierName || deliveryOptionById(order.deliveryOption)?.carrier || "" };
}

function isNoTrackingYet(err: unknown): boolean {
  return err instanceof SmartTrackError && /no tracking data/i.test(err.detail);
}

export async function syncTracking(
  opts: {
    /** Stop starting new checks after this long. */
    budgetMs?: number;
    limit?: number;
    /** Only labels last checked before this (default: 55 minutes ago). */
    staleBefore?: Date;
    /** Just this label. */
    shipmentId?: string;
    now?: () => Date;
  } = {}
): Promise<TrackingSyncResult> {
  const clock = opts.now ?? (() => new Date());
  const startedAt = clock();
  const result: TrackingSyncResult = {
    ran: false,
    checked: 0,
    shipped: 0,
    delivered: 0,
    problems: 0,
    errors: 0,
    remaining: 0,
    unknownCodes: [],
  };

  const unavailable = await trackingUnavailableReason();
  if (unavailable) return { ...result, reason: unavailable };
  const cfg = smartTrackConfig()!;
  result.ran = true;

  const staleBefore = opts.staleBefore ?? new Date(startedAt.getTime() - RECHECK_MS);
  const due = {
    status: "CREATED",
    environment: cfg.env,
    trackingNumbers: { not: "[]" },
    createdAt: { gte: new Date(startedAt.getTime() - MAX_LABEL_AGE_DAYS * DAY_MS) },
    order: { status: { in: MOVABLE } },
    OR: [{ trackingCheckedAt: null }, { trackingCheckedAt: { lt: staleBefore } }],
    ...(opts.shipmentId ? { id: opts.shipmentId } : {}),
  };

  // Never the label PDF: it is the whole label, in base64.
  const shipments = await prisma.shipment.findMany({
    where: due,
    orderBy: [{ trackingCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: opts.limit ?? 80,
    select: {
      id: true,
      trackingNumbers: true,
      carrierName: true,
      order: { select: { id: true, status: true, paidAt: true, createdAt: true, shippedAt: true, deliveryOption: true } },
    },
  });

  const unknown = new Set<string>();
  const budgetMs = opts.budgetMs ?? 60_000;

  for (const s of shipments) {
    const now = clock();
    if (now.getTime() - startedAt.getTime() > budgetMs) break;

    const number = parseTrackingNumbers(s.trackingNumbers)[0];
    if (!number) continue;

    // Claim it. Another run that got here first has already stamped it.
    const claim = await prisma.shipment.updateMany({
      where: { id: s.id, OR: [{ trackingCheckedAt: null }, { trackingCheckedAt: { lt: staleBefore } }] },
      data: { trackingCheckedAt: now },
    });
    if (claim.count === 0) continue;

    let data: unknown = null;
    try {
      data = await getTracking(number);
    } catch (err) {
      if (err instanceof SmartTrackAuthError) {
        // Every other label would fail the same way.
        result.reason = err.detail;
        result.errors++;
        break;
      }
      if (!isNoTrackingYet(err)) {
        result.errors++;
        console.error(
          `[tracking] ${number} (shipment ${s.id}) could not be checked:`,
          err instanceof SmartTrackError ? err.detail : err
        );
        continue;
      }
      // SmartTrack has nothing for it yet: it is still waiting for the carrier.
    }
    result.checked++;

    const parsed = parseTracking(data, now);
    const summary = classifyTracking(parsed.events);
    summary.unknownCodes.forEach((c) => unknown.add(c));
    const carrierName = parsed.carrierName || s.carrierName;

    await prisma.shipment.update({
      where: { id: s.id },
      data: {
        carrierName,
        trackingStage: summary.stage,
        trackingEvent: summary.latest?.description || null,
        trackingEventAt: summary.latest?.at ?? null,
      },
    });
    if (summary.stage === "problem") result.problems++;

    const order = s.order;
    const tracking = { number, carrier: carrierName || deliveryOptionById(order.deliveryOption)?.carrier || "" };

    if (summary.stage === "delivered" && summary.deliveredAt) {
      const { count } = await prisma.order.updateMany({
        where: { id: order.id, status: { in: MOVABLE } },
        data: {
          status: "delivered",
          deliveredAt: summary.deliveredAt,
          shippedAt: order.shippedAt ?? summary.shippedAt ?? summary.deliveredAt,
          labelError: null,
        },
      });
      if (count > 0) {
        result.delivered++;
        if (now.getTime() - summary.deliveredAt.getTime() <= DELIVERED_EMAIL_MAX_AGE_DAYS * DAY_MS) {
          await sendEmail(order.id, "delivered");
        }
      }
    } else if (summary.shippedAt) {
      const { count } = await prisma.order.updateMany({
        where: { id: order.id, status: { in: ["paid", "packed"] } },
        data: { status: "shipped", shippedAt: summary.shippedAt, labelError: null },
      });
      if (count > 0) {
        result.shipped++;
        const soldAt = order.paidAt ?? order.createdAt;
        if (now.getTime() - soldAt.getTime() <= SHIPPED_EMAIL_MAX_ORDER_AGE_DAYS * DAY_MS) {
          await sendEmail(order.id, "shipped", tracking);
        }
      }
    }
  }

  result.unknownCodes = [...unknown];
  if (result.unknownCodes.length > 0) {
    console.warn(`[tracking] event codes not in lib/shipping/tracking.ts: ${result.unknownCodes.join(", ")}`);
  }
  result.remaining = opts.shipmentId ? 0 : await prisma.shipment.count({ where: due });
  return result;
}

async function sendEmail(orderId: string, type: "shipped" | "delivered", tracking?: ShippedTracking) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.customerEmail) return;
  const { sendOrderShippedEmail, sendOrderDeliveredEmail } = await import("@/lib/customer-email");
  if (type === "shipped") await sendOrderShippedEmail(order, tracking);
  else await sendOrderDeliveredEmail(order);
}

// ── The warning on the dashboard and the orders page ──────────────

/** A label made this long ago with no carrier scan is worth a look. */
export const NO_SCAN_WARNING_DAYS = 3;

/**
 * Parcels that need a look: tracking reports a problem, or the label was
 * made days ago and the carrier has still not scanned it. LIVE labels only.
 */
export async function trackingProblems(now = new Date()) {
  const select = {
    id: true,
    trackingEvent: true,
    trackingEventAt: true,
    trackingCheckedAt: true,
    createdAt: true,
    order: { select: { id: true, customerName: true } },
  } as const;
  const [problems, notScanned] = await Promise.all([
    prisma.shipment.findMany({
      where: { status: "CREATED", environment: "live", trackingStage: "problem", order: { status: { in: MOVABLE } } },
      select,
      orderBy: { trackingEventAt: "asc" },
    }),
    prisma.shipment.findMany({
      where: {
        status: "CREATED",
        environment: "live",
        createdAt: { lt: new Date(now.getTime() - NO_SCAN_WARNING_DAYS * DAY_MS) },
        OR: [{ trackingStage: null }, { trackingStage: "awaiting" }],
        order: { status: { in: ["paid", "packed"] } },
      },
      select,
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { problems, notScanned };
}
