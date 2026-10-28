/**
 * Test suite for orders with loose vials and Lab Kits: priceOrder in config/funnel.ts,
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
  LAB_KIT,
  STARTER_KIT,
  bundleById,
  kitPriceMinor,
  labKitContents,
  priceOrder,
  priceStarterKit,
} from "@/config/funnel";
import { checkCompliance } from "@/lib/content-rules";
import { STARTER_KIT_COPY } from "@/content/starter-kit";
import { buildOrderItems, isAddOnLine, isKitLine, kitPartsFor } from "@/lib/order-items";
import { LAB_KIT_SKU_CODE, soldLines } from "@/lib/inventory/demand";
import { vialsOnOrder } from "@/lib/vial-stock";
import { reorderOffer } from "@/lib/reorder";
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

// ── Lab Kits ───────────────────────────────────────────────────────
{
  // The kit price follows the pack: £5.99, £4.99, then £3.99 from the 10-pack.
  const expected: Record<string, number> = { single: 599, five: 499, ten: 399, twenty: 399, fifty: 399, hundred: 399 };
  for (const b of BUNDLES) check(`kit price with ${b.id}`, kitPriceMinor(b) === expected[b.id], String(kitPriceMinor(b)));

  // Up to one kit per vial, loose vials included; never negative or fractional.
  for (const b of BUNDLES) {
    for (const [q, e] of [[1, 0], [2, 0], [1, b.id === SINGLE_BUNDLE.id ? 0 : 3]] as const) {
      const vials = b.vials * q + e;
      for (const k of [-1, 0, 1, vials, vials + 1, 1.5]) {
        const at = `${q} × ${b.id} + ${e} + ${k} kits`;
        const p = priceOrder(b, q, e, k);
        check(`${at}: priced only up to one kit per vial`, (p !== null) === (Number.isInteger(k) && k >= 0 && k <= vials));
        if (!p) continue;
        // A lone vial's kit is the Starter Kit's £4.00; every other kit is at the pack's price.
        const unit = b.id === "single" && q === 1 && e === 0 ? 400 : kitPriceMinor(b);
        check(`${at}: goods include the kits`, p.goodsMinor === b.priceMinor * q + SINGLE_BUNDLE.priceMinor * e + unit * k);
        check(`${at}: kits do not change the vial count`, p.vials === vials);

        const goodsUsd = ((p.goodsMinor / 100) * 1.27).toFixed(2);
        const lines = buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: b, quantity: q, priced: p, goodsUsd, kitProductId: "kit" });
        check(`${at}: a kit line only with kits`, lines.filter(isKitLine).length === (k > 0 ? 1 : 0));
        check(`${at}: lineTotals sum to the goods`, lines.reduce((n, l) => n + cents(l.lineTotal), 0) === p.goodsMinor);
        check(`${at}: lineTotalUsd sums to the USD basis`, lines.reduce((n, l) => n + cents(l.lineTotalUsd), 0) === cents(goodsUsd));
        check(`${at}: vial lines still sum to the vials`, lines.filter((l) => !isKitLine(l)).reduce((n, l) => n + l.qty, 0) === p.vials);
        check(`${at}: the kit line is not a loose-vial add-on`, lines.filter(isKitLine).every((l) => !isAddOnLine(l)));
      }
    }
  }

  // The agreed example orders.
  const total = (id: string, q: number, k: number) => priceOrder(bundleById(id)!, q, 0, k)!.goodsMinor;
  check("1 vial + 1 kit is the Starter Kit's £9.99", total("single", 1, 1) === 999);
  check("2 vials + 2 kits = £23.96", total("single", 2, 2) === 2396);
  check("5-pack + 5 kits = £46.94", total("five", 1, 5) === 4694);
  check("10-pack + 10 kits = £74.89", total("ten", 1, 10) === 7489);
  check("20-pack + 20 kits = £144.79", total("twenty", 1, 20) === 14479);

  let threw = false;
  try {
    const ten = bundleById("ten")!;
    buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: ten, quantity: 1, priced: priceOrder(ten, 1, 0, 1)!, goodsUsd: "1" });
  } catch {
    threw = true;
  }
  check("kits without the kit's Product row are refused", threw);

  // A 10-pack, a loose vial and 10 kits, through every reader.
  const ten = bundleById("ten")!;
  const priced = priceOrder(ten, 1, 1, 10)!;
  const lines = buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: ten, quantity: 1, priced, goodsUsd: "100.00", kitProductId: "kit" });
  const items = JSON.stringify([...lines, welcomeItem("p", "baclab-10ml", 1)]);
  const kitLine = lines.find(isKitLine)!;
  check("10+1+10k: the kit line is on the kit's own product", kitLine.productId === "kit" && kitLine.qty === 10);

  const sold = soldLines(items);
  check("10+1+10k: sells ten of the kit SKU", sold.some((l) => l.skuCode === LAB_KIT_SKU_CODE && l.quantity === 10), JSON.stringify(sold));
  check("10+1+10k: still sells one 10-pack", sold.some((l) => l.skuCode === "BACLAB-10ML-X10" && l.quantity === 1));
  check("10+1+10k: line totals still match the goods", sold.reduce((n, l) => n + l.lineTotalMinor, 0) === priced.goodsMinor);

  check("10+1+10k: vial stock counts 12 vials, not 22", vialsOnOrder(items) === 12, String(vialsOnOrder(items)));

  const offer = reorderOffer(items);
  check("10+1+10k: reorder still offers the 10-pack", offer?.bundle.id === "ten" && offer.extraVials === 1, JSON.stringify(offer));

  const contents = purchaseContents(items);
  check("10+1+10k: Meta sees the kits as the kit", contents.some((c) => c.id === LAB_KIT.sku && c.quantity === 10), JSON.stringify(contents));

  // What the packer is told to put in: each part, multiplied out.
  const parts = new Map(kitPartsFor(10).map((p) => [p.name, p.quantity]));
  check("10 kits: 30 syringes", parts.get("Syringe") === 30);
  check("10 kits: 60 long needles", parts.get("Long needle") === 60);
  check("10 kits: no insulin needles", !parts.has("Insulin needle"));
  check("10 kits: 60 alcohol swabs", parts.get("Alcohol swab") === 60);

  // In warehouse mode the kit SKU expands to the same parts on the pick list.
  const kitSku = {
    id: "kit",
    code: LAB_KIT_SKU_CODE,
    components: LAB_KIT.parts.map((p) => ({ componentId: p.sku, quantity: p.perKit })),
  };
  const demand = expandDemand([{ sku: kitSku, quantity: 10 }]);
  check(
    "10 kits: the pick list asks for the same parts",
    kitPartsFor(10).every((p) => demand.get(p.sku) === p.quantity),
    JSON.stringify([...demand])
  );
}

// ── The Starter Kit ────────────────────────────────────────────────
{
  const p = priceStarterKit();
  const fromBuyBox = priceOrder(SINGLE_BUNDLE, 1, 0, 1)!;
  check("starter: the same £9.99 ticked in the buy box", fromBuyBox.goodsMinor === p.goodsMinor && fromBuyBox.kitUnitMinor === p.kitUnitMinor);
  check("starter: £9.99 in all", p.goodsMinor === STARTER_KIT.priceMinor && STARTER_KIT.priceMinor === 999);
  check("starter: the single vial at its own price", p.packsMinor === SINGLE_BUNDLE.priceMinor && p.vials === 1);
  check("starter: one kit, at what is left", p.kits === 1 && p.kitsMinor === 999 - SINGLE_BUNDLE.priceMinor);

  const lines = buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: SINGLE_BUNDLE, quantity: 1, priced: p, goodsUsd: "12.69", kitProductId: "kit" });
  check("starter: a vial line and a kit line", lines.length === 2 && isKitLine(lines[1]!) && !isKitLine(lines[0]!));
  check("starter: lines sum to £9.99", lines.reduce((n, l) => n + cents(l.lineTotal), 0) === 999);
  check("starter: USD lines sum to the basis", lines.reduce((n, l) => n + cents(l.lineTotalUsd), 0) === cents("12.69"));
  const items = JSON.stringify(lines);
  check("starter: one vial for the vial stock", vialsOnOrder(items) === 1);
  check("starter: one kit SKU sold", soldLines(items).some((l) => l.skuCode === LAB_KIT_SKU_CODE && l.quantity === 1));

  // The landing page's copy, through the same rules as a guide.
  const copy = Object.values(STARTER_KIT_COPY).flatMap((v) =>
    typeof v === "string" ? [v] : v.flatMap((i) => [i.name, i.note])
  );
  const violations = checkCompliance(copy);
  check("starter page copy passes the content rules", violations.length === 0, JSON.stringify(violations));
  check("starter page lists every part", LAB_KIT.parts.every((part) => copy.some((t) => t.includes(`${part.name.toLowerCase()}s`))));
  check("kit contents read as words", labKitContents(10) === "30 syringes, 60 long needles and 60 alcohol swabs", labKitContents(10));
}

if (failures > 0) {
  console.error(`\n${failures} order pricing check(s) failed.`);
  process.exit(1);
}
console.log("Order pricing checks passed.");
