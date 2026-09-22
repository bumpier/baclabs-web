/**
 * Test suite for the stock arithmetic in lib/inventory/. Run with
 * `npm run test:inventory`. Exits non-zero on any failure, like
 * scripts/test-sale.ts. No database: these are the pure rules that
 * lib/inventory/store.ts applies.
 */
import { expandDemand, kitsAvailable, planAllocation } from "@/lib/inventory/allocation";
import { normaliseCode, skuCodeError, locationCodeError } from "@/lib/inventory/codes";
import { soldLines, storefrontSkuCodes, VIAL_SKU_CODE } from "@/lib/inventory/demand";
import {
  decideScan,
  isPickComplete,
  locationScanCode,
  orderScanCode,
  parseScan,
  productScanCode,
} from "@/lib/inventory/scan";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── Codes ────────────────────────────────────────────────────────
check("codes are upper-cased and trimmed", normaliseCode("  baclab-10ml-x5 ") === "BACLAB-10ML-X5");
check("letters-only code is valid", skuCodeError("VIAL") === null);
check("digits-only code is valid", skuCodeError("100234") === null);
check("mixed code is valid", skuCodeError("BL-10ML_X3.V2") === null);
check("space is refused", skuCodeError("BL 10ML") !== null);
check("leading dash is refused", skuCodeError("-BL") !== null);
check("trailing dot is refused", skuCodeError("BL.") !== null);
check("empty is refused", skuCodeError("") !== null);
check("41 characters is refused", skuCodeError("A".repeat(41)) !== null);
check("40 characters is fine", skuCodeError("A".repeat(40)) === null);
check("lower case must be normalised first", skuCodeError("bl-1") !== null);
check("location A-01-02 is valid", locationCodeError("A-01-02") === null);

// ── Allocation ───────────────────────────────────────────────────
const slots = [
  { locationId: "overflow", locationCode: "Z-99", pickSequence: 900, quantity: 50 },
  { locationId: "face-b", locationCode: "A-02", pickSequence: 10, quantity: 4 },
  { locationId: "face-a", locationCode: "A-01", pickSequence: 10, quantity: 3 },
  { locationId: "empty", locationCode: "A-00", pickSequence: 1, quantity: 0 },
];

{
  const plan = planAllocation(2, slots);
  check("small order comes from the first pick face", same(plan.takes, [{ locationId: "face-a", quantity: 2 }]), JSON.stringify(plan));
  check("small order has no shortfall", plan.shortfall === 0);
}
{
  const plan = planAllocation(9, slots);
  check(
    "pick faces drain before the overflow, in code order on a tie",
    same(plan.takes, [
      { locationId: "face-a", quantity: 3 },
      { locationId: "face-b", quantity: 4 },
      { locationId: "overflow", quantity: 2 },
    ]),
    JSON.stringify(plan.takes)
  );
  check("an empty slot is never picked from", !plan.takes.some((t) => t.locationId === "empty"));
}
{
  const plan = planAllocation(60, slots);
  check("takes everything available when short", plan.takes.reduce((n, t) => n + t.quantity, 0) === 57);
  check("reports the shortfall", plan.shortfall === 3, String(plan.shortfall));
}
check("zero required takes nothing", same(planAllocation(0, slots), { takes: [], shortfall: 0 }));
check("no stock is all shortfall", same(planAllocation(5, []), { takes: [], shortfall: 5 }));
check("input slots are not reordered", slots[0]!.locationId === "overflow");

// ── Kits ─────────────────────────────────────────────────────────
const vial = { id: "vial", code: "BACLAB-10ML", components: [] };
const triple = { id: "x3", code: "BACLAB-10ML-X3", components: [{ componentId: "vial", quantity: 3 }] };
const prepackedTwin = { id: "twin", code: "BACLAB-10ML-TWIN", components: [] };

{
  const demand = expandDemand([{ sku: triple, quantity: 1 }]);
  check("selling a triple-pack kit takes three vials", same([...demand], [["vial", 3]]), JSON.stringify([...demand]));
}
{
  const demand = expandDemand([{ sku: triple, quantity: 2 }]);
  check("two triple-packs take six vials", demand.get("vial") === 6);
}
{
  const demand = expandDemand([
    { sku: triple, quantity: 1 },
    { sku: vial, quantity: 1 },
  ]);
  check("a triple and a single of the same vial are asked for as four", demand.get("vial") === 4 && demand.size === 1);
}
{
  const demand = expandDemand([{ sku: prepackedTwin, quantity: 2 }]);
  check("a pre-packed pack is its own stock, not its vials", same([...demand], [["twin", 2]]));
}

check("kits available: the scarcest component decides", kitsAvailable([{ quantity: 3, available: 10 }, { quantity: 1, available: 2 }]) === 2);
check("kits available: rounds down", kitsAvailable([{ quantity: 3, available: 8 }]) === 2);
check("kits available: none without components", kitsAvailable([]) === 0);
check("kits available: negative stock counts as none", kitsAvailable([{ quantity: 1, available: -4 }]) === 0);

// ── Order items → SKUs ───────────────────────────────────────────
{
  const lines = soldLines(
    JSON.stringify([
      { productId: "p", slug: "baclab-10ml", name: "Vial", qty: 10, unitPrice: "21.99", lineTotal: "43.98", bundleId: "five", bundleQty: 2 },
    ])
  );
  check("bundle line reads as the bundle SKU", lines[0]?.skuCode === "BACLAB-10ML-X5", lines[0]?.skuCode);
  check("bundle line quantity is packs, not vials", lines[0]?.quantity === 2);
  check("line total is carried in pence", lines[0]?.lineTotalMinor === 4398);
}
{
  const lines = soldLines(JSON.stringify([{ slug: "baclab-10ml", qty: 7, bundleId: "seven", bundleQty: 1, lineTotal: "25.00" }]));
  check("a retired bundle keeps the code it was sold under", lines[0]?.skuCode === "BACLAB-10ML-X7", lines[0]?.skuCode);
}
{
  const lines = soldLines(JSON.stringify([{ slug: "baclab-10ml", qty: 3, unitPrice: "5.99" }]));
  check("a pre-bundle order reads as vials", lines[0]?.skuCode === VIAL_SKU_CODE && lines[0]?.quantity === 3);
  check("pre-bundle line total falls back to unit × qty", lines[0]?.lineTotalMinor === 1797, String(lines[0]?.lineTotalMinor));
}
{
  const codes = storefrontSkuCodes();
  check("every storefront pack has a valid SKU code", codes.every((c) => skuCodeError(c.code) === null));
  check("storefront SKU codes are unique", new Set(codes.map((c) => c.code)).size === codes.length);
}

// ── Scanning ─────────────────────────────────────────────────────
check("SKU codes cannot take the pick-label prefix", skuCodeError("ORD-123") !== null);
check("SKU codes cannot take the shelf prefix", skuCodeError("LOC-A1") !== null);
check("pick-label code", orderScanCode("3f9a1c2d-0000-4000-8000-000000000000") === "ORD-3F9A1C2D");
check("shelf code", locationScanCode("A-01-02") === "LOC-A-01-02");
check("product code prefers the maker's barcode", productScanCode({ code: "BL-1", barcode: "5012345678900" }) === "5012345678900");
check("product code falls back to the SKU code", productScanCode({ code: "BL-1", barcode: null }) === "BL-1");
check("a pick label parses, any case", same(parseScan("ord-3f9a1c2d"), { kind: "order", ref: "3F9A1C2D" }));
check("a malformed pick label is unreadable", parseScan("ORD-XYZ") === null);
check("a shelf parses", same(parseScan(" LOC-A-01\r"), { kind: "location", code: "A-01" }));
check("anything else is a product, as scanned", same(parseScan("5012345678900"), { kind: "product", value: "5012345678900" }));
check("an empty scan is unreadable", parseScan("  \n") === null);

const pickLines = [
  { id: "a", locationCode: "A-01", skuCode: "BACLAB-10ML", skuBarcode: "5012345678900", quantity: 3, picked: 0 },
  { id: "b", locationCode: "Z-99", skuCode: "BACLAB-10ML", skuBarcode: "5012345678900", quantity: 2, picked: 0 },
];
{
  const d = decideScan(pickLines, { kind: "location", code: "A-01" });
  check("the right shelf is a good scan that ticks off its line", d.ok && same(d.updates, [{ lineId: "a", picked: 3 }]), JSON.stringify(d));
}
{
  const d = decideScan(pickLines, { kind: "location", code: "B-07" });
  check("the wrong shelf is a bad scan that names the right ones", !d.ok && d.message.includes("A-01, Z-99"), JSON.stringify(d));
}
{
  const d = decideScan([{ ...pickLines[0]!, picked: 3 }, pickLines[1]!], { kind: "location", code: "A-01" });
  check("a shelf already picked is a bad scan", !d.ok && d.message.includes("already picked"));
}
{
  const d = decideScan(pickLines, { kind: "product", value: "5012345678900" });
  check("the right item by maker's barcode counts one", d.ok && same(d.updates, [{ lineId: "a", picked: 1 }]), JSON.stringify(d));
}
{
  const d = decideScan(pickLines, { kind: "product", value: "baclab-10ml" });
  check("the right item by SKU code counts one, any case", d.ok && d.updates[0]!.picked === 1);
}
{
  const d = decideScan([{ ...pickLines[0]!, picked: 3 }, pickLines[1]!], { kind: "product", value: "BACLAB-10ML" });
  check("item scans move on to the next line once the first is full", d.ok && same(d.updates, [{ lineId: "b", picked: 1 }]) && d.message.includes("4 of 5"), JSON.stringify(d));
}
{
  const d = decideScan(pickLines.map((l) => ({ ...l, picked: l.quantity })), { kind: "product", value: "BACLAB-10ML" });
  check("one item too many is a bad scan", !d.ok && d.message.includes("Already have all 5"), JSON.stringify(d));
}
{
  const d = decideScan(pickLines, { kind: "product", value: "BACLAB-10ML-X5" });
  check("the wrong item is a bad scan", !d.ok && d.message.includes("not on this order"));
}
{
  const d = decideScan(pickLines, { kind: "order", ref: "3F9A1C2D" });
  check("a pick label mid-order is not counted", !d.ok);
}
{
  const short = [{ ...pickLines[0]!, picked: 3 }, { id: "s", locationCode: null, skuCode: "BACLAB-10ML", skuBarcode: null, quantity: 1, picked: 0 }];
  check("a shortfall line cannot be scanned off", !decideScan(short, { kind: "product", value: "BACLAB-10ML" }).ok);
  check("an order with a shortfall is never complete", !isPickComplete(short));
}
check("complete when every unit is picked", isPickComplete(pickLines.map((l) => ({ ...l, picked: l.quantity }))));
check("not complete with one unit to go", !isPickComplete([{ ...pickLines[0]!, picked: 3 }, { ...pickLines[1]!, picked: 1 }]));
check("an empty pick list is not complete", !isPickComplete([]));

if (failures > 0) {
  console.error(`\n${failures} inventory check(s) failed`);
  process.exit(1);
}
console.log("✓ inventory: all checks passed");
