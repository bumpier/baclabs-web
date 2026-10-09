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
  MAX_EXTRA_VIALS,
  MAX_QUANTITY,
  MIN_QUANTITY,
  TOP_UP_MAX_VIALS,
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
      check(`${at}: to is priced as Stripe charges`, u.to.payableMinor === payable(u.to.goodsMinor));
      check(`${at}: extra is the difference in payable`, u.extraMinor === u.to.payableMinor - u.from.payableMinor);

      if (u.kind === "same-for-less") {
        check(`${at}: same-for-less is one pack`, u.to.quantity === 1 && u.to.extraVials === 0);
        check(`${at}: same-for-less holds the same vials`, u.to.vials === vials);
        check(`${at}: same-for-less costs less`, u.extraMinor < 0, String(u.extraMinor));
      } else if (u.kind === "top-up") {
        const k = u.to.extraVials;
        check(`${at}: top-up keeps the packs`, u.to.bundle.id === b.id && u.to.quantity === q);
        check(`${at}: top-up adds 1..${TOP_UP_MAX_VIALS} vials`, k >= 1 && k <= TOP_UP_MAX_VIALS, String(k));
        check(`${at}: top-up goods are packs plus singles`, u.to.goodsMinor === goods + k * bundleById("single")!.priceMinor);
        check(`${at}: top-up unlocks free delivery`, u.unlocksFreeDelivery);
        check(`${at}: top-up is the fewest vials that do`, k === 1 || !shipsFree(goods + (k - 1) * bundleById("single")!.priceMinor));
        check(`${at}: never a top-up on single vials`, b.id !== "single");
        const beaten = BUNDLES.find((x) => x.vials >= u.to.vials && payable(x.priceMinor) <= u.to.payableMinor);
        check(`${at}: no pack holds as many vials for less`, !beaten, beaten?.id ?? "");
      } else {
        check(`${at}: step-up is one pack`, u.to.quantity === 1 && u.to.extraVials === 0);
        const smallest = Math.min(...bigger.map((x) => x.vials));
        check(`${at}: step-up is the next pack up`, u.to.vials === smallest, `${u.to.vials} vs ${smallest}`);
      }

      // Loose vials already added: no further offer.
      for (let e = 1; e <= MAX_EXTRA_VIALS; e++) {
        check(`${at} + ${e}: no offer once topped up`, upsellFor(b, q, e) === null);
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
  // The 10-pack is the one pack a loose vial takes to free delivery.
  const ladder: [string, string, string][] = [
    ["single", "five", "step-up"],
    ["five", "ten", "step-up"],
    ["ten", "ten", "top-up"],
    ["twenty", "fifty", "step-up"],
    ["fifty", "hundred", "step-up"],
  ];
  for (const [from, to, kind] of ladder) {
    const u = upsellFor(bundleById(from)!, 1);
    check(
      `[${choice}] 1 × ${from} offers ${kind} to ${to}`,
      u?.to.bundle.id === to && u?.kind === kind,
      `${u?.kind ?? "none"} ${u?.to.bundle.id ?? ""}`
    );
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
  check("10 + 1 vial unlocks free delivery", u.kind === "top-up" && u.to.extraVials === 1 && u.unlocksFreeDelivery);
  check("10 + 1 vial: £5.01 away", c.heading === "You're £5.01 away from free next-day delivery", c.heading);
  check("10 + 1 vial: £2.09 more with delivery", u.extraMinor === 209, String(u.extraMinor));
  check("10 + 1 vial: button", c.accept === "Add 1 vial", c.accept);
}
{
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "off";
  const u = upsellFor(bundleById("ten")!, 1)!;
  check("10 + 1 vial, choice off: £3.00 more with delivery", u.extraMinor === 300, String(u.extraMinor));
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "on";
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
