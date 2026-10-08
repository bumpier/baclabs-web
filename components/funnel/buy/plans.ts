/**
 * The monthly plans as the buy box reads them. The prices live in
 * config/plans.ts (derived from BUNDLES and Standard delivery); this file
 * only keeps the names the buy-box components were built against.
 * Every pack offers every term now, the £0-saving 3-month plans included.
 */
import { planPriceFor, plansForPack, type PlanMonths, type PlanPackId, type PlanPrice } from "@/config/plans";

export { LEAD_PLAN_MONTHS, LEAD_PLAN_PACK, PLAN_PACK_IDS, planFreeLine, planHeadline } from "@/config/plans";
export type { PlanMonths, PlanPackId } from "@/config/plans";

/** A plan as the picker shows it: the config price, which has every field the draft had and more. */
export type Plan = PlanPrice;

/** One plan, or null only for an id that is not a plan. */
export function planFor(packId: PlanPackId, months: PlanMonths): Plan | null {
  return planPriceFor(packId, months);
}

export function plansFor(packId: PlanPackId): Plan[] {
  return plansForPack(packId);
}
