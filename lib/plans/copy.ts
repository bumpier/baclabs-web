import type { Plan } from "@prisma/client";
import { formatMinor } from "@/config/funnel";
import { planDeliveryNote, planFreeLine, planPriceFor, planPrice, type PlanPackId } from "@/config/plans";
import { brand } from "@/config/brand";
import { ctaButton, escapeHtml } from "@/lib/email";
import { LITERAL } from "@/lib/theme";
import { formatShopDay, shopDayKey } from "@/lib/saleTime";
import { freeBoxNumbers, lastBoxDay, ordinalDay } from "@/lib/plans/schedule";
import { upgradeOffers } from "@/lib/plans/upgrade";

/**
 * Every customer-facing sentence about a plan, built once, for the emails
 * (lib/customer-email.ts) and the order page. Pure. All of it must pass
 * lib/content-rules.ts: scripts/test-plans.ts checks every builder.
 */

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface PlanTerms {
  packId: string;
  vialsPerBox: number;
  months: number;
  paidMonths: number;
  boxPriceMinor: number;
  boxDeliveryMinor: number;
  bonusVials: number;
  bonusBox: number;
  bonusValueMinor: number;
  anchorDay: string | null;
}

export function planTermsOf(plan: Plan): PlanTerms {
  const { packId, vialsPerBox, months, paidMonths, boxPriceMinor, boxDeliveryMinor, bonusVials, bonusBox, bonusValueMinor, anchorDay } = plan;
  return { packId, vialsPerBox, months, paidMonths, boxPriceMinor, boxDeliveryMinor, bonusVials, bonusBox, bonusValueMinor, anchorDay };
}

const andList = (n: number[]) => (n.length === 1 ? `${n[0]}` : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`);

/**
 * `boxOne` names box 1 ("this order" in its own confirmation, "order ABCD1234"
 * in an upgrade's). `reply` is how to reach us ("reply to this email" in an
 * email, "email support@…" on a web page).
 */
export function planScheduleSentences(
  plan: PlanTerms,
  opts: { boxOne?: string; reply?: string } = {}
): string[] {
  const boxOne = opts.boxOne ?? "this order";
  const reply = opts.reply ?? "reply to this email";
  const out: string[] = [];
  if (plan.anchorDay) {
    const day = Number(plan.anchorDay.slice(8, 10));
    const shortMonths = day > 28 ? " (or the last day of a shorter month)" : "";
    out.push(
      `${plan.months} boxes of ${plan.vialsPerBox} vials, paid for once. Box 1 is ${boxOne}. After that a box goes out on the ${ordinalDay(plan.anchorDay)} of each month${shortMonths}, the last on ${formatShopDay(lastBoxDay(plan.anchorDay, plan.months))}.`
    );
  } else {
    out.push(`${plan.months} boxes of ${plan.vialsPerBox} vials, paid for once, one a month.`);
  }
  const free = freeBoxNumbers(plan.months, plan.paidMonths);
  if (free.length === 1) out.push(`Box ${free[0]} is free: you paid for ${plan.paidMonths}.`);
  if (free.length > 1) out.push(`Boxes ${andList(free)} are free: you paid for ${plan.paidMonths}.`);
  if (plan.bonusVials > 0) out.push(`Your free ${plan.bonusVials}-vial pack comes in box ${plan.bonusBox}.`);
  out.push(
    plan.boxDeliveryMinor > 0
      ? `Delivery is included: ${formatMinor(plan.boxDeliveryMinor)} a box, already paid.`
      : "Delivery is free on every box."
  );
  out.push("The plan never renews by itself. We email you two weeks before the last box.");
  const each = formatMinor(plan.boxPriceMinor + plan.boxDeliveryMinor);
  const bonus = plan.bonusVials > 0 ? ` and less ${formatMinor(plan.bonusValueMinor)} once the free pack has gone out` : "";
  out.push(
    `To skip or move a box, or to cancel, ${reply}. If you cancel, we refund what you paid less ${each} for each box already sent${bonus}.`
  );
  return out;
}

export function planScheduleHtml(plan: PlanTerms, opts: { boxOne?: string; reply?: string } = {}): string {
  return `<ul style="padding-left:18px;margin:12px 0 20px">${planScheduleSentences(plan, opts)
    .map((s) => `<li style="margin:6px 0">${escapeHtml(s)}</li>`)
    .join("")}</ul>`;
}

/** `cancelled`: the plan has been cancelled, so no box comes after this one. */
export function boxShippedCopy(input: { boxNumber: number; months: number; nextBoxDay: string | null; cancelled?: boolean }) {
  const box = `Box ${input.boxNumber} of ${input.months}`;
  return {
    subject: `${box} of your ${brand.name} plan is on its way`,
    preheader: `${box} has shipped.`,
    lead: `${box} of your monthly plan has been shipped and is on its way to you.`,
    next: input.cancelled
      ? "Your plan has been cancelled, so no more boxes will be sent after this one."
      : input.nextBoxDay
        ? `Your next box goes out on ${formatShopDay(input.nextBoxDay)}.`
        : "This is the last box of your plan. Thank you for being with us.",
  };
}

export function renewalCopy(input: { customerName: string; plan: PlanTerms; renewUrl: string }) {
  const { plan } = input;
  const anchor = plan.anchorDay;
  const day = anchor ? formatShopDay(lastBoxDay(anchor, plan.months)) : "its final date";
  const current = planPriceFor(plan.packId, plan.months);
  const free = current ? planFreeLine(current) : "";
  const today = current
    ? `<p>Today the same plan is ${formatMinor(current.totalMinor)}${free ? `, ${free}` : ""}, ${planDeliveryNote(current)}.</p>`
    : "";
  return {
    subject: `Your monthly plan ends with the box on ${day}`,
    preheader: "Plans never renew by themselves. Here is how to carry on.",
    body: `<p>Hi ${escapeHtml(input.customerName)},</p>
      <p>The last box of your ${plan.months}-month plan of ${plan.vialsPerBox} vials goes out on ${day}.</p>
      <p>Plans are paid once and never renew by themselves, so nothing more will be taken.</p>
      <p>If you would like to carry on, you can start a new plan at the price on the site on the day you order.</p>
      ${today}
      <p style="margin:28px 0 0">${ctaButton(input.renewUrl, "See the plans")}</p>`,
  };
}

const BOX = `border:1px solid ${LITERAL.line};border-radius:12px;padding:16px 20px;margin:24px 0`;

export function nudgePlanOfferHtml(packId: PlanPackId, siteUrl: string): string {
  const p = planPrice(packId, 6);
  // One line and a text link, not a second boxed button: in the reorder
  // email the reorder button is the one to press.
  return `<p style="margin:24px 0 0">Rather not have to remember? Our monthly plan sends your ${p.pack.vials}-vial pack on the same date each month. ${p.months} months is ${formatMinor(p.totalMinor)}, paid once: ${planFreeLine(p)}, save ${formatMinor(p.saveMinor)}, ${planDeliveryNote(p)}. It never renews by itself, and you can cancel any time. <a href="${siteUrl}/?plan=${p.key}#buy" style="color:${LITERAL.brand}">See monthly plans</a></p>`;
}

export function upgradeOfferHtml(input: { packId: PlanPackId; orderUrl: string; deadline: Date }): string {
  const [o6, o12] = upgradeOffers(input.packId) as [
    ReturnType<typeof upgradeOffers>[number],
    ReturnType<typeof upgradeOffers>[number],
  ];
  return `<div style="${BOX}">
    <p style="margin:0 0 8px;font-weight:600;color:${LITERAL.ink}">Make this order box 1 of a monthly plan</p>
    <p style="margin:0 0 8px">Keep this box coming every month. Until ${formatShopDay(shopDayKey(input.deadline))} you can turn this order into the first box of a plan and pay only the difference:</p>
    <ul style="padding-left:18px;margin:8px 0 12px">
      <li style="margin:6px 0">6 months: ${formatMinor(o6.priceMinor)} more (${planFreeLine(o6.plan)})</li>
      <li style="margin:6px 0">12 months: ${formatMinor(o12.priceMinor)} more (${planFreeLine(o12.plan)}, the free pack in box 2)</li>
    </ul>
    <p style="margin:0 0 16px">${capitalise(planDeliveryNote(o6.plan))}. Paid once, never renews, cancel any time.</p>
    ${ctaButton(`${input.orderUrl}#plan-upgrade`, "See the plan options")}
  </div>`;
}

export function planStartedCopy(input: { customerName: string; originalRef: string; plan: PlanTerms; paidMinor: number }) {
  return {
    subject: `Your ${brand.name} monthly plan has started`,
    preheader: `Order ${input.originalRef} is now box 1 of your plan.`,
    body: `<p>Hi ${escapeHtml(input.customerName)},</p>
      <p>Thank you. Order ${escapeHtml(input.originalRef)} is now box 1 of your ${input.plan.months}-month plan, and ${formatMinor(input.paidMinor)} has been paid today for the rest of it.</p>
      ${planScheduleHtml(input.plan, { boxOne: `order ${input.originalRef}` })}`,
  };
}
