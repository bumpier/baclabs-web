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
import {
  STANDARD_DELIVERY,
  deliveryDetailAt,
  deliveryMinorFor,
  deliveryOptionById,
  deliveryOptionsFor,
  deliveryOptionsSentence,
  freeDeliveryName,
  nextDayOffered,
  otherDeliveryOptionsLine,
  quotedDeliveryOption,
} from "@/config/funnel";
import { formatDeliveryDay, nextDayDeadline } from "@/lib/delivery-date";
import { buildShipmentRequest, cleanDeliveryInstructions, labelReference, LIMITS, truncateWords, wrapLines, wrapNarrowest, type LabelInput } from "@/lib/smarttrack/payload";

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
  deliveryOption: "",
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

// ── The delivery option the customer paid for ────────────────────
{
  const tracked: ServiceRule = { ...base, code: "T48", name: "Tracked 48", priority: 10, deliveryOption: "standard" };
  const nextDay: ServiceRule = { ...base, code: "ND", name: "Amazon Next Day", priority: 30, deliveryOption: "next_day" };
  const linked = [tracked, nextDay];

  const paidNextDay = selectService(linked, vialBox, "GB", null, "next_day");
  check("next day paid for goes next day, though a cheaper service fits", paidNextDay.service?.code === "ND", paidNextDay.note);
  const t48 = paidNextDay.checks.find((c) => c.service.code === "T48")!;
  check("…and the others say why", !t48.fits && t48.reasons[0]!.includes("Next day"), t48.reasons.join("; "));

  const paidStandard = selectService(linked, vialBox, "GB", null, "standard");
  check("standard paid for goes standard", paidStandard.service?.code === "T48", paidStandard.note);

  const noChoice = selectService(linked, vialBox, "GB");
  check("an order with no recorded choice is worked out as before", noChoice.service?.code === "T48", noChoice.note);

  const unlinked = selectService([parcel2kg, parcel20kg], vialBox, "GB", null, "next_day");
  check("with nothing linked to the option, no service is chosen", unlinked.service === null, unlinked.note);
  check("…and the note says to link one", unlinked.note.includes("No service is linked to Next day"), unlinked.note);
  check("…while the order page still sees what fits", unlinked.checks.some((c) => c.fits));

  const skuPinned = selectService(linked, vialBox, "GB", "T48", "next_day");
  check("a SKU's own service does not override the paid option", skuPinned.service?.code === "ND", skuPinned.note);

  const offLinked = selectService([{ ...nextDay, active: false }, tracked], vialBox, "GB", null, "next_day");
  check(
    "a switched-off linked service does not count as linked",
    offLinked.service === null && offLinked.note.includes("No service is linked"),
    offLinked.note
  );
}

// ── Delivery instructions typed by customers and staff ───────────
check("blank instructions are none", cleanDeliveryInstructions("   ") === null && cleanDeliveryInstructions(undefined) === null);
check("instructions are one line with single spaces", cleanDeliveryInstructions("  Leave   with\nneighbour ") === "Leave with neighbour");
{
  const long = cleanDeliveryInstructions("Please leave it with the neighbour at number twelve")!;
  check("long instructions are cut at a word, within 30", long.length <= 30 && long === "Please leave it with the", long);
}

// ── Checkout delivery options and prices ─────────────────────────
{
  delete process.env.NEXT_PUBLIC_DELIVERY_CHOICE;
  check("switched off, no delivery choice is offered", deliveryOptionsFor(2000).length === 0);
  check("…the quoted delivery is the single Stripe rate, £2.99", deliveryMinorFor(2000) === 299, String(deliveryMinorFor(2000)));
  check("…free from £40", deliveryMinorFor(3999) === 299 && deliveryMinorFor(4000) === 0);
  check("…and next day is promised nowhere", !nextDayOffered());
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "on";
  const byId = (minor: number) => Object.fromEntries(deliveryOptionsFor(minor).map((o) => [o.option.id, o.priceMinor]));
  const under = byId(3999);
  check("under £40 Standard is £3.90 and next day £5", under.standard === 390 && under.next_day === 500, JSON.stringify(under));
  check("…and they are the only options", Object.keys(under).join() === "standard,next_day", JSON.stringify(under));
  const over = byId(4000);
  check("at £40 next day is the only option", Object.keys(over).join() === "next_day", JSON.stringify(over));
  check("…and it is free", over.next_day === 0, JSON.stringify(over));
  check("the storefront's quoted delivery is the Standard price", deliveryMinorFor(2000) === 390 && deliveryMinorFor(4000) === 0);
  check("Standard is offered first, so Stripe preselects it", deliveryOptionsFor(2000)[0]?.option.id === "standard");
  check(
    "the purchase block quotes Standard under £40 and next day from £40",
    quotedDeliveryOption(3999).id === "standard" && quotedDeliveryOption(4000).id === "next_day",
  );
  check("…lists next day beside Standard under £40", otherDeliveryOptionsLine(3999) === "Next day £5.00", otherDeliveryOptionsLine(3999));
  check("…and nothing beside the free next day", otherDeliveryOptionsLine(4000) === "", otherDeliveryOptionsLine(4000));
  check("the free delivery is named next day", freeDeliveryName() === "next-day delivery", freeDeliveryName());
  check(
    "the FAQ sentence says Standard is under £40 and next day free from £40",
    deliveryOptionsSentence().includes("£3.90 on orders under £40") && deliveryOptionsSentence().includes("£5, free from £40"),
    deliveryOptionsSentence(),
  );
  check("next day is offered", nextDayOffered());
  delete process.env.NEXT_PUBLIC_DELIVERY_CHOICE;
  check("switched off, the free delivery is not named", freeDeliveryName() === "UK delivery", freeDeliveryName());
}

// ── Next-day dates, in UK time ───────────────────────────────────
{
  const at = (iso: string) => nextDayDeadline(new Date(iso));
  const days = (iso: string) => `${at(iso).dispatchDayKey} > ${at(iso).deliveryDayKey}`;
  // 6 Oct 2026 is a Tuesday, in BST (UTC+1).
  check("before 3pm on a weekday: out today, there tomorrow", days("2026-10-06T13:59:00Z") === "2026-10-06 > 2026-10-07", days("2026-10-06T13:59:00Z"));
  check("…to beat today's 3pm, 14:00 UTC in summer", at("2026-10-06T13:59:00Z").cutoff.toISOString() === "2026-10-06T14:00:00.000Z");
  check("at 3pm exactly: out tomorrow, there the day after", days("2026-10-06T14:00:00Z") === "2026-10-07 > 2026-10-08", days("2026-10-06T14:00:00Z"));
  check("…and the cutoff ahead is tomorrow's", at("2026-10-06T14:00:00Z").cutoff.toISOString() === "2026-10-07T14:00:00.000Z");
  check("00:30 in the UK is the next day, though not yet in UTC", days("2026-10-06T23:30:00Z") === "2026-10-07 > 2026-10-08", days("2026-10-06T23:30:00Z"));
  check("Friday before 3pm arrives Monday", days("2026-10-09T10:00:00Z") === "2026-10-09 > 2026-10-12", days("2026-10-09T10:00:00Z"));
  check("Friday after 3pm goes Monday, arrives Tuesday", days("2026-10-09T15:00:00Z") === "2026-10-12 > 2026-10-13", days("2026-10-09T15:00:00Z"));
  check("Saturday goes Monday", days("2026-10-10T12:00:00Z") === "2026-10-12 > 2026-10-13", days("2026-10-10T12:00:00Z"));
  // The clocks go back on Sunday 25 Oct 2026.
  check("across the clock change, Monday's cutoff is 15:00 UTC", at("2026-10-24T22:30:00Z").cutoff.toISOString() === "2026-10-26T15:00:00.000Z", at("2026-10-24T22:30:00Z").cutoff.toISOString());
  check(
    "in winter 3pm UK is 15:00 UTC",
    days("2026-11-03T14:59:00Z") === "2026-11-03 > 2026-11-04" && days("2026-11-03T15:00:00Z") === "2026-11-04 > 2026-11-05"
  );
  check("Christmas Eve morning skips Christmas, the weekend and Boxing Day", days("2026-12-24T10:00:00Z") === "2026-12-24 > 2026-12-29", days("2026-12-24T10:00:00Z"));
  check("Christmas Eve afternoon goes out on the 29th", days("2026-12-24T16:00:00Z") === "2026-12-29 > 2026-12-30", days("2026-12-24T16:00:00Z"));
  check("dates read like Wed 7 Oct", formatDeliveryDay("2026-10-07") === "Wed 7 Oct", formatDeliveryDay("2026-10-07"));

  const nextDayOption = deliveryOptionById("next_day")!;
  const before = deliveryDetailAt(nextDayOption, new Date("2026-10-06T13:00:00Z"));
  check("before the cutoff, checkout says order by 3pm and gives the date", before === "Amazon Shipping. Order by 3pm for delivery Wed 7 Oct", before);
  const after = deliveryDetailAt(nextDayOption, new Date("2026-10-06T15:00:00Z"));
  check("after it, next day is still offered with the later date", after === "Amazon Shipping. Delivery Thu 8 Oct", after);
  check(
    "Standard's line has no date",
    deliveryDetailAt(STANDARD_DELIVERY, new Date()) === "Royal Mail Tracked 48, 2–3 working days",
    deliveryDetailAt(STANDARD_DELIVERY, new Date())
  );
}

// ── Address wrapping ─────────────────────────────────────────────
check("short lines pass through", JSON.stringify(wrapLines(["1 High St", ""], 30)) === JSON.stringify(["1 High St"]));
{
  const lines = wrapLines(["Flat 4, The Old Granary, 27 Riverside Wharf Industrial Estate"], 30);
  check("a long line wraps at word breaks", lines !== null && lines.every((l) => l.length <= 30), JSON.stringify(lines));
  check("wrapping loses no words", lines?.join(" ") === "Flat 4, The Old Granary, 27 Riverside Wharf Industrial Estate");
}
check("more than three lines is refused", wrapLines(["aaaa bbbb cccc dddd"], 4) === null);
check("a word longer than a line is refused, not cut", wrapLines(["Supercalifragilisticexpialidocious"], 20) === null);
check(
  "a long line breaks after a comma, not mid-phrase",
  JSON.stringify(wrapLines(["Caerphilly sports supplements, unit 14"], 35)) === JSON.stringify(["Caerphilly sports supplements,", "unit 14"])
);
check(
  "…unless the comma break would cost a line too many",
  JSON.stringify(wrapLines(["aa, bbbbbb cc dddddd ee ffff"], 10)) === JSON.stringify(["aa, bbbbbb", "cc dddddd", "ee ffff"])
);
check(
  "lines that wrap past three are run together and repacked",
  JSON.stringify(wrapLines(["aaaa bbbb cc", "dddd eeee ff"], 10)) === JSON.stringify(["aaaa bbbb", "cc, dddd", "eeee ff"])
);
check("the narrowest width that fits wins", JSON.stringify(wrapNarrowest(["aaaa bbbb cccc"], [4, 9, 14])) === JSON.stringify(["aaaa", "bbbb", "cccc"]));
check("…and a wider one is used only when it has to be", JSON.stringify(wrapNarrowest(["aaaa bbbb cccc dddd"], [4, 9, 14])) === JSON.stringify(["aaaa bbbb", "cccc dddd"]));
check("truncateWords cuts at a space", truncateWords("Bacteriostatic Water 10ml vial — 5-pack", 30) === "Bacteriostatic Water 10ml vial");

// ── SmartTrack request ───────────────────────────────────────────
const input: LabelInput = {
  reference: labelReference("3f9a1c2d-0000-4000-8000-000000000000", 1),
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
  // The address SmartTrack refused on 1 Oct 2026: 38 characters on line 1,
  // inside the 40 its docs allow.
  const { request, problems } = buildShipmentRequest({
    ...input,
    receiver: {
      ...input.receiver,
      address: { line1: "Caerphilly sports supplements, unit 14", line2: "Bedwas house industrial estate", city: "Caerphilly", country: "GB", postalCode: "CF83 8GF" },
    },
  });
  const lines = [request?.receiver_address_line_1, request?.receiver_address_line_2, request?.receiver_address_line_3];
  check(
    "a delivery address is laid out narrower than the documented 40",
    JSON.stringify(lines) === JSON.stringify(["Caerphilly sports supplements,", "unit 14", "Bedwas house industrial estate"]),
    JSON.stringify(lines) + problems.join("; ")
  );
}
{
  const line1 = "The Old Schoolhouse Annexe Upper Flat Twelve";
  const line2 = "Great Northern Industrial Park and Business Centre West Entrance";
  const { request, problems } = buildShipmentRequest({
    ...input,
    receiver: { ...input.receiver, address: { ...input.receiver.address, line1, line2 } },
  });
  const lines = [request?.receiver_address_line_1, request?.receiver_address_line_2, request?.receiver_address_line_3];
  check("an address too long for narrow lines still uses the full 40", lines.every((l) => l && l.length <= 40) && lines.some((l) => l!.length > 35), JSON.stringify(lines) + problems.join("; "));
  check("…with every word kept", lines.join(" ").replace(/,/g, "") === `${line1} ${line2}`, JSON.stringify(lines));
}
{
  const { request } = buildShipmentRequest(input);
  check("a short address goes through as typed", request?.receiver_address_line_1 === "22 Acacia Avenue" && request.receiver_address_line_2 === undefined);
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
  // 6 Oct 2026: sent without a company, SmartTrack filled in its own and
  // Royal Mail refused it as over 35 characters.
  const { request, problems } = buildShipmentRequest({ ...input, sender: { ...input.sender, company: "" } });
  check("a warehouse without a company blocks the label", request === null && problems.some((p) => p.includes("Warehouse company")), problems.join("; "));
}
{
  const { request, problems } = buildShipmentRequest({ ...input, sender: { ...input.sender, company: "B".repeat(26) } });
  check("an over-long company blocks the label rather than being left off", request === null && problems.some((p) => p.includes("Warehouse company")), problems.join("; "));
}
{
  // Royal Mail (through SmartTrack) refuses something over 35 characters
  // even with every sender field short; the dashed reference was 38.
  const id = "612e6d61-8a79-4fd6-98d3-4557f86c9011";
  const refs = [1, 9, 10, 99].map((n) => labelReference(id, n));
  check("a label reference fits 35 characters", refs.every((r) => r.length <= 35), refs.join(", "));
  check("…and is still unique per attempt", new Set(refs).size === refs.length && refs[0] === "612e6d618a794fd698d34557f86c9011-1", refs[0]);
  check("…within the limit the request enforces", LIMITS.reference === 35);
  const { problems } = buildShipmentRequest({ ...input, reference: `${id}-1` });
  check("a reference over 35 blocks the label", problems.some((p) => p.includes("Reference")), problems.join("; "));
}
{
  const { request } = buildShipmentRequest(input);
  check("the company is always sent", request?.sender_company === "BacLab", String(request?.sender_company));
}
{
  const { request, warnings } = buildShipmentRequest({
    ...input,
    receiver: { ...input.receiver, email: `${"a".repeat(50)}@example.com` },
  });
  check("an over-long optional email is left off, with a warning", request !== null && request.receiver_email === undefined && warnings.length === 1);
}
{
  // 4 Oct 2026, order fc1f197b to Belfast: Amazon Shipping refused it seven
  // times with "Please enter parcel 1 item 1 HS Code". GB to Northern Ireland
  // carries customs data per item.
  const belfast = { ...input.receiver, address: { line1: "23 Kenard Avenue", line2: null, city: "Belfast", country: "GB", postalCode: "BT11 8LY" } };
  const { request, problems } = buildShipmentRequest({ ...input, receiver: belfast });
  check("a Northern Ireland item without an HS code blocks the label", request === null && problems.some((p) => p.includes("HS code")), problems.join("; "));
  check("…naming the SKU to fix", problems.some((p) => p.includes("BACLAB-10ML-X5")), problems.join("; "));
  const coded = buildShipmentRequest({ ...input, receiver: belfast, items: [{ ...input.items[0]!, hsCode: "2853901000" }] });
  check("…and with one it goes through, carrying the code", coded.request?.parcel[0]!.items![0]!.hscode === "2853901000", coded.problems.join("; "));
  const lower = { ...belfast, address: { ...belfast.address, postalCode: "bt11 8ly" } };
  check("a lower-case BT postcode counts too", buildShipmentRequest({ ...input, receiver: lower }).request === null);
  check("a mainland GB item needs no HS code", buildShipmentRequest(input).request !== null);
}

if (failures > 0) {
  console.error(`\n${failures} shipping check(s) failed`);
  process.exit(1);
}
console.log("✓ shipping: all checks passed");
