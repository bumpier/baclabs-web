import {
  STANDARD_DELIVERY,
  bundleById,
  shipsFree,
  type Bundle,
  type BundleId,
} from "@/config/funnel";

/**
 * DRAFT: the prepaid monthly plans, as priced in the plans session
 * (~/.claude/plans/calm-yawning-codd.md, 8 Oct 2026). DISPLAY ONLY: there is
 * no plan checkout yet, so nothing here is ever charged. When plans are
 * built this moves into config beside BUNDLES.
 *
 * A plan is paid once upfront and never renews: one box a month at the
 * pack's shop price, delivery free on every box. 6 months is pay 5 get 6;
 * 12 months is pay 10 get 12 plus a free 5-pack in box 1. Every figure is
 * derived from BUNDLES, so re-pricing a pack moves its plans with it.
 */

export type PlanMonths = 3 | 6 | 12;
export const PLAN_PACK_IDS = ["five", "ten", "twenty"] as const satisfies readonly BundleId[];
export type PlanPackId = (typeof PLAN_PACK_IDS)[number];

/** The pack the plans lead with: the best-selling pack, preselected. */
export const LEAD_PLAN_PACK: PlanPackId = "five";
/** The term preselected once someone chooses a plan. */
export const LEAD_PLAN_MONTHS: PlanMonths = 6;

const TERMS: Record<PlanMonths, { paidMonths: number; bonusPack: boolean; label: string }> = {
  3: { paidMonths: 3, bonusPack: false, label: "" },
  6: { paidMonths: 5, bonusPack: false, label: "Recommended" },
  12: { paidMonths: 10, bonusPack: true, label: "Best value" },
};

export interface Plan {
  pack: Bundle;
  months: PlanMonths;
  totalMinor: number;
  /** Every vial the plan delivers, the bonus pack included. */
  vials: number;
  freeMonths: number;
  /** Vials in the free bonus pack, 0 when there is none. */
  bonusVials: number;
  /** Against buying the same pack every month with standard delivery. */
  saveMinor: number;
  label: string;
}

/**
 * One plan, or null where it would save the customer nothing. A 20-pack
 * already ships free, so three of them bought monthly cost exactly what a
 * 3-month plan would: that plan is not offered.
 */
export function planFor(packId: PlanPackId, months: PlanMonths): Plan | null {
  const pack = bundleById(packId);
  const bonus = bundleById("five");
  if (!pack || !bonus) return null;
  const term = TERMS[months];
  const totalMinor = pack.priceMinor * term.paidMonths;
  const monthlyMinor = pack.priceMinor + (shipsFree(pack.priceMinor) ? 0 : STANDARD_DELIVERY.priceMinor);
  const bonusMinor = term.bonusPack ? bonus.priceMinor : 0;
  const saveMinor = monthlyMinor * months + bonusMinor - totalMinor;
  if (saveMinor <= 0) return null;
  return {
    pack,
    months,
    totalMinor,
    vials: pack.vials * months + (term.bonusPack ? bonus.vials : 0),
    freeMonths: months - term.paidMonths,
    bonusVials: term.bonusPack ? bonus.vials : 0,
    saveMinor,
    label: term.label,
  };
}

export function plansFor(packId: PlanPackId): Plan[] {
  return ([3, 6, 12] as const).map((m) => planFor(packId, m)).filter((p): p is Plan => p !== null);
}

/** "1 month free", "2 months free + a free 5-pack", or "" for none. */
export function planFreeLine(plan: Plan): string {
  if (plan.freeMonths === 0) return "";
  const months = `${plan.freeMonths} ${plan.freeMonths === 1 ? "month" : "months"} free`;
  return plan.bonusVials > 0 ? `${months} + a free ${plan.bonusVials}-pack` : months;
}

/** The switch's promise, from the longest term: "Up to 2 months free". */
export function planHeadline(): string {
  const most = Math.max(...PLAN_PACK_IDS.flatMap((id) => plansFor(id).map((p) => p.freeMonths)));
  return most > 0 ? `Up to ${most} months free` : "One box a month";
}
