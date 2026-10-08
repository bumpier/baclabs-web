/**
 * Test suite for prepaid monthly plans: prices, the box schedule, refunds,
 * upgrades, order lines, checkout bodies and customer copy. Run with
 * `npm run test:plans`. Exits non-zero on any failure, like
 * scripts/test-finance.ts. No database: everything here is pure.
 *
 * Later tasks append their sections ABOVE the report at the bottom.
 */
import {
  allPlans,
  boxDeliveryMinor,
  parsePlanKey,
  planDeliveryNote,
  planDeliverySentence,
  planFreeLine,
  planHeadline,
  planPrice,
  planPriceFor,
  plansForPack,
} from "@/config/plans";
import { bundleById } from "@/config/funnel";
import { checkCompliance } from "@/lib/content-rules";
import { carriesRevenue, countsAsOrder, orderKind, shipsParcel } from "@/lib/plans/kinds";
import {
  addMonthsClamped, afterBox, boxDueAt, boxDueDay, freeBoxNumbers, isBoxDue, lastBoxDay,
  ordinalDay, renewalDue, renewalWindow, skipAMonth, type PlanClock,
} from "@/lib/plans/schedule";
import { planRefundMinor, refundBreakdown } from "@/lib/plans/refund";
import { nudgePlanPack, planPackOf, upgradeEligibility, upgradeOffers, upgradePriceMinor } from "@/lib/plans/upgrade";
import { planBoxItems, planPurchaseItems, planRowData } from "@/lib/plans/items";
import { soldLines } from "@/lib/inventory/demand";
import { CheckoutSchema, PlanUpgradeSchema } from "@/lib/validation";
import {
  boxShippedCopy, nudgePlanOfferHtml, planScheduleSentences, planStartedCopy, renewalCopy, upgradeOfferHtml,
} from "@/lib/plans/copy";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

// ── Task 1: prices
const EXPECTED: Record<string, { total: number; save: number }> = {
  "five-3": { total: 7767, save: 0 },
  "five-6": { total: 13335, save: 2199 },
  "five-12": { total: 26670, save: 6597 },
  "ten-3": { total: 11667, save: 0 },
  "ten-6": { total: 19835, save: 3499 },
  "ten-12": { total: 39670, save: 9197 },
  "twenty-3": { total: 19497, save: 0 },
  "twenty-6": { total: 32495, save: 6499 },
  "twenty-12": { total: 64990, save: 15197 },
};
const plans = allPlans();
check(
  "all nine plans are offered, the £0-saving 3-month ones included",
  plans.map((p) => p.key).join(" ") === "five-3 five-6 five-12 ten-3 ten-6 ten-12 twenty-3 twenty-6 twenty-12",
  plans.map((p) => p.key).join(" ")
);
for (const p of plans) {
  const want = EXPECTED[p.key]!;
  check(`${p.key} costs ${want.total}p`, p.totalMinor === want.total, String(p.totalMinor));
  check(`${p.key} saves ${want.save}p`, p.saveMinor === want.save, String(p.saveMinor));
}
check("5- and 10-vial boxes pay Standard delivery", boxDeliveryMinor(bundleById("five")!) === 390 && boxDeliveryMinor(bundleById("ten")!) === 390);
check("a 20-vial box ships free", boxDeliveryMinor(bundleById("twenty")!) === 0);
check("box price is the pack's shop price", planPrice("ten", 6).boxPriceMinor === 3499);
const f12 = planPrice("five", 12);
check("12 months: 2 free months and a free 5-pack worth £21.99", f12.freeMonths === 2 && f12.bonusVials === 5 && f12.bonusValueMinor === 2199);
check("12 months of 5 vials plus the bonus is 65 vials", f12.vials === 65);
check("6 months: 1 free month, no bonus", planPrice("five", 6).freeMonths === 1 && planPrice("five", 6).bonusVials === 0);
check("3 months: nothing free", planPrice("twenty", 3).freeMonths === 0 && planPrice("twenty", 3).bonusVials === 0);
check(
  "labels: none, Recommended, Best value",
  plansForPack("five").map((p) => p.label).join("|") === "|Recommended|Best value"
);
check("keys round-trip", JSON.stringify(parsePlanKey("ten-12")) === JSON.stringify({ pack: "ten", months: 12 }));
check(
  "bad keys are refused",
  [null, undefined, "", "five-7", "fifty-6", "five", "five-6-1", "FIVE-6"].every((k) => parsePlanKey(k) === null)
);
check("untrusted ids are refused", planPriceFor("single", 6) === null && planPriceFor("five", 4) === null);
check("free line, 12 months", planFreeLine(f12) === "2 months free + a free 5-pack", planFreeLine(f12));
check("free line, 6 months", planFreeLine(planPrice("five", 6)) === "1 month free");
check("free line, 3 months is empty", planFreeLine(planPrice("five", 3)) === "");
check("headline", planHeadline() === "Up to 2 months free", planHeadline());
check("delivery note, paid", planDeliveryNote(planPrice("five", 6)) === "includes £3.90 delivery per box");
check("delivery note, free", planDeliveryNote(planPrice("twenty", 6)) === "free delivery on every box");
check(
  "delivery sentence is derived per pack",
  planDeliverySentence() ===
    "Monthly plans include delivery in the plan price: £3.90 a box on 5- and 10-vial plans, free on 20-vial plans.",
  planDeliverySentence()
);
{
  const v = checkCompliance([planDeliverySentence(), planHeadline(), ...plans.map(planFreeLine)]);
  check("plan copy passes the house rules", v.length === 0, v.map((x) => `${x.match}: ${x.why}`).join("; "));
}

// ── Task 1: delivery choice switched off (single Stripe rate, £2.99)
{
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "off";
  const OFF: Record<string, number> = {
    "five-3": 7494, "five-6": 12789, "five-12": 25578,
    "ten-3": 11394, "ten-6": 19289, "ten-12": 38578,
    "twenty-3": 19497, "twenty-6": 32495, "twenty-12": 64990,
  };
  for (const p of allPlans()) {
    check(`choice off: ${p.key} costs ${OFF[p.key]}p`, p.totalMinor === OFF[p.key], String(p.totalMinor));
    check(`choice off: ${p.key} saving is unchanged`, p.saveMinor === EXPECTED[p.key]!.save, String(p.saveMinor));
  }
  check(
    "choice off: delivery note says £2.99",
    planDeliveryNote(planPrice("five", 6)) === "includes £2.99 delivery per box",
    planDeliveryNote(planPrice("five", 6))
  );
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "on";
}


// ── Task 2: order kinds
check("no kind is a sale", orderKind(undefined) === "sale" && orderKind(null) === "sale" && orderKind("odd") === "sale");
check("kinds read back", orderKind("plan_box") === "plan_box" && orderKind("plan_upgrade") === "plan_upgrade");
check("only a sale counts as an order", countsAsOrder("sale") && !countsAsOrder("plan_box") && !countsAsOrder("plan_upgrade"));
check("a box carries no revenue", !carriesRevenue("plan_box") && carriesRevenue("plan_upgrade") && carriesRevenue("sale"));
check("an upgrade ships nothing", !shipsParcel("plan_upgrade") && shipsParcel("plan_box") && shipsParcel("sale"));

// ── Task 2: the box schedule
check("one month on", addMonthsClamped("2026-10-08", 1) === "2026-11-08");
check("into the next year", addMonthsClamped("2026-12-15", 1) === "2027-01-15");
check("31 Jan → 28 Feb", addMonthsClamped("2026-01-31", 1) === "2026-02-28");
check("31 Jan → 29 Feb in a leap year", addMonthsClamped("2028-01-31", 1) === "2028-02-29");
check("31 Mar → 30 Apr", addMonthsClamped("2026-03-31", 1) === "2026-04-30");
check("six months on, clamped", addMonthsClamped("2026-08-31", 6) === "2027-02-28");
check("box 1 is the anchor day", boxDueDay("2026-01-31", 1) === "2026-01-31");
check("a 31st plan goes back to the 31st", boxDueDay("2026-01-31", 2) === "2026-02-28" && boxDueDay("2026-01-31", 3) === "2026-03-31");
check("box due at UK midnight in winter", boxDueAt("2026-10-08", 2).toISOString() === "2026-11-08T00:00:00.000Z");
check("box due at UK midnight in summer", boxDueAt("2026-10-08", 1).toISOString() === "2026-10-07T23:00:00.000Z");
check("last box of 6 from 8 Oct", lastBoxDay("2026-10-08", 6) === "2027-03-08");

const clock = (over: Partial<PlanClock> = {}): PlanClock => ({
  status: "active", months: 6, boxesSent: 1, anchorDay: "2026-10-08",
  nextBoxAt: new Date("2026-11-08T00:00:00Z"), renewalEmailSentAt: null, ...over,
});
check("due once its day has started", isBoxDue(clock(), new Date("2026-11-08T07:00:00Z")));
check("not before", !isBoxDue(clock(), new Date("2026-11-07T23:59:00Z")));
check("never on a cancelled plan", !isBoxDue(clock({ status: "cancelled" }), new Date("2027-01-01T00:00:00Z")));
check("never past the last box", !isBoxDue(clock({ boxesSent: 6 }), new Date("2027-06-01T00:00:00Z")));
check("never without a date", !isBoxDue(clock({ nextBoxAt: null }), new Date("2027-01-01T00:00:00Z")));

const after2 = afterBox({ months: 3, anchorDay: "2026-10-08" }, 2);
check("after box 2 of 3 the next is 8 Dec", after2.status === "active" && after2.boxesSent === 2 && after2.nextBoxAt?.toISOString() === "2026-12-08T00:00:00.000Z");
const after3 = afterBox({ months: 3, anchorDay: "2026-10-08" }, 3);
check("after the last box the plan is completed", after3.status === "completed" && after3.nextBoxAt === null && after3.boxesSent === 3);

const win = renewalWindow("2026-10-08", 6);
check("renewal window opens 14 days before the last box", win.from.toISOString() === "2027-02-22T00:00:00.000Z" && win.until.toISOString() === "2027-03-22T00:00:00.000Z");
check("renewal not due the day before", !renewalDue(clock(), new Date("2027-02-21T12:00:00Z")));
check("renewal due from the 14th day before", renewalDue(clock(), new Date("2027-02-22T00:00:00Z")));
check("renewal due on a completed plan too", renewalDue(clock({ status: "completed", boxesSent: 6 }), new Date("2027-03-10T00:00:00Z")));
check("renewal sent once", !renewalDue(clock({ renewalEmailSentAt: new Date() }), new Date("2027-02-23T00:00:00Z")));
check("no renewal on a cancelled plan", !renewalDue(clock({ status: "cancelled" }), new Date("2027-02-23T00:00:00Z")));
check("no renewal long after the end", !renewalDue(clock(), new Date("2027-03-23T00:00:00Z")));

const skipped = skipAMonth({ anchorDay: "2026-10-08", boxesSent: 2, months: 6 });
check("skip a month moves the rest back", skipped.anchorDay === "2026-11-08" && skipped.nextBoxAt?.toISOString() === "2027-01-08T00:00:00.000Z");
check(
  "ordinals",
  ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-08", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-31"]
    .map(ordinalDay).join(" ") === "1st 2nd 3rd 8th 11th 12th 13th 21st 22nd 23rd 31st"
);
check("free boxes are the last ones", freeBoxNumbers(12, 10).join(",") === "11,12" && freeBoxNumbers(6, 5).join(",") === "6" && freeBoxNumbers(3, 3).length === 0);

// ── Task 2: refunds (spec example: 5-vial 12 months cancelled after 3 boxes → £167.04)
const r12 = { paidMinor: 26670, boxPriceMinor: 2199, boxDeliveryMinor: 390, bonusBox: 1, bonusValueMinor: 2199 };
check("spec example refunds £167.04", planRefundMinor({ ...r12, boxesSent: 3 }) === 16704);
check("after box 1 the bonus is already out", planRefundMinor({ ...r12, boxesSent: 1 }) === 21882);
check("never below zero", planRefundMinor({ paidMinor: 13335, boxesSent: 6, boxPriceMinor: 2199, boxDeliveryMinor: 390, bonusBox: 0, bonusValueMinor: 0 }) === 0);
check("free-delivery boxes deduct the box price only", planRefundMinor({ paidMinor: 32495, boxesSent: 2, boxPriceMinor: 6499, boxDeliveryMinor: 0, bonusBox: 0, bonusValueMinor: 0 }) === 19497);
check("upgrade: bonus in box 2 not yet sent", planRefundMinor({ ...r12, bonusBox: 2, boxesSent: 1 }) === 24081);
check("upgrade: bonus sent with box 2", planRefundMinor({ ...r12, bonusBox: 2, boxesSent: 2 }) === 19293);
check("3 months, 1 box sent", planRefundMinor({ paidMinor: 11667, boxesSent: 1, boxPriceMinor: 3499, boxDeliveryMinor: 390, bonusBox: 0, bonusValueMinor: 0 }) === 7778);
check(
  "the calculator shows its working",
  JSON.stringify(refundBreakdown({ ...r12, boxesSent: 3 })) ===
    JSON.stringify({ paidMinor: 26670, boxesMinor: 7767, bonusSent: true, bonusMinor: 2199, refundMinor: 16704 })
);

// ── Task 2: upgrades
const DAY = 86_400_000;
const now = new Date("2026-10-08T12:00:00Z");
const oneOff = (over: Partial<Parameters<typeof upgradeEligibility>[0]> = {}) => ({
  kind: "sale", status: "paid", planId: null, paidAt: new Date(now.getTime() - 2 * DAY),
  items: JSON.stringify([{ qty: 5, bundleId: "five", bundleQty: 1 }]), ...over,
});
const ok = upgradeEligibility(oneOff(), now);
check("a 5-pack paid 2 days ago can upgrade", ok.eligible && ok.packId === "five");
check("its deadline is 7 days after payment", ok.eligible && ok.deadline.toISOString() === new Date(now.getTime() + 5 * DAY).toISOString());
check("exactly 7 days is still in time", upgradeEligibility(oneOff({ paidAt: new Date(now.getTime() - 7 * DAY) }), now).eligible);
check("8 days is too late", !upgradeEligibility(oneOff({ paidAt: new Date(now.getTime() - 8 * DAY) }), now).eligible);
check("the welcome vial does not count as a second line", upgradeEligibility(oneOff({ items: JSON.stringify([{ qty: 10, bundleId: "ten", bundleQty: 1 }, { qty: 1, welcome: true }]) }), now).eligible);
check("two packs of one size cannot", !upgradeEligibility(oneOff({ items: JSON.stringify([{ qty: 10, bundleId: "five", bundleQty: 2 }]) }), now).eligible);
check("a single vial cannot", !upgradeEligibility(oneOff({ items: JSON.stringify([{ qty: 1, bundleId: "single", bundleQty: 1 }]) }), now).eligible);
check("a 50-pack cannot", !upgradeEligibility(oneOff({ items: JSON.stringify([{ qty: 50, bundleId: "fifty", bundleQty: 1 }]) }), now).eligible);
check("an order already in a plan cannot", !upgradeEligibility(oneOff({ planId: "p1" }), now).eligible);
check("a plan box cannot", !upgradeEligibility(oneOff({ kind: "plan_box" }), now).eligible);
check("unpaid or cancelled cannot", !upgradeEligibility(oneOff({ status: "pending" }), now).eligible && !upgradeEligibility(oneOff({ status: "cancelled" }), now).eligible);
check("shipped and delivered can", upgradeEligibility(oneOff({ status: "shipped" }), now).eligible && upgradeEligibility(oneOff({ status: "delivered" }), now).eligible);
check("unreadable items cannot", !upgradeEligibility(oneOff({ items: "nope" }), now).eligible);
const UPGRADE: [string, number, number][] = [
  ["five", 6, 10746], ["five", 12, 24081], ["ten", 6, 15946], ["ten", 12, 35781], ["twenty", 6, 25996], ["twenty", 12, 58491],
];
for (const [pack, months, price] of UPGRADE) {
  check(`upgrade ${pack} to ${months} months costs ${price}p`, upgradePriceMinor(pack as "five", months as 6) === price);
}
check("offers are 6 then 12 months", upgradeOffers("five").map((o) => `${o.months}:${o.priceMinor}`).join(" ") === "6:10746 12:24081");
check("the plan pack of an order skips the welcome vial", planPackOf(JSON.stringify([{ qty: 1, welcome: true }, { qty: 20, bundleId: "twenty", bundleQty: 1 }])) === "twenty");
check(
  "…any number of a plan pack counts, other packs do not",
  planPackOf(JSON.stringify([{ qty: 40, bundleId: "twenty", bundleQty: 2 }])) === "twenty" &&
    planPackOf(JSON.stringify([{ qty: 50, bundleId: "fifty", bundleQty: 1 }])) === null
);

// ── Task 2: order lines
const p12 = planPrice("five", 12);
const bought = planPurchaseItems({ productId: "prod", slug: "baclab-10ml", plan: p12, totalUsd: "340.00" });
check("box 1 of a 12-month plan carries the bonus pack", bought.length === 2 && bought[1]!.planBonus === true && bought[1]!.lineTotal === "0.00");
check("box 1's lines add up to the plan price", bought.reduce((s, l) => s + Math.round(Number(l.lineTotal) * 100), 0) === 26670);
check("box 1 holds 5 + 5 vials", bought[0]!.qty === 5 && bought[1]!.qty === 5);
const sold1 = soldLines(JSON.stringify(bought));
check("inventory reads two 5-packs", sold1.map((l) => `${l.skuCode}×${l.quantity}`).join(" ") === "BACLAB-10ML-X5×1 BACLAB-10ML-X5×1", sold1.map((l) => `${l.skuCode}×${l.quantity}`).join(" "));
check("a 6-month plan's box 1 is one line", planPurchaseItems({ productId: "prod", slug: "baclab-10ml", plan: planPrice("ten", 6), totalUsd: "0" }).length === 1);
const box2 = planBoxItems({ productId: "prod", slug: "baclab-10ml", packId: "five", vialsPerBox: 5, boxNumber: 2, months: 12, bonusBox: 2 });
check("an upgraded 12-month plan's box 2 carries the bonus", box2.length === 2 && box2.every((l) => l.lineTotal === "0.00"));
const box3 = planBoxItems({ productId: "prod", slug: "baclab-10ml", packId: "twenty", vialsPerBox: 20, boxNumber: 3, months: 6, bonusBox: 0 });
check("a later box is the pack at £0", box3.length === 1 && box3[0]!.bundleId === "twenty" && box3[0]!.bundleQty === 1 && box3[0]!.qty === 20 && box3[0]!.bundleName.includes("box 3 of 6"));
check("inventory reads a box as its pack", soldLines(JSON.stringify(box3))[0]!.skuCode === "BACLAB-10ML-X20");
check("the bonus rides in box 1 of a checkout plan", planRowData(p12, "checkout").bonusBox === 1);
check("…and box 2 of an upgrade", planRowData(p12, "upgrade").bonusBox === 2);
check("no bonus, no bonus box", planRowData(planPrice("five", 6), "checkout").bonusBox === 0);
check("the row copies the price", planRowData(p12, "checkout").totalMinor === 26670 && planRowData(p12, "checkout").paidMonths === 10);

// ── Task 5: checkout bodies
const parse = (body: unknown) => CheckoutSchema.safeParse(body);
const planBody = { method: "card", plan: { pack: "five", months: 6 } };
const asPlan = parse(planBody);
check("a plan body parses as a plan", asPlan.success && "plan" in asPlan.data);
check("with consent too", parse({ ...planBody, trackingConsent: true }).success);
check("a pack body still parses as a pack", (() => { const r = parse({ method: "card", tierId: "five", quantity: 1 }); return r.success && !("plan" in r.data); })());
check("a plan body with a tier is refused", !parse({ ...planBody, tierId: "five", quantity: 1 }).success);
check("months must be 3, 6 or 12", !parse({ method: "card", plan: { pack: "five", months: 4 } }).success && !parse({ method: "card", plan: { pack: "five", months: "6" } }).success);
check("only 5, 10 and 20 have plans", !parse({ method: "card", plan: { pack: "fifty", months: 6 } }).success);
check("plans are card only", !parse({ method: "btc", plan: { pack: "five", months: 6 } }).success);
check("no amount can be sent", !parse({ ...planBody, plan: { pack: "five", months: 6, totalMinor: 1 } }).success);

// ── Task 7: customer copy
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const termsOf = (key: string, anchorDay: string | null = "2026-10-08", source: "checkout" | "upgrade" = "checkout") => {
  const k = parsePlanKey(key)!;
  return { ...planRowData(planPrice(k.pack, k.months), source), anchorDay };
};
const allCopy: string[] = [];
for (const p of allPlans()) {
  const s = planScheduleSentences(termsOf(p.key));
  allCopy.push(...s);
  check(`${p.key} schedule says it is paid once`, s.some((x) => x.includes("paid for once")));
  check(`${p.key} schedule says cancel by replying`, s.some((x) => x.includes("reply to this email")));
}
const s12 = planScheduleSentences(termsOf("five-12")).join(" ");
check("12 months: boxes 11 and 12 are free", s12.includes("Boxes 11 and 12 are free: you paid for 10."), s12);
check("12 months: the free pack comes in box 1", s12.includes("Your free 5-vial pack comes in box 1."));
check("monthly date and last box are stated", s12.includes("on the 8th of each month") && s12.includes("Wednesday 8 September 2027"), s12);
check("the refund rule in words", s12.includes("less £25.89 for each box already sent") && s12.includes("less £21.99 once the free pack has gone out"), s12);
check("an upgrade's bonus is in box 2", planScheduleSentences(termsOf("five-12", "2026-10-08", "upgrade")).join(" ").includes("comes in box 2"));
check("a 31st plan mentions short months", planScheduleSentences(termsOf("ten-6", "2026-01-31")).join(" ").includes("or the last day of a shorter month"));
check("20-vial boxes ship free", planScheduleSentences(termsOf("twenty-6")).join(" ").includes("Delivery is free on every box."));
check("3 months has no free-box sentence", !planScheduleSentences(termsOf("five-3")).join(" ").includes("are free") && !planScheduleSentences(termsOf("five-3")).join(" ").includes("is free"));

const shipped = boxShippedCopy({ boxNumber: 3, months: 6, nextBoxDay: "2027-01-08" });
check("shipped subject says Box 3 of 6", shipped.subject.includes("Box 3 of 6"));
check("shipped copy names the next box", shipped.next.includes("Friday 8 January 2027"));
check("the last box says so", boxShippedCopy({ boxNumber: 6, months: 6, nextBoxDay: null }).next.includes("last box"));
allCopy.push(shipped.subject, shipped.preheader, shipped.lead, shipped.next);

const renewal = renewalCopy({ customerName: "Alex", plan: termsOf("five-6"), renewUrl: "https://baclab.co.uk/?plan=five-6#buy" });
check("renewal links back to the picker, preselected", renewal.body.includes("/?plan=five-6#buy"));
check("renewal says it never renews by itself", text(renewal.body).includes("never renew by themselves"));
check("renewal quotes today's price for the same plan", text(renewal.body).includes("£133.35"));
check("renewal names the last box day", renewal.subject.includes("Monday 8 March 2027"), renewal.subject);
allCopy.push(renewal.subject, renewal.preheader, text(renewal.body));

const nudge = nudgePlanOfferHtml("ten", "https://baclab.co.uk");
check("nudge offers the pack's 6-month plan", nudge.includes("/?plan=ten-6#buy") && text(nudge).includes("£198.35"));
check("nudge states per-box delivery", text(nudge).includes("includes £3.90 delivery per box"));
check("nudge never quotes a per-vial price", !/a vial|per vial/.test(text(nudge)));
allCopy.push(text(nudge));

const offer = upgradeOfferHtml({ packId: "five", orderUrl: "https://baclab.co.uk/order-confirmation/abc", deadline: new Date("2026-10-15T09:00:00Z") });
check("upgrade offer prices both terms", text(offer).includes("£107.46") && text(offer).includes("£240.81"));
check("upgrade offer states its deadline", text(offer).includes("Thursday 15 October 2026"));
check("upgrade offer links to the page's offer", offer.includes("/order-confirmation/abc#plan-upgrade"));
allCopy.push(text(offer));

const started = planStartedCopy({ customerName: "Alex", originalRef: "ABCD1234", plan: termsOf("five-12", "2026-10-06", "upgrade"), paidMinor: 24081 });
check("plan started names the original order", text(started.body).includes("ABCD1234") && text(started.body).includes("£240.81"));
allCopy.push(started.subject, started.preheader, text(started.body));

{
  const v = checkCompliance(allCopy);
  check("all plan copy passes the house rules", v.length === 0, v.map((x) => `${x.match}: ${x.why}`).join("; "));
}

{
  const items = JSON.stringify([{ bundleId: "five", bundleQty: 1 }]);
  check("nudge offers a plan to a one-off pack buyer", nudgePlanPack({ kind: "sale", planId: null, items }) === "five");
  check("nudge offers nothing to an order inside a plan", nudgePlanPack({ kind: "sale", planId: "p1", items }) === null);
  check("nudge offers nothing on a plan box", nudgePlanPack({ kind: "plan_box", planId: null, items }) === null);
  check("nudge offers nothing on a plan upgrade", nudgePlanPack({ kind: "plan_upgrade", planId: null, items }) === null);
}

// ── Task 12: upgrade bodies
{
  const uid = "6f1c2a7e-3b4d-4c5e-8f90-1a2b3c4d5e6f";
  check("an upgrade body parses", PlanUpgradeSchema.safeParse({ orderId: uid, months: 6 }).success);
  check("12 months too", PlanUpgradeSchema.safeParse({ orderId: uid, months: 12, trackingConsent: true }).success);
  check("3 months is not an upgrade", !PlanUpgradeSchema.safeParse({ orderId: uid, months: 3 }).success);
  check("the order id must be a uuid", !PlanUpgradeSchema.safeParse({ orderId: "abc", months: 6 }).success);
  check("no amount can be sent", !PlanUpgradeSchema.safeParse({ orderId: uid, months: 6, priceMinor: 1 }).success);
}

// ── Later tasks append sections here, above the report.

if (failures > 0) {
  console.error(`\n${failures} plan check(s) failed.`);
  process.exit(1);
}
console.log("✓ Plan rules pass");
