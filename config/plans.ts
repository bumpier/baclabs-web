import {
  bundleById,
  formatMinor,
  quotedDeliveryMinor,
  shipsFree,
  type Bundle,
  type BundleId,
} from "@/config/funnel";

/**
 * PREPAID MONTHLY PLANS: the one source of every plan price and term.
 * Spec: ~/.claude/plans/calm-yawning-codd.md (approved 8 Oct 2026).
 *
 * A plan is one pack a month for 3, 6 or 12 months, paid ONCE upfront and
 * never renewed. Every figure is DERIVED from BUNDLES and the delivery a
 * one-off order under the free-delivery line is quoted (quotedDeliveryMinor
 * in config/funnel.ts): re-price a pack or delivery and its plans follow. No
 * total is ever typed here.
 *
 *   total = box price × months paid + box delivery × months
 *   box delivery = the quoted delivery, or 0 when the pack alone ships free
 *   save = (box price + box delivery) × months + bonus pack price − total
 *
 * "Save" compares against buying the same pack every month at today's
 * prices. Plans never use the sale's reference price: no plan was ever sold
 * dearer, so a struck-through figure would be a false comparison.
 */

export const PLAN_MONTHS = [3, 6, 12] as const;
export type PlanMonths = (typeof PLAN_MONTHS)[number];

export const PLAN_PACK_IDS = ["five", "ten", "twenty"] as const satisfies readonly BundleId[];
export type PlanPackId = (typeof PLAN_PACK_IDS)[number];

/** The pack the plans lead with: the best-selling pack, preselected. */
export const LEAD_PLAN_PACK: PlanPackId = "five";
/** The term preselected once someone chooses a plan. */
export const LEAD_PLAN_MONTHS: PlanMonths = 6;

/** The pack that rides free with a 12-month plan, counted at its shop price. */
export const BONUS_PACK_ID = "five" satisfies BundleId;

export const PLAN_TERMS: Record<PlanMonths, { paidMonths: number; bonusPack: boolean; label: string }> = {
  3: { paidMonths: 3, bonusPack: false, label: "" },
  6: { paidMonths: 5, bonusPack: false, label: "Recommended" },
  12: { paidMonths: 10, bonusPack: true, label: "Best value" },
};

/** The renewal email goes this long before the last box. */
export const RENEWAL_NOTICE_DAYS = 14;
/** A one-off order can become box 1 of a plan for this long after it is paid. */
export const PLAN_UPGRADE_WINDOW_DAYS = 7;
/** The terms a one-off order can be upgraded to. */
export const PLAN_UPGRADE_MONTHS = [6, 12] as const satisfies readonly PlanMonths[];

export interface PlanPrice {
  /** "five-6": the ?plan= value and the Stripe metadata. */
  key: string;
  pack: Bundle;
  months: PlanMonths;
  paidMonths: number;
  freeMonths: number;
  boxPriceMinor: number;
  boxDeliveryMinor: number;
  /** Vials in the free bonus pack, 0 when there is none. */
  bonusVials: number;
  /** The bonus pack at its shop price, 0 when there is none. */
  bonusValueMinor: number;
  totalMinor: number;
  /** Against buying the same pack every month with the quoted delivery. */
  saveMinor: number;
  /** Every vial the plan delivers, the bonus pack included. */
  vials: number;
  label: string;
}

export function isPlanPackId(id: string): id is PlanPackId {
  return (PLAN_PACK_IDS as readonly string[]).includes(id);
}

export function isPlanMonths(n: number): n is PlanMonths {
  return (PLAN_MONTHS as readonly number[]).includes(n);
}

export function planKey(packId: PlanPackId, months: PlanMonths): string {
  return `${packId}-${months}`;
}

/** "five-6" → { pack: "five", months: 6 }; anything else → null. */
export function parsePlanKey(raw: string | null | undefined): { pack: PlanPackId; months: PlanMonths } | null {
  const m = /^([a-z]+)-(\d{1,2})$/.exec(raw ?? "");
  if (!m) return null;
  const pack = m[1]!;
  const months = Number(m[2]);
  return isPlanPackId(pack) && isPlanMonths(months) ? { pack, months } : null;
}

/**
 * Delivery charged inside a plan for each box of this pack: exactly what a
 * one-off order of the pack is quoted. Read at call time, never cached, so
 * the delivery-choice switch is honoured.
 */
export function boxDeliveryMinor(pack: Bundle): number {
  return shipsFree(pack.priceMinor) ? 0 : quotedDeliveryMinor();
}

export function planPrice(packId: PlanPackId, months: PlanMonths): PlanPrice {
  const pack = bundleById(packId);
  const bonus = bundleById(BONUS_PACK_ID);
  if (!pack || !bonus) throw new Error(`config/plans: pack "${packId}" or the bonus pack is missing from BUNDLES`);
  const term = PLAN_TERMS[months];
  const delivery = boxDeliveryMinor(pack);
  const bonusValueMinor = term.bonusPack ? bonus.priceMinor : 0;
  const totalMinor = pack.priceMinor * term.paidMonths + delivery * months;
  const saveMinor = (pack.priceMinor + delivery) * months + bonusValueMinor - totalMinor;
  return {
    key: planKey(packId, months),
    pack,
    months,
    paidMonths: term.paidMonths,
    freeMonths: months - term.paidMonths,
    boxPriceMinor: pack.priceMinor,
    boxDeliveryMinor: delivery,
    bonusVials: term.bonusPack ? bonus.vials : 0,
    bonusValueMinor,
    totalMinor,
    saveMinor,
    vials: pack.vials * months + (term.bonusPack ? bonus.vials : 0),
    label: term.label,
  };
}

/** For ids that came from a request or a URL: null unless both are real. */
export function planPriceFor(packId: string, months: number): PlanPrice | null {
  return isPlanPackId(packId) && isPlanMonths(months) ? planPrice(packId, months) : null;
}

export function plansForPack(packId: PlanPackId): PlanPrice[] {
  return PLAN_MONTHS.map((m) => planPrice(packId, m));
}

export function allPlans(): PlanPrice[] {
  return PLAN_PACK_IDS.flatMap((id) => plansForPack(id));
}

/** "1 month free", "2 months free + a free 5-pack", or "" for none. */
export function planFreeLine(plan: Pick<PlanPrice, "freeMonths" | "bonusVials">): string {
  if (plan.freeMonths === 0) return "";
  const months = `${plan.freeMonths} ${plan.freeMonths === 1 ? "month" : "months"} free`;
  return plan.bonusVials > 0 ? `${months} + a free ${plan.bonusVials}-pack` : months;
}

/** The switch's promise, from the longest term: "Up to 2 months free". */
export function planHeadline(): string {
  const most = Math.max(...allPlans().map((p) => p.freeMonths));
  return most > 0 ? `Up to ${most} months free` : "One box a month";
}

/** Beside a plan's price: "includes £3.90 delivery per box", or free. */
export function planDeliveryNote(plan: Pick<PlanPrice, "boxDeliveryMinor">): string {
  return plan.boxDeliveryMinor > 0
    ? `includes ${formatMinor(plan.boxDeliveryMinor)} delivery per box`
    : "free delivery on every box";
}

function vialList(plans: PlanPrice[]): string {
  const v = plans.map((p) => p.pack.vials);
  if (v.length === 1) return `${v[0]}-vial plans`;
  return `${v.slice(0, -1).map((n) => `${n}-`).join(", ")} and ${v[v.length - 1]}-vial plans`;
}

/** One sentence for "Delivery and returns", derived per pack. */
export function planDeliverySentence(): string {
  const plans = PLAN_PACK_IDS.map((id) => planPrice(id, LEAD_PLAN_MONTHS));
  const paid = plans.filter((p) => p.boxDeliveryMinor > 0);
  const free = plans.filter((p) => p.boxDeliveryMinor === 0);
  if (paid.length === 0) return "Monthly plans include free delivery on every box.";
  const fee = `${formatMinor(paid[0]!.boxDeliveryMinor)} a box`;
  if (free.length === 0) return `Monthly plans include delivery in the plan price: ${fee}.`;
  return `Monthly plans include delivery in the plan price: ${fee} on ${vialList(paid)}, free on ${vialList(free)}.`;
}
