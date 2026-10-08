import {
  PLAN_UPGRADE_MONTHS,
  PLAN_UPGRADE_WINDOW_DAYS,
  isPlanPackId,
  planPrice,
  type PlanMonths,
  type PlanPackId,
  type PlanPrice,
} from "@/config/plans";
import { orderKind } from "@/lib/plans/kinds";

/**
 * Turning a one-off order into box 1 of a plan (spec funnel tactic 2). Pure:
 * the confirmation page, the confirmation email and the upgrade route all ask
 * the same question here, and the route asks again before taking money.
 */

/** = SOLD_STATUSES in lib/dailyTakings.ts, which is not imported because it pulls in Prisma. */
const SOLD = ["paid", "packed", "shipped", "delivered"];
const DAY_MS = 86_400_000;

interface ItemLike {
  welcome?: unknown;
  bundleId?: unknown;
  bundleQty?: unknown;
}

function readItems(itemsJson: string): ItemLike[] | null {
  try {
    const v: unknown = JSON.parse(itemsJson);
    return Array.isArray(v) ? (v as ItemLike[]) : null;
  } catch {
    return null;
  }
}

/** The plan pack an order bought: its first paid line, when that is a 5-, 10- or 20-vial pack. */
export function planPackOf(itemsJson: string): PlanPackId | null {
  const first = (readItems(itemsJson) ?? []).find((l) => l.welcome !== true);
  return first && typeof first.bundleId === "string" && isPlanPackId(first.bundleId) ? first.bundleId : null;
}

export interface UpgradeCandidate {
  kind: string;
  status: string;
  planId: string | null;
  paidAt: Date | null;
  items: string;
}

export type UpgradeVerdict =
  | { eligible: true; packId: PlanPackId; deadline: Date }
  | { eligible: false; reason: string };

const no = (reason: string): UpgradeVerdict => ({ eligible: false, reason });

/**
 * A one-off order of exactly one 5/10/20 pack (the welcome vial aside), paid
 * within the last 7 days, standing, and not already part of a plan.
 */
export function upgradeEligibility(order: UpgradeCandidate, now: Date): UpgradeVerdict {
  if (orderKind(order.kind) !== "sale") return no("not a one-off order");
  if (!SOLD.includes(order.status)) return no("not paid, or cancelled");
  if (order.planId) return no("already part of a plan");
  if (!order.paidAt) return no("no payment date");
  const deadline = new Date(order.paidAt.getTime() + PLAN_UPGRADE_WINDOW_DAYS * DAY_MS);
  if (now.getTime() > deadline.getTime()) return no(`paid more than ${PLAN_UPGRADE_WINDOW_DAYS} days ago`);
  const paid = (readItems(order.items) ?? []).filter((l) => l.welcome !== true);
  if (paid.length !== 1) return no("not exactly one pack");
  const line = paid[0]!;
  if (typeof line.bundleId !== "string" || !isPlanPackId(line.bundleId)) return no("not a 5-, 10- or 20-vial pack");
  if (line.bundleQty !== 1) return no("more than one pack");
  return { eligible: true, packId: line.bundleId, deadline };
}

/** What the upgrade costs: the plan total less the box already bought, delivery included. */
export function upgradePriceMinor(packId: PlanPackId, months: PlanMonths): number {
  const plan = planPrice(packId, months);
  return plan.totalMinor - (plan.boxPriceMinor + plan.boxDeliveryMinor);
}

export function upgradeOffers(packId: PlanPackId): { months: PlanMonths; priceMinor: number; plan: PlanPrice }[] {
  return PLAN_UPGRADE_MONTHS.map((months) => ({
    months,
    priceMinor: upgradePriceMinor(packId, months),
    plan: planPrice(packId, months),
  }));
}

/** An unpaid upgrade already started for the same order, and what Stripe says of its payment page. */
export interface EarlierUpgrade {
  /** The upgrade's own order id (kind "plan_upgrade"). */
  orderId: string;
  months: number;
  /** Its Checkout Session id. */
  sessionId: string;
  /** "complete": paid, though the webhook may not have landed yet. */
  state: "open" | "complete" | "gone";
  url: string | null;
}

export type EarlierUpgradeAction =
  | { action: "paid" }
  | { action: "go"; expire: string[]; reuse: { orderId: string; url: string } | null };

/**
 * Before asking for an upgrade payment, what to do with the ones already
 * started for this order (/api/checkout/plan-upgrade). Pure.
 *
 *  - Any page already paid blocks: while its webhook is slow the original
 *    order is still offered the upgrade, and a new page would charge twice.
 *  - Otherwise every open page is closed except one for the same term,
 *    which is reused. All of this is decided before anything is reused, so
 *    returning a reusable page never leaves another term's page payable.
 */
export function earlierUpgradeAction(earlier: EarlierUpgrade[], months: number): EarlierUpgradeAction {
  if (earlier.some((e) => e.state === "complete")) return { action: "paid" };
  let reuse: { orderId: string; url: string } | null = null;
  const expire: string[] = [];
  for (const e of earlier) {
    if (e.state !== "open") continue;
    if (!reuse && e.months === months && e.url) reuse = { orderId: e.orderId, url: e.url };
    else expire.push(e.sessionId);
  }
  return { action: "go", expire, reuse };
}

/**
 * The pack a repurchase nudge may offer a plan for: only a one-off sale that
 * is not part of a plan. Plan purchases and boxes carry the pack's bundleId
 * too, so they must be refused here.
 */
export function nudgePlanPack(order: { kind: string; planId: string | null; items: string }): PlanPackId | null {
  if (order.planId || orderKind(order.kind) !== "sale") return null;
  return planPackOf(order.items);
}
