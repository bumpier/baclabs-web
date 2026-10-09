/**
 * Test suite for the pack upsell in lib/upsell.ts. Run with
 * `npm run test:upsell`. Exits non-zero on any failure, like
 * scripts/test-sale.ts.
 *
 * The offer states a price difference and, sometimes, free delivery. These
 * checks hold both to what Stripe would charge (deliveryMinorFor and
 * shipsFree, the functions the session calls), with the delivery choice
 * switched on and off, for every pack at every quantity the buy box allows.
 */
import {
  BUNDLES,
  MAX_QUANTITY,
  MIN_QUANTITY,
  bundleById,
  deliveryMinorFor,
  formatMinor,
  freeDeliveryName,
  remainingForFreeDeliveryMinor,
  shipsFree,
  totalMinor,
} from "@/config/funnel";
import { upsellCopy, upsellFor } from "@/lib/upsell";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const payable = (goods: number) => goods + deliveryMinorFor(goods);

for (const choice of ["on", "off"]) {
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = choice;

  for (const b of BUNDLES) {
    for (let q = MIN_QUANTITY; q <= MAX_QUANTITY; q++) {
      const at = `[${choice}] ${q} × ${b.id}`;
      const u = upsellFor(b, q);
      const vials = b.vials * q;
      const bigger = BUNDLES.filter((x) => x.vials > vials);

      if (!u) {
        check(`${at}: no offer only when no pack is bigger`, bigger.length === 0);
        continue;
      }

      const goods = totalMinor(b, q);
      check(`${at}: from is priced as Stripe charges`, u.from.payableMinor === payable(goods));
      check(`${at}: offer is one pack`, u.to.quantity === 1);
      check(`${at}: to is priced as Stripe charges`, u.to.payableMinor === payable(u.to.bundle.priceMinor));
      check(`${at}: extra is the difference in payable`, u.extraMinor === u.to.payableMinor - u.from.payableMinor);

      if (u.kind === "same-for-less") {
        check(`${at}: same-for-less holds the same vials`, u.to.vials === vials);
        check(`${at}: same-for-less costs less`, u.extraMinor < 0, String(u.extraMinor));
      } else {
        const smallest = Math.min(...bigger.map((x) => x.vials));
        check(`${at}: step-up is the next pack up`, u.to.vials === smallest, `${u.to.vials} vs ${smallest}`);
      }

      check(
        `${at}: unlock flag follows shipsFree`,
        u.unlocksFreeDelivery === (!shipsFree(goods) && shipsFree(u.to.goodsMinor))
      );
      check(
        `${at}: lose flag follows shipsFree`,
        u.losesFreeDelivery === (shipsFree(goods) && !shipsFree(u.to.goodsMinor))
      );

      const copy = upsellCopy(u);
      const all = `${copy.heading} ${copy.body} ${copy.line}`;
      const claimsFree = /ships free|Free .*delivery|free .*delivery/.test(all);
      check(
        `${at}: free delivery is only mentioned when one side ships free`,
        !claimsFree || shipsFree(goods) || shipsFree(u.to.goodsMinor),
        all
      );
      if (u.unlocksFreeDelivery) {
        const away = formatMinor(remainingForFreeDeliveryMinor(goods));
        check(`${at}: heading states the distance to free delivery`, copy.heading.includes(away), copy.heading);
        check(`${at}: heading names the free service`, copy.heading.includes(freeDeliveryName()), copy.heading);
      }
      if (u.losesFreeDelivery) {
        check(`${at}: losing free delivery is said`, copy.body.includes("ships free now"), copy.body);
      }
      if (u.extraMinor > 0) {
        check(`${at}: a dearer offer states the extra`, all.includes(formatMinor(u.extraMinor)), all);
      }
      check(`${at}: never a negative figure in the copy`, !all.includes("£-"), all);
    }
  }

  // The ladder the funnel was asked for, one pack at a time.
  const ladder: [string, string][] = [
    ["single", "five"],
    ["five", "ten"],
    ["ten", "twenty"],
    ["twenty", "fifty"],
    ["fifty", "hundred"],
  ];
  for (const [from, to] of ladder) {
    const u = upsellFor(bundleById(from)!, 1);
    check(`[${choice}] 1 × ${from} offers ${to}`, u?.to.bundle.id === to, u?.to.bundle.id ?? "none");
  }
  check(`[${choice}] 1 × hundred offers nothing`, upsellFor(bundleById("hundred")!, 1) === null);
}

// Spot checks against figures worked by hand, delivery choice on (£3.90
// standard, free next day from £40).
process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "on";
{
  const u = upsellFor(bundleById("single")!, 1)!;
  const c = upsellCopy(u);
  check("1 vial → 5: £16.00 more", u.extraMinor === 1600, String(u.extraMinor));
  check("1 vial → 5: says delivery is paid either way", c.body.startsWith("You're paying £3.90 delivery either way"), c.body);
}
{
  const u = upsellFor(bundleById("ten")!, 1)!;
  const c = upsellCopy(u);
  check("10 → 20 unlocks free delivery", u.unlocksFreeDelivery);
  check("10 → 20: £5.01 away", c.heading === "You're £5.01 away from free next-day delivery", c.heading);
  check("10 → 20: £26.10 more with delivery", u.extraMinor === 2610, String(u.extraMinor));
}
{
  const u = upsellFor(bundleById("five")!, 2)!;
  check("2 × 5 → one 10-pack", u.kind === "same-for-less" && u.to.bundle.id === "ten");
  check("2 × 5 → 10 loses free delivery", u.losesFreeDelivery);
}

if (failures > 0) {
  console.error(`\n${failures} upsell check(s) failed.`);
  process.exit(1);
}
console.log("Upsell checks passed.");
