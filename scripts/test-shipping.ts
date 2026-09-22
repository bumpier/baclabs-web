/**
 * Test suite for postage: the service picker, parcel sizing and the
 * SmartTrack request builder. Run with `npm run test:shipping`. Exits
 * non-zero on any failure, like scripts/test-sale.ts. No network, no
 * database.
 */
import { combineUnits, chargeableGrams } from "@/lib/shipping/parcel";
import {
  checkService,
  evaluateSizeFormula,
  selectService,
  type ServiceRule,
} from "@/lib/shipping/select-service";
import { buildShipmentRequest, truncateWords, wrapLines, type LabelInput } from "@/lib/smarttrack/payload";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

// ── Size formulas ────────────────────────────────────────────────
const sides: [number, number, number] = [300, 200, 100];
check("L+W+H", evaluateSizeFormula("L+W+H", sides) === 600);
check("L+2W+2H (girth)", evaluateSizeFormula("L+2W+2H", sides) === 900);
check("L+2(W+H)", evaluateSizeFormula("L+2(W+H)", sides) === 900);
check("L + 2*(W+H) with spaces", evaluateSizeFormula("L + 2*(W+H)", sides) === 900);
check("2x(W+H)+L", evaluateSizeFormula("2x(W+H)+L", sides) === 900);
check("lower case", evaluateSizeFormula("l+w+h", sides) === 600);
check("L*W*H", evaluateSizeFormula("L*W*H", sides) === 6_000_000);
check("unknown letter is refused", evaluateSizeFormula("L+W+G", sides) === null);
check("unbalanced bracket is refused", evaluateSizeFormula("L+2(W+H", sides) === null);
check("trailing operator is refused", evaluateSizeFormula("L+", sides) === null);
check("empty is refused", evaluateSizeFormula("", sides) === null);

// ── Parcels ──────────────────────────────────────────────────────
const vialBox = { weightGrams: 60, lengthMm: 95, widthMm: 45, heightMm: 30 };
{
  const one = combineUnits([{ parcel: vialBox, quantity: 1 }]);
  check("one unit is its own size, longest first", one.lengthMm === 95 && one.widthMm === 45 && one.heightMm === 30, JSON.stringify(one));
  const three = combineUnits([{ parcel: vialBox, quantity: 3 }]);
  check("three units stack on their smallest side", three.heightMm === 90 && three.lengthMm === 95 && three.weightGrams === 180, JSON.stringify(three));
  const unknown = combineUnits([
    { parcel: vialBox, quantity: 1 },
    { parcel: { weightGrams: 10, lengthMm: 0, widthMm: 0, heightMm: 0 }, quantity: 1 },
  ]);
  check("any unmeasured unit makes the size unknown", unknown.lengthMm === 0 && unknown.weightGrams === 70);
}
check("volumetric weight wins when bulkier than heavy", chargeableGrams({ weightGrams: 100, lengthMm: 400, widthMm: 300, heightMm: 200 }, 5000) === 4800);
check("actual weight wins when heavier", chargeableGrams({ weightGrams: 9000, lengthMm: 400, widthMm: 300, heightMm: 200 }, 5000) === 9000);
check("no divisor means actual weight", chargeableGrams({ weightGrams: 100, lengthMm: 400, widthMm: 300, heightMm: 200 }, null) === 100);

// ── Services ─────────────────────────────────────────────────────
const base: ServiceRule = {
  code: "X",
  name: "X",
  active: true,
  priority: 100,
  minWeightGrams: 0,
  maxWeightGrams: 0,
  maxLengthMm: 0,
  maxWidthMm: 0,
  maxHeightMm: 0,
  sizeFormula: "",
  sizeLimitMm: 0,
  volumetricDivisor: null,
  deliveryCountryIsos: [],
};
// Shaped on SmartTrack's documented example: @MINI PACK 72, 0–3 kg,
// 25 × 25 × 25 cm, L+W+H ≤ 90 cm, GB only.
const miniPack: ServiceRule = {
  ...base,
  code: "STYDL3HPA",
  name: "Mini Pack 72",
  priority: 20,
  maxWeightGrams: 3000,
  maxLengthMm: 250,
  maxWidthMm: 250,
  maxHeightMm: 250,
  sizeFormula: "L+W+H",
  sizeLimitMm: 900,
  deliveryCountryIsos: ["GB"],
};
const largeLetter: ServiceRule = {
  ...base,
  code: "LL",
  name: "Large Letter",
  priority: 10,
  maxWeightGrams: 750,
  maxLengthMm: 353,
  maxWidthMm: 250,
  maxHeightMm: 25,
};
const parcel2kg: ServiceRule = { ...base, code: "P2", name: "Parcel 2kg", priority: 30, maxWeightGrams: 2000 };
const parcel20kg: ServiceRule = { ...base, code: "P20", name: "Parcel 20kg", priority: 30, maxWeightGrams: 20000 };
const services = [parcel20kg, miniPack, parcel2kg, largeLetter];

{
  const flat = { weightGrams: 100, lengthMm: 200, widthMm: 150, heightMm: 20 };
  const s = selectService(services, flat, "GB");
  check("a flat light item goes Large Letter (lowest priority value)", s.service?.code === "LL", s.note);
  check("choice is automatic", s.choice === "auto");
}
{
  const s = selectService(services, vialBox, "GB");
  check("a 30 mm deep box is too deep for Large Letter", s.service?.code === "STYDL3HPA", s.service?.code);
  const ll = s.checks.find((c) => c.service.code === "LL")!;
  check("the Large Letter rejection says why", ll.reasons.some((r) => r.includes("does not fit within")), ll.reasons.join("; "));
}
{
  const rotated = { weightGrams: 100, lengthMm: 20, widthMm: 150, heightMm: 200 };
  const s = selectService(services, rotated, "GB");
  check("measured on its side, it still fits Large Letter", s.service?.code === "LL", s.note);
}
{
  const s = selectService(services, vialBox, "FR");
  check("a GB-only service is skipped abroad", s.service?.code !== "STYDL3HPA", s.service?.code);
  const mp = s.checks.find((c) => c.service.code === "STYDL3HPA")!;
  check("…with the reason", mp.reasons.includes("does not deliver to FR"), mp.reasons.join("; "));
}
{
  // A courier-style limit where the combined rule binds before any one side.
  const courier: ServiceRule = {
    ...base,
    code: "C",
    name: "Courier",
    maxLengthMm: 600,
    maxWidthMm: 600,
    maxHeightMm: 600,
    sizeFormula: "L+W+H",
    sizeLimitMm: 900,
  };
  const ok = checkService(courier, { weightGrams: 500, lengthMm: 400, widthMm: 300, heightMm: 200 }, "GB");
  check("900 mm of L+W+H fits a 900 mm limit", ok.fits, ok.reasons.join("; "));
  const over = checkService(courier, { weightGrams: 500, lengthMm: 400, widthMm: 300, heightMm: 250 }, "GB");
  check("every side fits but L+W+H does not", !over.fits && over.reasons.length === 1, over.reasons.join("; "));
  check("…and the reason gives the figure", over.reasons[0] === "L+W+H is 950 mm, over the 900 mm limit", over.reasons[0]);
}
{
  const s = selectService(services, { weightGrams: 1500, lengthMm: 300, widthMm: 300, heightMm: 300 }, "GB");
  check("same priority: the tighter weight band wins", s.service?.code === "P2", s.service?.code);
}
{
  const s = selectService(services, { weightGrams: 0, lengthMm: 100, widthMm: 100, heightMm: 100 }, "GB");
  check("an unweighed parcel gets no service", s.service === null, s.note);
}
{
  const s = selectService(services, { weightGrams: 100, lengthMm: 0, widthMm: 0, heightMm: 0 }, "GB");
  check("an unmeasured parcel only fits services with no size limit", s.service?.code === "P2", s.service?.code);
}
{
  const s = selectService(services, vialBox, "GB", "P20");
  check("an assigned service that fits wins", s.service?.code === "P20" && s.choice === "sku", s.note);
}
{
  const s = selectService(services, vialBox, "GB", "LL");
  check("an assigned service that does not fit falls back", s.service?.code === "STYDL3HPA" && s.choice === "auto", s.note);
  check("…and the note says so", s.note.includes("does not fit"), s.note);
}
{
  const s = selectService([{ ...largeLetter, active: false }], { weightGrams: 100, lengthMm: 200, widthMm: 150, heightMm: 20 }, "GB");
  check("a switched-off service is never chosen", s.service === null);
}
{
  const vol: ServiceRule = { ...base, code: "V", name: "Volumetric", maxWeightGrams: 2000, volumetricDivisor: 5000 };
  const c = checkService(vol, { weightGrams: 500, lengthMm: 400, widthMm: 300, heightMm: 200 }, "GB");
  check("volumetric weight can rule a light, bulky parcel out", !c.fits && c.reasons[0]!.startsWith("volumetric weight"), c.reasons.join("; "));
}
{
  const odd: ServiceRule = { ...base, code: "O", name: "Odd", sizeFormula: "L+W+Q", sizeLimitMm: 900 };
  const c = checkService(odd, vialBox, "GB");
  check("an unparseable size rule is refused, not ignored", !c.fits && c.reasons[0]!.includes("not understood"), c.reasons.join("; "));
}
check("no services at all says so", selectService([], vialBox, "GB").note.includes("No postal services"));

// ── Address wrapping ─────────────────────────────────────────────
check("short lines pass through", JSON.stringify(wrapLines(["1 High St", ""], 30)) === JSON.stringify(["1 High St"]));
{
  const lines = wrapLines(["Flat 4, The Old Granary, 27 Riverside Wharf Industrial Estate"], 30);
  check("a long line wraps at word breaks", lines !== null && lines.every((l) => l.length <= 30), JSON.stringify(lines));
  check("wrapping loses no words", lines?.join(" ") === "Flat 4, The Old Granary, 27 Riverside Wharf Industrial Estate");
}
check("more than three lines is refused", wrapLines(["aaaa bbbb cccc dddd"], 4) === null);
check("a word longer than a line is refused, not cut", wrapLines(["Supercalifragilisticexpialidocious"], 20) === null);
check("truncateWords cuts at a space", truncateWords("Bacteriostatic Water 10ml vial — 5-pack", 30) === "Bacteriostatic Water 10ml vial");

// ── SmartTrack request ───────────────────────────────────────────
const input: LabelInput = {
  reference: "3f9a1c2d-0000-4000-8000-000000000000-1",
  orderRef: "3F9A1C2D",
  serviceCode: "STYDL3HPA",
  labelSize: "100x150",
  sender: {
    contactName: "Dispatch",
    company: "BacLab",
    addressLine1: "Unit 7",
    addressLine2: "Riverside Industrial Estate",
    city: "Manchester",
    postcode: "M1 1AA",
    countryIso: "GB",
    phone: "",
    email: "",
  },
  receiver: {
    name: "Sam Customer",
    email: "sam@example.com",
    phone: "07700900000",
    address: { line1: "22 Acacia Avenue", line2: null, city: "Leeds", country: "gb", postalCode: "LS1 1AA" },
  },
  parcel: { weightGrams: 180, lengthMm: 95, widthMm: 45, heightMm: 90 },
  items: [{ skuCode: "BACLAB-10ML-X5", description: "Bacteriostatic Water 10ml vial — 5-pack", quantity: 2, unitWeightGrams: 90, lineTotalMinor: 4398 }],
  goodsTotalMinor: 4398,
  currency: "GBP",
  deliveryInstructions: "Leave at doorstep",
};
{
  const { request, problems } = buildShipmentRequest(input);
  check("a complete order builds", request !== null && problems.length === 0, problems.join("; "));
  const p = request!.parcel[0]!;
  check("weight goes in kg", p.weight === 0.18, String(p.weight));
  check("sizes go in cm", p.length === 9.5 && p.width === 4.5 && p.height === 9, JSON.stringify(p));
  check("country is upper-cased", request!.receiver_country_iso === "GB");
  check("item value is per unit, in pounds", p.items![0]!.item_value === 21.99, String(p.items![0]!.item_value));
  check("item weight is per unit, in kg", p.items![0]!.weight === 0.09);
  check("declared value is whole pounds", request!.value === 44);
  check("the description carries the delivery instructions", request!.description === "Leave at doorstep", request!.description);
  check("the contents travel per item instead", p.items![0]!.item_description.startsWith("Bacteriostatic Water"), p.items![0]!.item_description);
  check("empty optional fields are left undefined", request!.sender_telephone === undefined);
  check("the order reference is what we sent", request!.order_reference === input.reference);
}
{
  const { request, problems } = buildShipmentRequest({
    ...input,
    receiver: { ...input.receiver, address: { ...input.receiver.address, postalCode: "" } },
  });
  check("a missing postcode blocks the label", request === null && problems.some((p) => p.includes("postcode")), problems.join("; "));
}
{
  const { request, problems } = buildShipmentRequest({ ...input, deliveryInstructions: "Leave with neighbour at number 12" });
  check("over-long instructions block the label rather than being cut", request === null && problems.some((p) => p.includes("Delivery instructions")), problems.join("; "));
}
{
  const { problems } = buildShipmentRequest({ ...input, deliveryInstructions: "  " });
  check("empty instructions block the label (SmartTrack requires the field)", problems.some((p) => p.includes("Delivery instructions is missing")), problems.join("; "));
}
{
  const { problems } = buildShipmentRequest({ ...input, parcel: { ...input.parcel, lengthMm: 0 } });
  check("an unmeasured parcel blocks the label", problems.some((p) => p.includes("size is not set")), problems.join("; "));
}
{
  const { problems } = buildShipmentRequest({ ...input, sender: { ...input.sender, addressLine1: "" } });
  check("a warehouse without an address blocks the label", problems.some((p) => p.includes("Warehouse address")), problems.join("; "));
}
{
  const { request, warnings } = buildShipmentRequest({
    ...input,
    receiver: { ...input.receiver, email: `${"a".repeat(50)}@example.com` },
  });
  check("an over-long optional email is left off, with a warning", request !== null && request.receiver_email === undefined && warnings.length === 1);
}

if (failures > 0) {
  console.error(`\n${failures} shipping check(s) failed`);
  process.exit(1);
}
console.log("✓ shipping: all checks passed");
