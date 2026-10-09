/**
 * Test suite for orders with loose vials: priceOrder in config/funnel.ts,
 * the order lines from lib/order-items.ts, the readers of Order.items they
 * pass through, and the combined stock check. Run with
 * `npm run test:pricing`. Exits non-zero on any failure.
 */
import {
  BUNDLES,
  MAX_EXTRA_VIALS,
  MAX_QUANTITY,
  MIN_QUANTITY,
  SINGLE_BUNDLE,
  bundleById,
  priceOrder,
} from "@/config/funnel";
import { buildOrderItems, isAddOnLine } from "@/lib/order-items";
import { soldLines } from "@/lib/inventory/demand";
import { coversDemand, expandDemand } from "@/lib/inventory/allocation";
import { purchaseContents } from "@/lib/meta-capi-event";
import { upgradeEligibility } from "@/lib/plans/upgrade";
import { welcomeItem } from "@/lib/mailing-list";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const cents = (s: string) => Math.round(Number(s) * 100);

// ── priceOrder ─────────────────────────────────────────────────────
for (const b of BUNDLES) {
  for (let q = MIN_QUANTITY; q <= MAX_QUANTITY; q++) {
    for (let e = -1; e <= MAX_EXTRA_VIALS + 1; e++) {
      const at = `${q} × ${b.id} + ${e}`;
      const p = priceOrder(b, q, e);
      const sellable = e >= 0 && e <= MAX_EXTRA_VIALS && (e === 0 || b.id !== SINGLE_BUNDLE.id);
      check(`${at}: priced only when sellable`, (p !== null) === sellable);
      if (!p) continue;
      check(`${at}: goods are packs plus singles`, p.goodsMinor === b.priceMinor * q + SINGLE_BUNDLE.priceMinor * e);
      check(`${at}: vials count the loose ones`, p.vials === b.vials * q + e);

      // The order lines reconcile to the goods, in pounds and in dollars.
      const goodsUsd = ((p.goodsMinor / 100) * 1.27).toFixed(2);
      const lines = buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: b, quantity: q, priced: p, goodsUsd });
      check(`${at}: one line, or two with loose vials`, lines.length === (e > 0 ? 2 : 1));
      check(
        `${at}: lineTotals sum to the goods`,
        lines.reduce((n, l) => n + cents(l.lineTotal), 0) === p.goodsMinor
      );
      check(
        `${at}: lineTotalUsd sums to the USD basis`,
        lines.reduce((n, l) => n + cents(l.lineTotalUsd), 0) === cents(goodsUsd)
      );
      check(`${at}: line vials sum to the order`, lines.reduce((n, l) => n + l.qty, 0) === p.vials);
      check(`${at}: only the loose line is an add-on`, lines.every((l, i) => isAddOnLine(l) === (i === 1)));
    }
  }
}

// ── An order of a 10-pack and one loose vial, through every reader ──
{
  const ten = bundleById("ten")!;
  const priced = priceOrder(ten, 1, 1)!;
  const lines = buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: ten, quantity: 1, priced, goodsUsd: "52.04" });
  const items = JSON.stringify([...lines, welcomeItem("p", "baclab-10ml", 1)]);

  const sold = soldLines(items);
  check("10+1: sells one 10-pack", sold.some((l) => l.skuCode === "BACLAB-10ML-X10" && l.quantity === 1), JSON.stringify(sold));
  check("10+1: sells one single", sold.some((l) => l.skuCode === "BACLAB-10ML-X1" && l.quantity === 1), JSON.stringify(sold));
  check("10+1: the welcome vial is the loose vial SKU", sold.some((l) => l.skuCode === "BACLAB-10ML" && l.quantity === 1));
  check("10+1: line totals still match the goods", sold.reduce((n, l) => n + l.lineTotalMinor, 0) === priced.goodsMinor);

  const contents = purchaseContents(items);
  check("10+1: Meta sees both paid lines", contents.length >= 2, JSON.stringify(contents));

  const verdict = upgradeEligibility(
    { kind: "sale", status: "paid", planId: null, paidAt: new Date(), items },
    new Date()
  );
  check("10+1: not offered the plan upgrade", !verdict.eligible);
}

// ── The combined stock check ────────────────────────────────────────
{
  // Both packs made up from the same shelf vial: ten vials on the shelf,
  // a 10-pack and a single need eleven.
  const vial = { id: "vial", code: "BACLAB-10ML", components: [] };
  const x10 = { id: "x10", code: "BACLAB-10ML-X10", components: [{ componentId: "vial", quantity: 10 }] };
  const x1 = { id: "x1", code: "BACLAB-10ML-X1", components: [{ componentId: "vial", quantity: 1 }] };
  const demand = expandDemand([
    { sku: x10, quantity: 1 },
    { sku: x1, quantity: 1 },
  ]);
  check("kits share the vial: 11 asked of it", demand.get("vial") === 11, String(demand.get("vial")));
  check("kits share the vial: 10 on the shelf is short", !coversDemand(demand, new Map([["vial", 10]])));
  check("kits share the vial: 11 on the shelf covers it", coversDemand(demand, new Map([["vial", 11]])));

  // A pre-packed 10-pack and a single kit draw on different shelves.
  const packed = { id: "x10p", code: "BACLAB-10ML-X10", components: [] };
  const mixed = expandDemand([
    { sku: packed, quantity: 1 },
    { sku: x1, quantity: 1 },
  ]);
  check(
    "pre-packed + kit: each shelf checked on its own",
    coversDemand(mixed, new Map([["x10p", 1], ["vial", 1]])) && !coversDemand(mixed, new Map([["x10p", 1]]))
  );
  check("welcome vial adds to the same shelf", expandDemand([{ sku: x10, quantity: 1 }, { sku: vial, quantity: 1 }]).get("vial") === 11);
}

if (failures > 0) {
  console.error(`\n${failures} order pricing check(s) failed.`);
  process.exit(1);
}
console.log("Order pricing checks passed.");
