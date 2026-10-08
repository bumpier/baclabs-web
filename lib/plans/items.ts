import { PRODUCT, bundleById } from "@/config/funnel";
import { BONUS_PACK_ID, type PlanPrice } from "@/config/plans";

/**
 * Order.items lines for plans. Box 1 (the purchase order) carries the whole
 * plan's price on its pack line, so its lines add up to the amount charged.
 * Later boxes are the pack at £0. The free bonus pack is its own £0 line, so
 * stock and the SmartTrack item list include it.
 */
export interface PlanItem {
  productId: string;
  slug: string;
  name: string;
  /** Vials, as on every order line. */
  qty: number;
  unitPrice: string;
  unitPriceUsd: string;
  lineTotal: string;
  lineTotalUsd: string;
  bundleId: string;
  bundleName: string;
  bundleQty: number;
  /** "plan": box 1 with the plan's price. "box": a later £0 box. "bonus": the free pack. */
  planLine: "plan" | "box" | "bonus";
  /** Receipts show "Free" for it, like the welcome vial. */
  planBonus?: true;
}

const NAME = `${PRODUCT.name} ${PRODUCT.size}`;
const pounds = (minor: number) => (minor / 100).toFixed(2);

function bonusLine(productId: string, slug: string): PlanItem {
  const bonus = bundleById(BONUS_PACK_ID)!;
  return {
    productId,
    slug,
    name: NAME,
    qty: bonus.vials,
    unitPrice: "0.00",
    unitPriceUsd: "0.00",
    lineTotal: "0.00",
    lineTotalUsd: "0.00",
    bundleId: bonus.id,
    bundleName: `free ${bonus.vials}-vial pack with your plan`,
    bundleQty: 1,
    planLine: "bonus",
    planBonus: true,
  };
}

export function planPurchaseItems(input: { productId: string; slug: string; plan: PlanPrice; totalUsd: string }): PlanItem[] {
  const { plan } = input;
  const lines: PlanItem[] = [
    {
      productId: input.productId,
      slug: input.slug,
      name: NAME,
      qty: plan.pack.vials,
      unitPrice: pounds(plan.totalMinor),
      unitPriceUsd: input.totalUsd,
      lineTotal: pounds(plan.totalMinor),
      lineTotalUsd: input.totalUsd,
      bundleId: plan.pack.id,
      bundleName: `${plan.pack.vials}-vial monthly plan, ${plan.months} boxes`,
      bundleQty: 1,
      planLine: "plan",
    },
  ];
  if (plan.bonusVials > 0) lines.push(bonusLine(input.productId, input.slug));
  return lines;
}

export function planBoxItems(input: {
  productId: string;
  slug: string;
  packId: string;
  vialsPerBox: number;
  boxNumber: number;
  months: number;
  bonusBox: number;
}): PlanItem[] {
  const lines: PlanItem[] = [
    {
      productId: input.productId,
      slug: input.slug,
      name: NAME,
      qty: input.vialsPerBox,
      unitPrice: "0.00",
      unitPriceUsd: "0.00",
      lineTotal: "0.00",
      lineTotalUsd: "0.00",
      bundleId: input.packId,
      bundleName: `${input.vialsPerBox}-vial pack, plan box ${input.boxNumber} of ${input.months}`,
      bundleQty: 1,
      planLine: "box",
    },
  ];
  if (input.bonusBox === input.boxNumber) lines.push(bonusLine(input.productId, input.slug));
  return lines;
}

/** A Plan row's terms, copied from the price, so a later re-price never changes a plan already sold. */
export function planRowData(plan: PlanPrice, source: "checkout" | "upgrade") {
  return {
    packId: plan.pack.id,
    vialsPerBox: plan.pack.vials,
    months: plan.months,
    paidMonths: plan.paidMonths,
    boxPriceMinor: plan.boxPriceMinor,
    boxDeliveryMinor: plan.boxDeliveryMinor,
    bonusVials: plan.bonusVials,
    // A checkout plan's bonus rides in box 1; an upgrade's box 1 has already gone, so box 2.
    bonusBox: plan.bonusVials > 0 ? (source === "upgrade" ? 2 : 1) : 0,
    bonusValueMinor: plan.bonusValueMinor,
    totalMinor: plan.totalMinor,
    source,
  };
}
