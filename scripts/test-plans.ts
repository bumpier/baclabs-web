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

// ── Later tasks append sections here, above the report.

if (failures > 0) {
  console.error(`\n${failures} plan check(s) failed.`);
  process.exit(1);
}
console.log("✓ Plan rules pass");
