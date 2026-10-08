import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { OPEN_STATUSES } from "@/lib/order-status";
import { PARCEL_KINDS } from "@/lib/plans/kinds";

/**
 * The one-off clear-out behind /admin/shipping/catch-up.
 *
 * Until tracking moved orders on (lib/shipping/tracking-sync.ts), nothing
 * took an order past "packed" unless someone pressed "Mark as shipped", so
 * weeks of orders that went out long ago still count as waiting. Tracking
 * settles the ones with a label; these groups are what it cannot settle,
 * each closed by its own button, so an order that may really be stuck is
 * never swept up with the rest:
 *
 *   noLabel      — no label on record at all (posted before labels were
 *                  bought here, or labelled somewhere else)
 *   labelFailed  — the automatic label failed, and the order says why
 *   notScanned   — labelled, but the carrier has never scanned it
 *
 * Only orders sold more than CATCH_UP_AFTER_DAYS ago are offered. Closing
 * them marks them delivered with no dates (nobody knows them) and emails no
 * one; without a delivered date they never get a review request either.
 */

export const CATCH_UP_AFTER_DAYS = 3;

export type CatchUpGroup = "noLabel" | "labelFailed" | "notScanned";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_SHIPMENT = { status: { in: ["PENDING", "CREATED"] } };

function soldBefore(cutoff: Date): Prisma.OrderWhereInput {
  return { OR: [{ paidAt: { lt: cutoff } }, { paidAt: null, createdAt: { lt: cutoff } }] };
}

/** The conditions for each group, re-applied when it is closed, so a change since the page loaded is respected. */
export function catchUpWhere(group: CatchUpGroup, now = new Date()): Prisma.OrderWhereInput {
  const cutoff = new Date(now.getTime() - CATCH_UP_AFTER_DAYS * DAY_MS);
  const base: Prisma.OrderWhereInput = {
    status: { in: OPEN_STATUSES },
    kind: { in: PARCEL_KINDS },
    ...soldBefore(cutoff),
  };
  switch (group) {
    case "noLabel":
      return { ...base, labelError: null, shipments: { none: ACTIVE_SHIPMENT } };
    case "labelFailed":
      return { ...base, labelError: { not: null }, shipments: { none: ACTIVE_SHIPMENT } };
    case "notScanned":
      return { ...base, shipments: { some: { status: "CREATED" } } };
  }
}

const listSelect = {
  id: true,
  status: true,
  customerName: true,
  paidAt: true,
  createdAt: true,
  labelError: true,
  shipments: {
    where: { status: "CREATED" },
    select: { trackingStage: true, trackingEvent: true, trackingCheckedAt: true, createdAt: true },
    take: 1,
  },
} as const;

export async function catchUpGroups(now = new Date()) {
  const orderBy = [{ paidAt: "asc" as const }, { createdAt: "asc" as const }];
  const [noLabel, labelFailed, notScanned, open, old] = await Promise.all([
    prisma.order.findMany({ where: catchUpWhere("noLabel", now), select: listSelect, orderBy }),
    prisma.order.findMany({ where: catchUpWhere("labelFailed", now), select: listSelect, orderBy }),
    prisma.order.findMany({ where: catchUpWhere("notScanned", now), select: listSelect, orderBy }),
    prisma.order.count({ where: { status: { in: OPEN_STATUSES }, kind: { in: PARCEL_KINDS } } }),
    catchUpCount(now),
  ]);
  // Sold within the last few days: rightly still waiting.
  return { noLabel, labelFailed, notScanned, recent: open - old };
}

/** Open orders old enough for the catch-up page to offer, for the dashboard's link to it. */
export function catchUpCount(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CATCH_UP_AFTER_DAYS * DAY_MS);
  return prisma.order.count({
    where: { status: { in: OPEN_STATUSES }, kind: { in: PARCEL_KINDS }, ...soldBefore(cutoff) },
  });
}

/** Close one group as delivered. Returns how many orders moved. */
export async function closeCatchUpGroup(group: CatchUpGroup, now = new Date()): Promise<number> {
  const { count } = await prisma.order.updateMany({
    where: catchUpWhere(group, now),
    data: { status: "delivered", labelError: null },
  });
  return count;
}
