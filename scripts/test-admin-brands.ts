/**
 * Test suite for the admin's brand scope (lib/admin/brand-scope.ts) and the
 * per-brand figures built on it. Run with `npm run test:admin-brands`.
 * Exits non-zero on any failure, like the other tsx test scripts.
 *
 * Pure checks only, no database: the where clauses are compared as shapes,
 * and the ledger is fed rows by hand. A second brand comes from the test
 * fixture (scripts/fixtures/test-brand.ts).
 */
import { DEFAULT_BRAND } from "@/brands/registry";
import {
  ADMIN_BRAND_COOKIE,
  ALL_BRANDS_SCOPE,
  adminBrandScope,
  brandParam,
  brandRank,
  brandWhere,
  isBrandScope,
  keepBrandParam,
  ordersWhere,
  parseBrandScope,
} from "@/lib/admin/brand-scope";
import { takingsWhere } from "@/lib/dailyTakings";
import { customerKey, firstOrders, ledgerRow, type LedgerContext, type LedgerOrder } from "@/lib/finance/ledger";
import { catchUpWhere } from "@/lib/shipping/catch-up";
import { registerTestBrand, TEST_BRAND_ID } from "./fixtures/test-brand";

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

  // ── First order or repeat: within one brand, BacLab's keys unchanged.
  check("BacLab's customer key is the bare email", customerKey(" A@Example.com ", "baclab") === "a@example.com");
  check("no brand is BacLab's key", customerKey("a@example.com", undefined) === "a@example.com");
  check("another brand's key is prefixed", customerKey("A@example.com", "other") === "other a@example.com");

  // ── A second brand.
  const fixture = registerTestBrand();
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
