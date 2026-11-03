/**
 * Test suite for the admin's brand scope (lib/admin/brand-scope.ts) and the
 * per-brand figures built on it. Run with `npm run test:admin-brands`.
 * Exits non-zero on any failure, like the other tsx test scripts.
 *
 * Pure checks only, no database: the where clauses are compared as shapes,
 * and the ledger is fed rows by hand. A second brand comes from the test
 * fixture (scripts/fixtures/test-brand.ts).
 */
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Order } from "@prisma/client";
import { brandFor, DEFAULT_BRAND } from "@/brands/registry";
import { PackingSlip } from "@/components/admin/PackingSlip";
import { brandChip, contrastRatio, textOn } from "@/lib/admin/brand-chip";
import {
  ADMIN_BRAND_COOKIE,
  ALL_BRANDS_SCOPE,
  adminBrandScope,
  afterBrandSwitch,
  brandParam,
  brandRank,
  brandWhere,
  isBrandScope,
  keepBrandParam,
  ordersWhere,
  parseBrandScope,
  sortByBrand,
} from "@/lib/admin/brand-scope";
import { takingsWhere } from "@/lib/dailyTakings";
import {
  brandMix,
  bucket,
  customerKey,
  firstOrders,
  ledgerRow,
  summarise,
  type LedgerContext,
  type LedgerOrder,
} from "@/lib/finance/ledger";
import { csvCell, ORDER_CSV_HEADER, orderCsvLine, PERIOD_CSV_HEADER, periodCsvLine, toCsv } from "@/lib/finance/csv";
import { catchUpWhere } from "@/lib/shipping/catch-up";
import { bacLabLeaks, registerTestBrand, TEST_BRAND_ID } from "./fixtures/test-brand";

// The app's JSX compiles to React.createElement here (tsconfig "jsx": "preserve"
// leaves it to Next), so the slip needs React in scope to render.
(globalThis as unknown as { React: typeof React }).React = React;

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

/** JSON with object keys sorted, so two where clauses compare by content, not key order. */
function canon(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}
const same = (a: unknown, b: unknown) => canon(a) === canon(b);

async function main() {
  // ── Before the fixture: BacLab is the only brand.
  check("the cookie is admin_brand", ADMIN_BRAND_COOKIE === "admin_brand");
  check("all is a scope", isBrandScope("all"));
  check("baclab is a scope", isBrandScope("baclab"));
  check("an unknown brand is not a scope", !isBrandScope("nope") && !isBrandScope("") && !isBrandScope(null));
  check("the fixture is not a scope before it is registered", !isBrandScope(TEST_BRAND_ID));
  check("the opt-out wildcard is not a scope", !isBrandScope("*"));

  // ── Parsing: ?brand= beats the cookie, which beats "all".
  check("nothing at all is every brand", parseBrandScope(undefined, undefined) === ALL_BRANDS_SCOPE);
  check("the cookie alone decides", parseBrandScope(undefined, "baclab") === "baclab");
  check("the param alone decides", parseBrandScope("baclab", undefined) === "baclab");
  check("the param beats the cookie", parseBrandScope("all", "baclab") === "all");
  check("an invalid param falls through to the cookie", parseBrandScope("nope", "baclab") === "baclab");
  check("an invalid cookie falls through to all", parseBrandScope(undefined, "nope") === "all");
  check("both invalid is all", parseBrandScope("nope", "also-nope") === "all");
  check("an empty param is ignored", parseBrandScope("", "baclab") === "baclab");
  check("a repeated param takes the first", parseBrandScope(["baclab", "nope"], undefined) === "baclab");
  check("brandParam ignores junk", brandParam("nope") === null && brandParam(undefined) === null);
  check("brandParam keeps all", brandParam("all") === "all");
  check("outside a request there is no cookie", (await adminBrandScope("baclab")) === "baclab" && (await adminBrandScope()) === "all");

  // ── Where clauses. "all" adds nothing, so every query is what it was.
  const filters = { status: { in: ["paid", "packed"] }, kind: { in: ["sale", "plan_box"] } };
  check("ordersWhere(all) is the filters untouched", same(ordersWhere({ brand: "all", ...filters }), filters));
  check("ordersWhere(baclab) adds the brand", same(ordersWhere({ brand: "baclab", ...filters }), { ...filters, brand: "baclab" }));
  check("brandWhere(all) is empty", same(brandWhere("all"), {}));
  check("brandWhere(baclab) is the brand", same(brandWhere("baclab"), { brand: "baclab" }));

  const start = new Date("2026-11-01T00:00:00Z");
  const end = new Date("2026-11-02T00:00:00Z");
  const before = takingsWhere(start, end);
  check("takingsWhere without a brand has no brand key", !("brand" in before) && Array.isArray(before.OR) && before.OR.length === 3);
  check("takingsWhere(all) is takingsWhere()", same(takingsWhere(start, end, "all"), before));
  check(
    "takingsWhere(baclab) is the same OR plus the brand",
    same(takingsWhere(start, end, "baclab"), { ...before, brand: "baclab" })
  );
  const now = new Date("2026-11-03T12:00:00Z");
  check("catchUpWhere(all) is catchUpWhere()", same(catchUpWhere("noLabel", now, "all"), catchUpWhere("noLabel", now)));
  check(
    "catchUpWhere(baclab) keeps its OR and adds the brand",
    same(catchUpWhere("noLabel", now, "baclab"), { ...catchUpWhere("noLabel", now), brand: "baclab" })
  );

  // ── Links carry ?brand= on only when the page had one.
  check("no param leaves links alone", keepBrandParam(undefined)("/admin/takings") === "/admin/takings");
  check("an invalid param leaves links alone", keepBrandParam("nope")("/admin/takings") === "/admin/takings");
  check("a param is added with ?", keepBrandParam("baclab")("/admin/takings") === "/admin/takings?brand=baclab");
  check("a param is added with &", keepBrandParam("all")("/admin/finance?range=7d") === "/admin/finance?range=7d&brand=all");
  check("a hash stays last", keepBrandParam("baclab")("/admin/orders#x") === "/admin/orders?brand=baclab#x");

  // ── The switcher goes back where it was used, minus its ?brand=, and never off the admin.
  check("back to the page", afterBrandSwitch("/admin/orders?status=paid") === "/admin/orders?status=paid");
  check("the page's ?brand= is dropped", afterBrandSwitch("/admin/takings?date=2026-11-01&brand=baclab") === "/admin/takings?date=2026-11-01");
  check("the dashboard is fine", afterBrandSwitch("/admin") === "/admin");
  check("no next is the dashboard", afterBrandSwitch(null) === "/admin" && afterBrandSwitch("") === "/admin");
  check("another site is refused", afterBrandSwitch("https://evil.example/admin") === "/admin");
  check("a protocol-relative URL is refused", afterBrandSwitch("//evil.example/admin") === "/admin");
  check("a backslash trick is refused", afterBrandSwitch("/\\evil.example") === "/admin");
  check("a storefront path is refused", afterBrandSwitch("/checkout") === "/admin");
  check("an admin look-alike is refused", afterBrandSwitch("/administrator") === "/admin");

  // ── First order or repeat: within one brand, BacLab's keys unchanged.
  check("BacLab's customer key is the bare email", customerKey(" A@Example.com ", "baclab") === "a@example.com");
  check("no brand is BacLab's key", customerKey("a@example.com", undefined) === "a@example.com");
  check("another brand's key is prefixed", customerKey("A@example.com", "other") === "other a@example.com");

  // ── Chips: the short code on the brand colour, always readable.
  const bl = brandChip("baclab");
  check("BacLab's chip is BL on its primary blue", bl.shortCode === "BL" && bl.background === brandFor("baclab").colours.primary);
  check("BacLab's chip text is white", bl.color === "#FFFFFF");
  check("a light colour gets black text", textOn("#FFD400") === "#000000" && textOn("#fff") === "#000000");
  check("a dark colour gets white text", textOn("#050B1F") === "#FFFFFF");
  check("contrast of white on black is 21", Math.round(contrastRatio("#FFFFFF", "#000000")) === 21);
  let worst = 21;
  for (let r = 0; r <= 255; r += 15)
    for (let g = 0; g <= 255; g += 15)
      for (let b = 0; b <= 255; b += 15) {
        const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        worst = Math.min(worst, contrastRatio(textOn(hex), hex));
      }
  check("every colour gets text at AA contrast (4.5:1) or better", worst >= 4.5, worst.toFixed(2));
  check("an unknown brand's chip is BacLab's", brandChip("nope").shortCode === "BL");

  // ── A second brand.
  const fixture = registerTestBrand();
  const fx = brandChip(TEST_BRAND_ID);
  check("the fixture's chip is its own", fx.shortCode === "FX" && fx.name === "Fixture & Co" && fx.background === "#8A3B12");
  check("the fixture's chip text is readable", contrastRatio(fx.color, fx.background) >= 4.5);
  check("the fixture is a scope once registered", isBrandScope(TEST_BRAND_ID));
  check("the param can pick the fixture", parseBrandScope(TEST_BRAND_ID, "baclab") === TEST_BRAND_ID);
  check("BacLab ranks first", brandRank(DEFAULT_BRAND) === 0 && brandRank(TEST_BRAND_ID) > 0);
  check("an unregistered brand ranks last", brandRank("gone") > brandRank(TEST_BRAND_ID));
  check(
    "ordersWhere(fixture) filters on the fixture",
    same(ordersWhere({ brand: fixture.id, ...filters }), { ...filters, brand: TEST_BRAND_ID })
  );

  const at = (iso: string) => new Date(iso);
  const sold = [
    { id: "b1", brand: "baclab", customerEmail: "same@example.com", paidAt: at("2026-09-01T10:00:00Z"), createdAt: at("2026-09-01T10:00:00Z") },
    { id: "f1", brand: TEST_BRAND_ID, customerEmail: "Same@Example.com", paidAt: at("2026-10-01T10:00:00Z"), createdAt: at("2026-10-01T10:00:00Z") },
    { id: "f2", brand: TEST_BRAND_ID, customerEmail: "same@example.com", paidAt: at("2026-10-05T10:00:00Z"), createdAt: at("2026-10-05T10:00:00Z") },
  ];
  const firsts = firstOrders(sold);
  check("each brand has its own first order", firsts.get("same@example.com") === "b1" && firsts.get(`${TEST_BRAND_ID} same@example.com`) === "f1");

  const order = (over: Partial<LedgerOrder>): LedgerOrder => ({
    id: "x",
    status: "paid",
    customerName: "A",
    customerEmail: "same@example.com",
    items: JSON.stringify([{ qty: 5, bundleId: "five" }]),
    amountPaidMinor: 2589,
    totalAmount: "21.99",
    deliveryMinor: 390,
    deliveryOption: "standard",
    paidAt: at("2026-10-06T08:55:00Z"),
    createdAt: at("2026-10-06T08:50:00Z"),
    shipments: [],
    ...over,
  });
  const ctx: LedgerContext = { rates: [], vatFrom: null, firstOrderByEmail: firsts };
  const f1 = ledgerRow(order({ id: "f1", brand: TEST_BRAND_ID }), ctx);
  check("a BacLab customer's first order with another brand is new there", f1.customer === "new", f1.customer);
  check("the ledger row carries its brand", f1.brand === TEST_BRAND_ID);
  check("a second order with that brand is a repeat", ledgerRow(order({ id: "f2", brand: TEST_BRAND_ID }), ctx).customer === "returning");
  check("BacLab's first order is still new", ledgerRow(order({ id: "b1", brand: "baclab" }), ctx).customer === "new");
  check("a row with no brand reads as BacLab", ledgerRow(order({ id: "b1" }), ctx).brand === "baclab");

  // ── Brand by brand: each brand's figures apart, every brand listed.
  const rows = [
    ledgerRow(order({ id: "b1", brand: "baclab", amountPaidMinor: 1000, deliveryMinor: 0, totalAmount: "10.00" }), ctx),
    ledgerRow(order({ id: "f1", brand: TEST_BRAND_ID, amountPaidMinor: 2500, deliveryMinor: 0, totalAmount: "25.00" }), ctx),
    ledgerRow(order({ id: "f2", brand: TEST_BRAND_ID, amountPaidMinor: 500, deliveryMinor: 0, totalAmount: "5.00" }), ctx),
    ledgerRow(order({ id: "g1", brand: "gone", amountPaidMinor: 100, deliveryMinor: 0, totalAmount: "1.00" }), ctx),
  ];
  const mix = brandMix(rows, ["baclab", TEST_BRAND_ID, "empty"]);
  const of = (id: string) => mix.find((m) => m.brand === id)?.totals;
  check("brands come in the order given", mix.map((m) => m.brand).join() === `baclab,${TEST_BRAND_ID},empty`);
  check("the fixture's takings are its own", of(TEST_BRAND_ID)?.takenMinor === 3000 && of(TEST_BRAND_ID)?.orders === 2);
  check("an unregistered brand's order counts as BacLab's", of("baclab")?.takenMinor === 1100 && of("baclab")?.orders === 2);
  check("a brand with no sales is listed at zero", of("empty")?.orders === 0 && of("empty")?.takenMinor === 0);
  check(
    "the brands add up to the whole",
    mix.reduce((n, m) => n + m.totals.takenMinor, 0) === summarise(rows).takenMinor
  );

  // ── CSVs: the old columns, unchanged and in order, then brand.
  const OLD_PERIOD = "period,from,to,orders,vials,welcome_vials,gift_vials,order_value,delivery,taken,discounts,vat,postage,postage_cancelled_orders,packages,fulfilment,after_shipping_costs,cancelled_orders,cancelled_value";
  const OLD_ORDER = "order_id,kind,paid_at,day,status,customer_name,customer_email,customer,pack,vials,welcome_vials,gift_vials,delivery_option,order_value,delivery,taken,discount,vat,postage,postage_status,packages,fulfilment,after_shipping_costs";
  check("period CSV keeps its columns, then brand", PERIOD_CSV_HEADER.join(",") === `${OLD_PERIOD},brand`);
  check("order CSV keeps its columns, then brand", ORDER_CSV_HEADER.join(",") === `${OLD_ORDER},brand`);
  const line = orderCsvLine(rows[1]!);
  check("an order line has a cell per column", line.length === ORDER_CSV_HEADER.length);
  check("an order line ends with its brand", line[line.length - 1] === TEST_BRAND_ID && line[0] === "f1");
  const buckets = bucket(rows, "2026-10-06", "2026-10-06", "day");
  const pLine = periodCsvLine(buckets[0]!, "all");
  check("a period line has a cell per column", pLine.length === PERIOD_CSV_HEADER.length);
  check("a period line ends with the scope", pLine[pLine.length - 1] === "all" && periodCsvLine(buckets[0]!, TEST_BRAND_ID).at(-1) === TEST_BRAND_ID);
  const csv = toCsv(ORDER_CSV_HEADER, [line]);
  check("the CSV header row ends with brand", csv.split("\r\n")[0]!.endsWith(",brand"));
  check("the CSV data row ends with the quoted brand", csv.split("\r\n")[1]!.endsWith(`,"${TEST_BRAND_ID}"`));
  check("CSV cells still defuse formulas", csvCell("=SUM(A1)") === `"'=SUM(A1)"` && csvCell("-3.10") === `"-3.10"`);

  // ── Packing: brand by brand, oldest first within each, each slip in its order's brand.
  const queue = [
    { id: "1", brand: TEST_BRAND_ID },
    { id: "2", brand: "baclab" },
    { id: "3", brand: "gone" },
    { id: "4", brand: TEST_BRAND_ID },
    { id: "5", brand: "baclab" },
  ];
  check("the batch print groups by brand, BacLab first, keeping order", sortByBrand(queue).map((o) => o.id).join() === "2,5,1,4,3");
  check("sortByBrand leaves its input alone", queue.map((o) => o.id).join() === "1,2,3,4,5");

  const slipOrder = (brand: string) =>
    ({
      id: "11111111-2222-3333-4444-555555555555",
      brand,
      createdAt: at("2026-10-06T08:50:00Z"),
      customerName: "Alex Example",
      customerEmail: "alex@example.com",
      customerPhone: "07000 000000",
      shippingAddress: JSON.stringify({ line1: "1 High St", city: "Leeds", country: "GB", postalCode: "LS1 1AA" }),
      items: JSON.stringify([{ name: "5-vial pack", qty: 1, unitPrice: "21.99", lineTotal: "21.99" }]),
      totalAmount: "21.99",
      currency: "GBP",
    }) as unknown as Order;
  const slip = (brand: string) => renderToStaticMarkup(createElement(PackingSlip, { order: slipOrder(brand) }));
  const blSlip = slip("baclab");
  check("BacLab's slip has BacLab's name and thank-you", blSlip.includes(brandFor("baclab").name) && blSlip.includes(brandFor("baclab").packingSlipThankYou));
  check("BacLab's slip has no packing note", !blSlip.includes("Pack in"));
  const fxSlip = slip(TEST_BRAND_ID);
  check("the fixture's slip has its name, escaped", fxSlip.includes("Fixture &amp; Co"));
  check("the fixture's slip has its contact and thank-you", fxSlip.includes("help@fixture.example") && fxSlip.includes("Thanks from the fixture."));
  check("the fixture's slip says what to pack it in", fxSlip.includes("Pack in: Fixture box"));
  check("the fixture's logo comes from its own origin", fxSlip.includes('src="https://fixture.example/fixture/logo.svg"'));
  check("nothing of BacLab's is on the fixture's slip", bacLabLeaks(fxSlip).length === 0, bacLabLeaks(fxSlip).join());

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("admin brand checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
