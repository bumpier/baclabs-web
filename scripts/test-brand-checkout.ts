/**
 * The new brands' commerce backend: catalogues, pricing, order lines, the
 * brand checks on the public routes, that BacLab never reaches any of it,
 * and that no brand ever reaches BacLab's Stripe account. Run with
 * `npm run test:brand-checkout`. Exits non-zero on any failure, like the
 * other tsx test scripts. Never calls Stripe, and no request leaves the
 * process.
 *
 * The database part is opt-in. It writes rows, so give it a fresh file:
 *
 *   export DATABASE_URL="file:/path/to/scratch/brand-checkout.db"
 *   BRAND_CHECKOUT_DB=1 npm run -s test:brand-checkout
 *
 * It migrates that file itself, seeds the brand SKUs and checks out through
 * the real route: with a stand-in provider, then with PayPal faked
 * (scripts/fixtures/fake-paypal.ts) through the real return and webhook
 * routes, and checks the order is paid by the right provider, its stock
 * taken, and that every repeat does nothing. npm run test:paypal covers the
 * PayPal adapter itself without a database.
 */
// First: it counts every Stripe client made from here on (see the file).
import { stripeClientsMade } from "./fixtures/stripe-trap";
import { clearPayPalEnv, fakePayPal, json, paypalOrderJson, setPayPalEnv, webhookHeaders } from "./fixtures/fake-paypal";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { allBrands, belongsToHost, brandFor, brandFromHost, BRAND_IDS, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import type { BrandCatalogue } from "@/brands/types";
import { DELIVERY, DELIVERY_OPTIONS, LAB_KIT, PRODUCT, SINGLE_BUNDLE, bundleById, deliveryOptionById, priceOrder } from "@/config/funnel";
import { catalogueDeliveryOptions, catalogueItem, packPerVialMinor } from "@/lib/commerce/catalogue";
import { MAX_LINE_QTY, priceBrandLines, type PricedBrandOrder } from "@/lib/commerce/pricing";
import { brandBuyLink, parseBuyParam } from "@/lib/commerce/links";
import { buildBrandOrderItems, buildOrderItems, isKitLine } from "@/lib/order-items";
import { LAB_KIT_SKU_CODE, VIAL_SKU_CODE, soldLines } from "@/lib/inventory/demand";
import { brandSkuSpecs } from "@/lib/inventory/brand-skus";
import { skuCodeError } from "@/lib/inventory/codes";
import { selectService } from "@/lib/shipping/select-service";
import { vialsOnOrder } from "@/lib/vial-stock";
import { ledgerRow, packMix, packName, type LedgerOrder } from "@/lib/finance/ledger";
import { brandReorderOffer } from "@/lib/reorder";
import { purchaseContents } from "@/lib/meta-capi-event";
import { checkBrandCopy, checkCompliance } from "@/lib/content-rules";
import type { PaymentAdapter, PaymentOrder } from "@/lib/commerce/payments";
import { brandSessionParams } from "@/lib/commerce/payments/stripe";
import type Stripe from "stripe";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const NEW_BRANDS = BRAND_IDS.filter((id) => id !== DEFAULT_BRAND).map((id) => brandFor(id));
const cat = (id: string): BrandCatalogue => brandFor(id).catalogue!;
const priced = (id: string, lines: { sku: string; qty: number }[], labKitOnSale = true): PricedBrandOrder => {
  const r = priceBrandLines(cat(id), lines, { labKitOnSale });
  if (!r.ok) throw new Error(`expected ${JSON.stringify(lines)} to price: ${r.error}`);
  return r.order;
};
const refusal = (id: string, lines: { sku: string; qty: number }[], labKitOnSale = true) => {
  const r = priceBrandLines(cat(id), lines, { labKitOnSale });
  return r.ok ? null : r.error;
};

// ── Catalogues ────────────────────────────────────────────────────────
check("BacLab has no catalogue: its checkout is config/funnel.ts", brandFor(DEFAULT_BRAND).catalogue === undefined);
const allSkus: string[] = [];
for (const b of NEW_BRANDS) {
  const c = b.catalogue;
  check(`${b.id}: has a catalogue`, !!c);
  if (!c) continue;
  const byVials = [...c.packs].sort((x, y) => x.vials - y.vials);
  check(`${b.id}: packs are listed smallest first`, byVials.every((p, i) => p === c.packs[i]));
  for (let i = 1; i < byVials.length; i++) {
    const [smaller, bigger] = [byVials[i - 1]!, byVials[i]!];
    check(
      `${b.id}: per-vial price falls from ${smaller.vials} to ${bigger.vials}`,
      bigger.priceMinor / bigger.vials < smaller.priceMinor / smaller.vials,
      `${packPerVialMinor(smaller)}p then ${packPerVialMinor(bigger)}p`
    );
  }
  for (const p of c.packs) {
    check(`${b.id}: ${p.sku} is ${c.parentSku}-X${p.vials}`, p.sku === `${c.parentSku}-X${p.vials}`);
    check(`${b.id}: ${p.id} is x${p.vials}`, p.id === `x${p.vials}`);
    check(`${b.id}: ${p.sku} is a valid SKU code`, skuCodeError(p.sku) === null, String(skuCodeError(p.sku)));
    check(`${b.id}: ${p.sku} costs something`, Number.isInteger(p.priceMinor) && p.priceMinor > 0);
  }
  for (const a of c.addOns) check(`${b.id}: ${a.sku} is a valid SKU code`, skuCodeError(a.sku) === null);
  check(`${b.id}: the box is a valid SKU code`, skuCodeError(c.boxSku) === null);
  allSkus.push(...c.packs.map((p) => p.sku), ...c.addOns.map((a) => a.sku), c.boxSku);
  // Every code is the storefront's and its Meta dataset's: never BacLab's name.
  check(`${b.id}: no code names BacLab`, ![...c.packs.map((p) => p.sku), ...c.addOns.map((a) => a.sku), c.boxSku].some((s) => /baclab/i.test(s)));
  check(`${b.id}: no promotion codes in v1`, c.allowPromotionCodes === false);
  check(`${b.id}: business details only for wholesale`, c.collectBusinessDetails === (b.id === "wholesale"));
  const biggestSold = Math.max(...c.packs.filter((p) => p.available).map((p) => p.vials));
  check(`${b.id}: one order can hold the biggest pack on sale`, c.maxVials >= biggestSold);
  for (const o of c.delivery.options) {
    check(`${b.id}: delivery "${o.id}" is one of BacLab's ids`, deliveryOptionById(o.id)?.id === o.id);
    // lib/shipping matches services to the option the customer paid for by id:
    // with none linked it must say so by name, which it can only for a known id.
    const plan = selectService([], { weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 30 }, "GB", null, o.id);
    check(`${b.id}: lib/shipping knows delivery "${o.id}"`, plan.note.startsWith("No service is linked to"), plan.note);
  }
  const copy = [...c.packs.map((p) => p.label), ...c.addOns.map((a) => a.name), b.mailingList?.consentText ?? "", b.statementDescriptor ?? ""];
  check(`${b.id}: catalogue copy passes the content rules`, checkCompliance(copy).length === 0, JSON.stringify(checkCompliance(copy)));
  const descriptor = b.statementDescriptor ?? "";
  check(`${b.id}: the statement descriptor fits`, descriptor.length <= 22 && /[A-Z]/i.test(descriptor) && !/[<>\\'"*]/.test(descriptor), descriptor);
}
check("every brand SKU is unique across brands", new Set(allSkus).size === allSkus.length);
for (const id of ["beauty", "gym", "wholesale"]) {
  check(`${id}: delivery mirrors BacLab's options`, JSON.stringify(cat(id).delivery.options) === JSON.stringify(DELIVERY_OPTIONS));
  check(`${id}: delivery mirrors BacLab's threshold`, cat(id).delivery.freeFromMinor === DELIVERY.freeFromMinor);
}
check(
  "luxury: free next day on the smallest order",
  JSON.stringify(catalogueDeliveryOptions(cat("luxury"), 799).map((o) => [o.option.id, o.priceMinor])) === '[["next_day",0]]'
);
check(
  "beauty: under £40 both options at their prices, Standard first",
  JSON.stringify(catalogueDeliveryOptions(cat("beauty"), 699).map((o) => [o.option.id, o.priceMinor])) === '[["standard",390],["next_day",500]]'
);
check(
  "beauty: from £40 only next day, free",
  JSON.stringify(catalogueDeliveryOptions(cat("beauty"), 4000).map((o) => [o.option.id, o.priceMinor])) === '[["next_day",0]]'
);
check(
  "wholesale: 250 vials and up are quote only, smaller packs on sale",
  cat("wholesale").packs.every((p) => p.available === p.vials < 250)
);
check("gym: the Lab Kit ships as BacLab's kit", cat("gym").addOns.length === 1 && cat("gym").addOns[0]!.ships === "lab-kit");
check("lookups ignore case and space", catalogueItem(cat("luxury"), "  lux-10ml-x3 ")?.kind === "pack");

// SKU seed: each pack is N × the shared vial + 1 × the brand's box.
const specs = brandSkuSpecs();
check("seed: one spec per brand with a catalogue", specs.map((s) => s.brand).join() === NEW_BRANDS.map((b) => b.id).join());
for (const s of specs) {
  const c = cat(s.brand);
  check(`seed ${s.brand}: a kit per pack`, s.kits.map((k) => k.code).join() === c.packs.map((p) => p.sku).join());
  check(`seed ${s.brand}: kits say N vials + the box`, s.kits.every((k) => k.description.includes(`${k.vials} × ${VIAL_SKU_CODE} + 1 × ${c.boxSku}`)));
  // Kit names go on carrier labels and customs forms.
  check(`seed ${s.brand}: kit names never name the brand`, s.kits.every((k) => !k.name.includes(brandFor(s.brand).name)));
  check(`seed ${s.brand}: needs BacLab's kit only for a kit add-on`, (s.needs.length > 0) === c.addOns.some((a) => a.ships === "lab-kit"));
}

// ── Pricing ───────────────────────────────────────────────────────────
{
  const p = priced("luxury", [{ sku: "LUX-10ML-X3", qty: 2 }, { sku: "lux-10ml-x1", qty: 1 }]);
  check("pricing: goods are the catalogue's prices", p.goodsMinor === 2 * 2199 + 799, String(p.goodsMinor));
  check("pricing: vials counted", p.vials === 7);
  check("pricing: lines in the catalogue's order", p.lines.map((l) => l.sku).join() === "LUX-10ML-X1,LUX-10ML-X3");
  const merged = priced("luxury", [{ sku: "LUX-10ML-X3", qty: 1 }, { sku: "LUX-10ML-X3", qty: 2 }]);
  check("pricing: the same SKU twice is one line", merged.lines.length === 1 && merged.lines[0]!.quantity === 3);
  const gym = priced("gym", [{ sku: "GYM-10ML-X10", qty: 1 }, { sku: "GYM-LAB-KIT", qty: 3 }]);
  check("pricing: kits priced from the catalogue", gym.goodsMinor === 4999 + 3 * 499 && gym.kits === 3);
}
check("refused: unknown SKU", refusal("luxury", [{ sku: "LUX-10ML-X2", qty: 1 }]) === "Invalid order details");
check("refused: another brand's SKU", refusal("luxury", [{ sku: "GYM-10ML-X10", qty: 1 }]) === "Invalid order details");
check("refused: BacLab's SKU", refusal("luxury", [{ sku: "baclab-10ml-x5", qty: 1 }]) === "Invalid order details");
check("refused: no lines", refusal("luxury", []) === "Invalid order details");
check("refused: qty 0", refusal("luxury", [{ sku: "LUX-10ML-X1", qty: 0 }]) === "Invalid order details");
check("refused: qty not whole", refusal("luxury", [{ sku: "LUX-10ML-X1", qty: 1.5 }]) === "Invalid order details");
check("refused: qty over the limit", refusal("luxury", [{ sku: "LUX-10ML-X1", qty: MAX_LINE_QTY + 1 }]) === "Invalid order details");
check(
  "refused: a merged qty over the limit",
  refusal("luxury", [{ sku: "LUX-10ML-X1", qty: MAX_LINE_QTY }, { sku: "LUX-10ML-X1", qty: 1 }]) === "Invalid order details"
);
check("refused: eleven lines", refusal("luxury", Array.from({ length: 11 }, () => ({ sku: "LUX-10ML-X1", qty: 1 }))) === "Invalid order details");
check("refused: an unavailable pack", refusal("wholesale", [{ sku: "WHL-10ML-X250", qty: 1 }]) === "That pack can't be ordered online.");
check("refused: more vials than one order holds", /up to 100 vials/.test(refusal("wholesale", [{ sku: "WHL-10ML-X100", qty: 2 }]) ?? ""));
check("refused: an add-on alone", refusal("gym", [{ sku: "GYM-LAB-KIT", qty: 1 }]) === "Invalid order details");
check("refused: more kits than vials", refusal("gym", [{ sku: "GYM-10ML-X5", qty: 1 }, { sku: "GYM-LAB-KIT", qty: 6 }]) === "Invalid order details");
check("refused: the kit while it is switched off", refusal("gym", [{ sku: "GYM-10ML-X5", qty: 1 }, { sku: "GYM-LAB-KIT", qty: 1 }], false) === "Lab Kit is not available right now.");

// ── Order lines: exactly buildOrderItems' shape ─────────────────────────
{
  const gym = priced("gym", [{ sku: "GYM-10ML-X10", qty: 2 }, { sku: "GYM-10ML-X5", qty: 1 }, { sku: "GYM-LAB-KIT", qty: 4 }]);
  const lines = buildBrandOrderItems({ vial: { productId: "vial-id", slug: "baclab-10ml" }, kitProductId: "kit-id", lines: gym.lines, goodsUsd: "100.00" });
  const bacLab = buildOrderItems({
    productId: "vial-id",
    slug: "baclab-10ml",
    bundle: bundleById("five")!,
    quantity: 1,
    priced: priceOrder(bundleById("five")!, 1, 0, 1)!,
    goodsUsd: "30.00",
    kitProductId: "kit-id",
  });
  const keys = (o: object) => Object.keys(o).sort().join();
  check("items: a pack line is BacLab's pack line plus sku", keys(lines[0]!) === keys({ ...bacLab[0]!, sku: "" }), keys(lines[0]!));
  check("items: a kit line is BacLab's kit line plus sku", keys(lines[2]!) === keys({ ...bacLab[1]!, sku: "" }), keys(lines[2]!));
  check("items: packs sell from the shared vial's row", lines[0]!.productId === "vial-id" && lines[0]!.slug === "baclab-10ml");
  check("items: the kit sells from the kit's row", lines[2]!.productId === "kit-id" && lines[2]!.slug === LAB_KIT.sku && isKitLine(lines[2]));
  check("items: pack qty is vials, bundleQty packs", lines[0]!.qty === 5 && lines[0]!.bundleQty === 1 && lines[1]!.qty === 20 && lines[1]!.bundleQty === 2);
  check("items: a pack's bundleId is its SKU, never a BacLab BundleId", lines.every((l) => !bundleById(l.bundleId)));
  check("items: neutral names", lines[0]!.name === `${PRODUCT.name} ${PRODUCT.size}` && lines[2]!.name === LAB_KIT.name);
  const minor = (s: string) => Math.round(Number(s) * 100);
  check("items: line totals sum to the goods", lines.reduce((n, l) => n + minor(l.lineTotal), 0) === gym.goodsMinor);
  check("items: USD shares sum to the basis", lines.reduce((n, l) => n + minor(l.lineTotalUsd), 0) === 10000);
  const json = JSON.stringify(lines);
  const sold = soldLines(json);
  check(
    "items: the warehouse ships each pack as its kit SKU, the kit as BacLab's",
    JSON.stringify(sold.map((s) => [s.skuCode, s.quantity])) === `[["GYM-10ML-X5",1],["GYM-10ML-X10",2],["${LAB_KIT_SKU_CODE}",4]]`,
    JSON.stringify(sold.map((s) => [s.skuCode, s.quantity]))
  );
  check("items: vial stock counts the vials, not the kits", vialsOnOrder(json) === 25);
  check("items: Meta content ids are the brand's SKUs", purchaseContents(json, "gym").map((c) => c.id).join() === "GYM-10ML-X5,GYM-10ML-X10,GYM-LAB-KIT");
}

// ── Finance: each order's pack from its own catalogue ───────────────────
{
  const row = (brand: string, items: unknown[], id: string): LedgerOrder =>
    ({
      id,
      brand,
      kind: "sale",
      status: "paid",
      customerName: "A",
      customerEmail: `${id}@example.com`,
      items: JSON.stringify(items),
      totalAmount: "10.00",
      amountPaidMinor: 1000,
      deliveryMinor: 0,
      deliveryOption: null,
      paidAt: new Date("2026-11-03T10:00:00Z"),
      createdAt: new Date("2026-11-03T10:00:00Z"),
      shipments: [],
    }) as unknown as LedgerOrder;
  const ctx = { rates: [], vatFrom: null, firstOrderByEmail: new Map<string, string>() };
  const lux = buildBrandOrderItems({ vial: { productId: "v", slug: "baclab-10ml" }, lines: priced("luxury", [{ sku: "LUX-10ML-X3", qty: 1 }]).lines, goodsUsd: "1.00" });
  const rows = [
    ledgerRow(row("luxury", lux, "l1"), ctx),
    ledgerRow(row("baclab", [{ qty: 10, bundleId: "ten", bundleQty: 1, lineTotal: "34.99" }], "b1"), ctx),
    ledgerRow(row("baclab", [{ qty: 5, bundleId: "five", bundleQty: 1, lineTotal: "21.99" }], "b2"), ctx),
  ];
  const mix = packMix(rows);
  check("finance: BacLab's ladder first, then the brand's", mix.map((l) => l.pack).join() === "five,ten,LUX-10ML-X3", mix.map((l) => l.pack).join());
  check("finance: a brand pack is named from its catalogue", mix[2]?.label === "Reserve No.10 3-vial pack", mix[2]?.label);
  check("finance: BacLab's names unchanged", packName("ten") === "10-vial pack" && packName("single") === "Single vial" && packName("loose") === "Single vials (before packs)");
  check(
    "finance: a brand's pack is named only for its own orders",
    packName("LUX-10ML-X3", "baclab") === "LUX-10ML-X3" && packName("LUX-10ML-X3", "gym") === "LUX-10ML-X3"
  );
}

// ── Reorder in emails ────────────────────────────────────────────────
{
  const items = buildBrandOrderItems({
    vial: { productId: "v", slug: "baclab-10ml" },
    lines: priced("luxury", [{ sku: "LUX-10ML-X3", qty: 2 }]).lines,
    goodsUsd: "1.00",
  });
  const offer = brandReorderOffer(JSON.stringify([...items, { qty: 1, welcome: true, name: "Free vial" }]), cat("luxury"));
  check("reorder: the same packs at catalogue prices", offer?.goodsMinor === 4398 && offer.vials === 6, JSON.stringify(offer));
  check("reorder: a link that fills the brand's basket", offer?.link === "/?buy=LUX-10ML-X3:2");
  check("reorder: luxury's delivery is free", offer?.shipsFree === true && offer.freeDelivery === "next-day delivery");
  check("reorder: links parse back", JSON.stringify(parseBuyParam("LUX-10ML-X3:2,nope,lux-10ml-x1:1")) === '[{"sku":"LUX-10ML-X3","qty":2},{"sku":"LUX-10ML-X1","qty":1}]');
  check("reorder: link and parser agree", JSON.stringify(parseBuyParam(brandBuyLink([{ sku: "A-1", qty: 3 }]).split("=")[1])) === '[{"sku":"A-1","qty":3}]');
  check("reorder: nothing for a pack no longer sold", brandReorderOffer(JSON.stringify([{ sku: "LUX-10ML-X99", bundleQty: 1, qty: 99 }]), cat("luxury")) === null);
}

// ── Stripe only through its adapter ─────────────────────────────────────
// The brands take cards on BacLab's Stripe account, but only through
// lib/commerce/payments/stripe.ts. Every other module the brand checkout
// can run, followed import by import from lib/commerce/checkout.ts with the
// adapter left out, stays clear of lib/payments/stripe.ts and the SDK: no
// path but the adapter can make a session, by a fallback or any other way.
const ROOT = process.cwd();
const STRIPE_ADAPTER = resolve(ROOT, "lib/commerce/payments/stripe.ts");
function moduleFile(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? resolve(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext;
  }
  return null;
}
function moduleGraph(entry: string, leaveOut: string): { files: Set<string>; packages: Set<string>; leftOut: boolean } {
  const files = new Set<string>();
  const packages = new Set<string>();
  let leftOut = false;
  const queue = [resolve(ROOT, entry)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (file === leaveOut) {
      leftOut = true;
      continue;
    }
    if (files.has(file)) continue;
    files.add(file);
    const src = readFileSync(file, "utf8");
    // Type-only imports are erased: they load nothing.
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm)) {
      const spec = m[1] ?? m[2]!;
      const next = moduleFile(spec, file);
      if (next) queue.push(next);
      else if (!spec.startsWith(".") && !spec.startsWith("@/")) packages.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!);
    }
  }
  return { files, packages, leftOut };
}
{
  const graph = moduleGraph("lib/commerce/checkout.ts", STRIPE_ADAPTER);
  const stripeModule = resolve(ROOT, "lib/payments/stripe.ts");
  check("stripe: the brand checkout's modules were followed", graph.files.size > 1, String(graph.files.size));
  check("stripe: the brand checkout reaches the Stripe adapter", graph.leftOut);
  check("stripe: nothing else in it loads lib/payments/stripe.ts", !graph.files.has(stripeModule));
  check("stripe: nothing else in it loads the Stripe SDK", !graph.packages.has("stripe"), [...graph.packages].join());
}

// ── The brands' Stripe sessions, field by field ───────────────────────
// The order id is "ord-fixture" because Tailwind scans the whole repo: an
// id spelled like a utility class (order, then a dash and a digit) would add
// that class to BacLab's stylesheet.
const NOW = new Date("2026-11-04T10:00:00Z"); // a Wednesday morning: no dispatch notice
const SATURDAY = new Date("2026-11-07T10:00:00Z");
function paymentOrder(b: BrandProfile, lines: { sku: string; qty: number }[], deliveryIndex = 0): PaymentOrder {
  const r = priceBrandLines(b.catalogue!, lines, { labKitOnSale: true });
  if (!r.ok) throw new Error(`expected ${JSON.stringify(lines)} to price: ${r.error}`);
  const d = catalogueDeliveryOptions(b.catalogue!, r.order.goodsMinor)[deliveryIndex]!;
  return { id: "ord-fixture", lines: r.order.lines, goodsMinor: r.order.goodsMinor, delivery: { id: d.option.id, label: d.option.label, priceMinor: d.priceMinor } };
}
/** Every string in a value, however deep: what Stripe would receive as text. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}
const GYM_WORDS = (strings: string[]) => checkBrandCopy("gym", strings);
for (const b of NEW_BRANDS) {
  const first = b.catalogue!.packs.find((p) => p.available)!;
  const lines = [{ sku: first.sku, qty: 2 }, ...b.catalogue!.addOns.map((a) => ({ sku: a.sku, qty: 1 }))];
  const order = paymentOrder(b, lines);
  const s = brandSessionParams({ brand: b, order, now: NOW });
  const at = `${b.id} session`;
  const items = s.line_items ?? [];
  const names = items.map((l) => l.price_data?.product_data?.name ?? "");
  check(`${at}: payment mode, cards only`, s.mode === "payment" && JSON.stringify(s.payment_method_types) === '["card"]');
  check(`${at}: one line per priced line`, items.length === order.lines.length);
  check(`${at}: neutral line names`, names.every((n) => /^10ml bacteriostatic water × \d+$/.test(n) || b.catalogue!.addOns.some((a) => a.name === n)), names.join(" | "));
  check(`${at}: the pack's name says its vials`, names[0] === `10ml bacteriostatic water × ${first.vials}`);
  check(`${at}: prices and quantities from the catalogue`, items.every((l, i) => l.price_data?.unit_amount === order.lines[i]!.unitMinor && l.quantity === order.lines[i]!.quantity && l.price_data.currency === "gbp"));
  check(`${at}: the first line is the pack at its price`, items[0]?.price_data?.unit_amount === first.priceMinor && items[0]?.quantity === 2);
  check(`${at}: inline lines, no Stripe Products`, items.every((l) => !l.price && !l.price_data?.product && !!l.price_data?.product_data));
  check(`${at}: each line's product says brand and SKU`, items.every((l, i) => JSON.stringify(l.price_data?.product_data?.metadata) === JSON.stringify({ brand: b.id, sku: order.lines[i]!.sku })));
  check(`${at}: metadata`, JSON.stringify(s.metadata) === JSON.stringify({ orderId: "ord-fixture", brand: b.id, kind: "brand" }));
  check(`${at}: the same metadata on the PaymentIntent`, JSON.stringify(s.payment_intent_data?.metadata) === JSON.stringify(s.metadata));
  check(`${at}: our order id for reference`, s.client_reference_id === "ord-fixture");
  check(`${at}: descriptor suffix from the profile`, !!b.statementDescriptor && s.payment_intent_data?.statement_descriptor_suffix === b.statementDescriptor);
  check(`${at}: no promotion codes`, s.allow_promotion_codes === false && s.discounts === undefined);
  check(`${at}: no tax`, s.automatic_tax?.enabled === false);
  check(`${at}: a UK address`, JSON.stringify(s.shipping_address_collection?.allowed_countries) === '["GB"]');
  const rates = s.shipping_options ?? [];
  const rate = rates[0]?.shipping_rate_data;
  check(`${at}: one shipping rate, the delivery chosen on our page`, rates.length === 1 && rate?.metadata?.deliveryOption === order.delivery.id, JSON.stringify(rates));
  check(`${at}: charged at the chosen delivery's price`, rate?.type === "fixed_amount" && rate.fixed_amount?.amount === order.delivery.priceMinor && rate.fixed_amount.currency === "gbp");
  check(`${at}: the rate's id is one the webhook knows`, deliveryOptionById(String(rate?.metadata?.deliveryOption))?.id === order.delivery.id);
  check(`${at}: the rate is named for the option`, String(rate?.display_name).startsWith(`${order.delivery.label}: `), String(rate?.display_name));
  const fields = s.custom_fields ?? [];
  check(
    `${at}: the delivery instructions field, and nothing else asked`,
    fields.length === 1 && fields[0]!.key === "deliveryinstructions" && fields[0]!.optional === true && fields[0]!.text?.maximum_length === 30,
    JSON.stringify(fields)
  );
  check(`${at}: business details are taken on our page, not Stripe's`, s.tax_id_collection === undefined);
  check(`${at}: no dispatch notice midweek`, s.custom_text === undefined);
  check(`${at}: Stripe's 24 hours, no recovery`, s.expires_at === undefined && s.after_expiration === undefined && s.customer_email === undefined);
  check(`${at}: no branding while the origin is http`, s.branding_settings === undefined);
  check(`${at}: success URL on the brand's origin`, s.success_url === `${b.origin}/order-confirmation/ord-fixture?session_id={CHECKOUT_SESSION_ID}`);
  check(`${at}: cancel URL on the brand's origin`, s.cancel_url === `${b.origin}/#buy`);
  // Everything Stripe receives as text, branding aside: never the brand's
  // name, never BacLab's, never another brand's, and clean of every brand's
  // words, the gym's slang included.
  const text = stringsIn({ ...s, branding_settings: undefined, success_url: undefined, cancel_url: undefined });
  check(`${at}: never the brand's name`, text.every((t) => !t.includes(b.name)), text.filter((t) => t.includes(b.name)).join(" | "));
  check(`${at}: never BacLab`, text.every((t) => !/baclab/i.test(t)), text.filter((t) => /baclab/i.test(t)).join(" | "));
  for (const other of NEW_BRANDS.filter((o) => o.id !== b.id)) check(`${at}: never names ${other.id}`, text.every((t) => !t.includes(other.name)));
  check(`${at}: passes the content rules`, checkCompliance(text).length === 0, JSON.stringify(checkCompliance(text)));
  check(`${at}: passes its own copy rules`, checkBrandCopy(b.id, text).length === 0, JSON.stringify(checkBrandCopy(b.id, text)));
  check(`${at}: carries no gym slang`, GYM_WORDS(text).length === 0, JSON.stringify(GYM_WORDS(text)));
}
{
  // The delivery charged is the one chosen, at its price: beauty's next day.
  const beauty = brandFor("beauty");
  const order = paymentOrder(beauty, [{ sku: "BEA-10ML-X1", qty: 1 }], 1);
  const rate = brandSessionParams({ brand: beauty, order, now: NOW }).shipping_options?.[0]?.shipping_rate_data;
  check("session: the second option, when chosen, is the one charged", order.delivery.id === "next_day" && rate?.fixed_amount?.amount === 500 && rate.metadata?.deliveryOption === "next_day", JSON.stringify(rate));
  // Free delivery is still a rate, at nothing, so the webhook records it.
  const lux = brandFor("luxury");
  const free = brandSessionParams({ brand: lux, order: paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]), now: NOW }).shipping_options?.[0]?.shipping_rate_data;
  check("session: free delivery is a rate at nothing", free?.fixed_amount?.amount === 0 && free.metadata?.deliveryOption === "next_day");
  // The weekend notice, as on BacLab's sessions.
  const weekend = brandSessionParams({ brand: lux, order: paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]), now: SATURDAY });
  check("session: the dispatch notice at the weekend", /ship/i.test(JSON.stringify(weekend.custom_text?.shipping_address ?? "")), JSON.stringify(weekend.custom_text));
  check("session: the weekend notice passes the gym's rules", GYM_WORDS(stringsIn(weekend)).length === 0);
  // A catalogue that asked for codes still gets none.
  const coded = { ...lux, catalogue: { ...lux.catalogue!, allowPromotionCodes: true } };
  check("session: promotion codes stay off whatever the catalogue says", brandSessionParams({ brand: coded, order: paymentOrder(coded, [{ sku: "LUX-10ML-X1", qty: 1 }]), now: NOW }).allow_promotion_codes === false);
  // Branding only on https, with the images only when the profile has them.
  const https: BrandProfile = { ...lux, origin: "https://reserve.example", paymentPage: { logo: "/checkout/logo.png" } };
  const live = brandSessionParams({ brand: https, order: paymentOrder(https, [{ sku: "LUX-10ML-X1", qty: 1 }]), now: NOW });
  check("session: branding once the origin is https", live.branding_settings?.display_name === lux.name);
  check("session: the brand's colours", live.branding_settings?.background_color === lux.colours.paper && live.branding_settings.button_color === lux.colours.cta);
  check("session: the logo is a public https URL", JSON.stringify(live.branding_settings?.logo) === '{"type":"url","url":"https://reserve.example/checkout/logo.png"}');
  check("session: no icon when the profile has none", live.branding_settings?.icon === undefined);
  check("session: URLs on the https origin", live.success_url?.startsWith("https://reserve.example/order-confirmation/") === true && live.cancel_url === "https://reserve.example/#buy");
  const plain = brandSessionParams({ brand: { ...https, statementDescriptor: undefined }, order: paymentOrder(https, [{ sku: "LUX-10ML-X1", qty: 1 }]), now: NOW });
  check("session: no descriptor suffix when the profile has none", plain.payment_intent_data?.statement_descriptor_suffix === undefined);
  check("session: a long descriptor is cut to Stripe's 22", brandSessionParams({ brand: { ...lux, statementDescriptor: "RESERVE NUMBER TEN LIMITED" }, order: paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]), now: NOW }).payment_intent_data?.statement_descriptor_suffix === "RESERVE NUMBER TEN LIM");
  let threw = false;
  try {
    const o = paymentOrder(lux, [{ sku: "LUX-10ML-X1", qty: 1 }]);
    brandSessionParams({ brand: lux, order: { ...o, goodsMinor: o.goodsMinor + 1 }, now: NOW });
  } catch {
    threw = true;
  }
  check("session: lines that do not sum to the order are refused", threw);
}

// ── Public routes: a row only on its own brand's host ───────────────────
check("order-status: BacLab's order on BacLab's host", belongsToHost("baclab", "baclab.co.uk"));
check("order-status: BacLab's order on a mirror or unknown host", belongsToHost("baclab", "mirror.example") && belongsToHost(null, "localhost:3000"));
check("order-status: a brand's order on its own host", belongsToHost("luxury", "luxury.localhost:3000"));
check("order-status: a brand's order refused on BacLab's host", !belongsToHost("luxury", "baclab.co.uk"));
check("order-status: BacLab's order refused on a brand's host", !belongsToHost("baclab", "gym.localhost"));
check("order-status: one brand's order refused on another's", !belongsToHost("gym", "beauty.localhost"));
{
  const src = readFileSync(resolve(process.cwd(), "app/api/order-status/[id]/route.ts"), "utf8");
  check("order-status: the route checks the host", /belongsToHost\(order\.brand, req\.headers\.get\("host"\)\)/.test(src));
}

// ── BacLab never reaches brandCheckout ────────────────────────────────
for (const host of ["baclab.co.uk", "www.baclab.co.uk", "BACLAB.CO.UK:443", "localhost:3000", "127.0.0.1:3001", "mirror.example", "", null]) {
  check(`BacLab: "${host}" is BacLab's`, brandFromHost(host).id === DEFAULT_BRAND);
}
{
  const src = readFileSync(resolve(process.cwd(), "app/api/checkout/route.ts"), "utf8");
  const limit = src.indexOf("rateLimit(`checkout:");
  const branch = src.indexOf('const brand = brandFromHost(req.headers.get("host"));\n    if (brand.id !== DEFAULT_BRAND) return brandCheckout(req, brand);');
  const parse = src.indexOf("CheckoutSchema.safeParse(");
  check("BacLab: the branch sits after the rate limit and before BacLab's parsing", limit !== -1 && branch > limit && parse > branch, `${limit} ${branch} ${parse}`);
  check("BacLab: brandCheckout is called from that line only", src.split("brandCheckout(").length === 2);
}

/**
 * A provider that takes nothing anywhere: it records each order it is asked
 * to take payment for and answers with a page on a reserved test domain.
 */
function standInAdapter(asked: PaymentOrder[]): PaymentAdapter {
  return {
    id: "paypal",
    label: "Stand-in",
    configured: () => true,
    createPayment: async (order) => {
      asked.push(order);
      return { url: `https://pay.example.test/approve/${asked.length}`, ref: `stand-in-${asked.length}` };
    },
  };
}

async function routeChecks() {
  const { brandCheckout, businessDetailsNote, CHECKOUT_UNAVAILABLE } = await import("@/lib/commerce/checkout");
  const saved = { ...process.env };
  // BacLab's Stripe fully configured, as in production: a brand must still
  // never come near it.
  process.env.STRIPE_ENABLED = "true";
  process.env.STRIPE_SECRET_KEY = "sk_test_route_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_route_fixture";
  const post = (b: BrandProfile, body: unknown) =>
    brandCheckout(
      new Request(`${b.origin}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", host: new URL(b.origin).host },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      b
    );
  const lux = brandFor("luxury");
  const answer = async (res: Response) => ({ status: res.status, body: (await res.json()) as { error?: string; url?: string } });

  const bl = await answer(await post(brandFor(DEFAULT_BRAND), { lines: [{ sku: "LUX-10ML-X1", qty: 1 }] }));
  check("brandCheckout: refuses BacLab outright", bl.status === 404 && typeof bl.body.error === "string");
  const cases: [string, unknown, number, RegExp][] = [
    ["bad JSON", "{", 400, /Invalid order details/],
    ["no lines", { lines: [] }, 400, /Invalid order details/],
    ["a price in the body", { lines: [{ sku: "LUX-10ML-X1", qty: 1, priceMinor: 1 }] }, 400, /Invalid order details/],
    ["a brand in the body", { lines: [{ sku: "LUX-10ML-X1", qty: 1 }], brand: "baclab" }, 400, /Invalid order details/],
    ["an unknown SKU", { lines: [{ sku: "LUX-10ML-X2", qty: 1 }] }, 400, /Invalid order details/],
    ["qty over the limit", { lines: [{ sku: "LUX-10ML-X1", qty: 11 }] }, 400, /Invalid order details/],
    ["a delivery option not offered", { lines: [{ sku: "LUX-10ML-X1", qty: 1 }], deliveryOption: "standard" }, 400, /delivery option/],
  ];
  for (const [what, body, status, re] of cases) {
    const r = await answer(await post(lux, body));
    check(`brandCheckout: ${what} is a ${status} { error }`, r.status === status && re.test(r.body.error ?? "") && r.body.url === undefined, JSON.stringify(r));
  }
  const unavailable = await answer(await post(brandFor("wholesale"), { lines: [{ sku: "WHL-10ML-X500", qty: 1 }] }));
  check("brandCheckout: an unavailable pack is a 400 { error }", unavailable.status === 400 && /can't be ordered online/.test(unavailable.body.error ?? ""));
  const big = await answer(await post(brandFor("wholesale"), { lines: [{ sku: "WHL-10ML-X100", qty: 2 }] }));
  check("brandCheckout: too many vials is a 400 { error }", big.status === 400 && /up to 100 vials/.test(big.body.error ?? ""));
  const none = await answer(await post(lux, { lines: [{ sku: "LUX-10ML-X1", qty: 1 }] }));
  check("brandCheckout: no way to pay is a 503, before any order is written", none.status === 503 && none.body.error === CHECKOUT_UNAVAILABLE);
  check("brandCheckout: the refusal names no provider or method", !/stripe|paypal|card/i.test(CHECKOUT_UNAVAILABLE));

  // A stand-in provider, "configured" for every brand: what the profile
  // lists still decides, and the request's choices are checked before any
  // order is written (these would need the database past that point).
  const { __registerTestPaymentAdapter, __clearTestPaymentAdapters, brandPaymentAdapters, choosePaymentAdapter } = await import("@/lib/commerce/payments");
  __registerTestPaymentAdapter(standInAdapter([]));
  check("providers: listed and configured is offered", brandPaymentAdapters(lux).map((a) => a.id).join() === "paypal");
  check("providers: the gym lists none, so none is offered whatever is set", brandPaymentAdapters(brandFor("gym")).length === 0);
  check("providers: BacLab is never offered one", brandPaymentAdapters(brandFor(DEFAULT_BRAND)).length === 0);
  const two = { ...lux, paymentProviders: ["paypal", "paypal"] as const };
  check("providers: a provider listed twice is offered once", brandPaymentAdapters(two).length === 1);
  check("providers: the only one needs no method", choosePaymentAdapter(lux, undefined, "x").ok);
  const gymPay = await answer(await post(brandFor("gym"), { lines: [{ sku: "GYM-10ML-X10", qty: 1 }] }));
  check("brandCheckout: the gym is a 503 even with a provider configured", gymPay.status === 503 && gymPay.body.error === CHECKOUT_UNAVAILABLE);
  const refusals: [string, BrandProfile, unknown, RegExp][] = [
    ["a method the brand does not offer", lux, { lines: [{ sku: "LUX-10ML-X1", qty: 1 }], method: "stripe" }, /^That payment method is not available\.$/],
    ["no delivery choice while there are two", brandFor("beauty"), { lines: [{ sku: "BEA-10ML-X1", qty: 1 }] }, /^Choose a delivery option\.$/],
    ["business details on a consumer site", lux, { lines: [{ sku: "LUX-10ML-X1", qty: 1 }], business: { company: "Acme" } }, /Invalid order details/],
    ["an unknown business field", brandFor("wholesale"), { lines: [{ sku: "WHL-10ML-X50", qty: 1 }], business: { iban: "x" } }, /Invalid order details/],
  ];
  for (const [what, b, body, re] of refusals) {
    const r = await answer(await post(b, body));
    check(`brandCheckout: ${what} is a 400`, r.status === 400 && re.test(r.body.error ?? ""), JSON.stringify(r));
  }
  check(
    "business details: company and VAT into the notes",
    businessDetailsNote({ company: "  Acme   Labs Ltd ", vatNumber: "GB123456789" }) === "Company: Acme Labs Ltd\nVAT number: GB123456789"
  );
  check("business details: nothing when none given", businessDetailsNote(undefined) === "" && businessDetailsNote({ company: "  " }) === "");
  __clearTestPaymentAdapters();

  // Every brand's host, through the real route, with BacLab's Stripe keys
  // set: not one Stripe client is made. The route itself loads the SDK (for
  // BacLab), so this is the trap's word, not just the import graph's.
  const { POST: route } = await import("@/app/api/checkout/route");
  const before = stripeClientsMade();
  let n = 0;
  for (const b of NEW_BRANDS) {
    const first = b.catalogue!.packs.find((p) => p.available)!;
    const deliveryOption = catalogueDeliveryOptions(b.catalogue!, first.priceMinor)[0]!.option.id;
    const host = new URL(b.origin).host;
    const res = await route(
      new Request(`http://${host}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", host, origin: `http://${host}`, "x-forwarded-for": `198.51.100.${++n}` },
        body: JSON.stringify({ lines: [{ sku: first.sku, qty: 1 }], deliveryOption }),
      })
    );
    check(`no Stripe: ${b.id}'s checkout is answered without BacLab's`, res.status === 503, String(res.status));
  }
  check("no Stripe: no brand's checkout made a Stripe client", stripeClientsMade() === before, `${stripeClientsMade() - before} made`);
  // The control: the trap does see a client being made.
  const { getStripe } = await import("@/lib/payments/stripe");
  getStripe();
  check("no Stripe: the trap counts a client when one is made", stripeClientsMade() === before + 1);
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
}

type CreatedSession = { params: Stripe.Checkout.SessionCreateParams; options?: Stripe.RequestOptions };

/**
 * BacLab's own Stripe client (getStripe), with its Checkout Session calls
 * answered here: create records what it was asked and returns a session on
 * Stripe's page; nothing is sent. Makes the client if it is not made yet.
 */
async function fakeStripeSessions(): Promise<CreatedSession[]> {
  const { getStripe } = await import("@/lib/payments/stripe");
  const sessions = getStripe().checkout.sessions as unknown as Record<string, unknown>;
  const created: CreatedSession[] = [];
  sessions.create = async (params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions) => {
    created.push({ params, options });
    const id = `cs_test_fixture_${created.length}`;
    return { id, object: "checkout.session", url: `https://checkout.stripe.com/c/pay/${id}` };
  };
  return created;
}

/** A session's params without the two texts that read the clock (next day's arrival day, the weekend notice). */
function withoutClock(p: Stripe.Checkout.SessionCreateParams) {
  return {
    ...p,
    custom_text: undefined,
    shipping_options: p.shipping_options?.map((o) => ({ ...o, shipping_rate_data: o.shipping_rate_data && { ...o.shipping_rate_data, display_name: "" } })),
  };
}

/**
 * The Stripe adapter: when it is on, and the session it makes against
 * BacLab's own client, with Stripe answered here.
 */
async function stripeAdapterChecks() {
  const saved = { ...process.env };
  const { stripeAdapter } = await import("@/lib/commerce/payments/stripe");
  const lux = brandFor("luxury");
  for (const k of ["STRIPE_ENABLED", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) delete process.env[k];
  check("stripe adapter: off without BacLab's Stripe settings", !stripeAdapter.configured(lux));
  process.env.STRIPE_ENABLED = "true";
  check("stripe adapter: never the keyless dev simulator", !stripeAdapter.configured(lux));
  process.env.STRIPE_SECRET_KEY = "sk_test_adapter_fixture";
  check("stripe adapter: off without the webhook secret, which confirms the payment", !stripeAdapter.configured(lux));
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_adapter_fixture";
  check("stripe adapter: on with BacLab's switch and both keys", stripeAdapter.configured(lux));
  check("stripe adapter: the same account for every brand, with no key of its own", NEW_BRANDS.every((b) => stripeAdapter.configured(b)));
  process.env.STRIPE_ENABLED = "false";
  check("stripe adapter: off when BacLab's cards are switched off", !stripeAdapter.configured(lux));
  process.env.STRIPE_ENABLED = "true";
  check("stripe adapter: its orders are card orders, as BacLab's are", stripeAdapter.id === "stripe" && stripeAdapter.paymentMethod === "card");

  const created = await fakeStripeSessions();
  const order = paymentOrder(lux, [{ sku: "LUX-10ML-X3", qty: 2 }]);
  const made = await stripeAdapter.createPayment(order, { brand: lux });
  check("stripe adapter: one session made", created.length === 1);
  check("stripe adapter: the buyer goes to Stripe's page", made.url === "https://checkout.stripe.com/c/pay/cs_test_fixture_1" && made.ref === "cs_test_fixture_1", JSON.stringify(made));
  check("stripe adapter: keyed on the order, as BacLab's sessions are", created[0]?.options?.idempotencyKey === "checkout:ord-fixture", JSON.stringify(created[0]?.options));
  check(
    "stripe adapter: exactly the session brandSessionParams describes",
    JSON.stringify(withoutClock(created[0]!.params)) === JSON.stringify(withoutClock(brandSessionParams({ brand: lux, order, now: new Date() })))
  );
  const { getStripe } = await import("@/lib/payments/stripe");
  const sessions = getStripe().checkout.sessions as unknown as Record<string, unknown>;
  sessions.create = async () => ({ id: "cs_test_nourl", url: null });
  let threw = false;
  try {
    await stripeAdapter.createPayment(order, { brand: lux });
  } catch {
    threw = true;
  }
  check("stripe adapter: a session with nowhere to send the buyer throws", threw);
  sessions.create = async () => Promise.reject(new Error("card_declined"));
  threw = false;
  try {
    await stripeAdapter.createPayment(order, { brand: lux });
  } catch {
    threw = true;
  }
  check("stripe adapter: Stripe's refusal throws, so the order stays unpaid", threw);
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
}

/**
 * Against a throwaway SQLite file: migrate it, seed the brand SKUs, and check
 * out through the real route. Refuses the real database and any database
 * that already has orders.
 */
async function databaseChecks() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:") || /data\/baclab\.db/.test(url)) {
    console.error("Refusing the database checks: point DATABASE_URL at a throwaway SQLite file.");
    process.exit(1);
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, stdio: "ignore" });

  // Nothing leaves this process: every fetch (FX rates, Meta, Resend) fails at once.
  process.env.STRIPE_ENABLED = "true";
  process.env.STRIPE_SECRET_KEY = "sk_test_db_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_db_fixture";
  process.env.NEXT_PUBLIC_LAB_KIT = "1";
  globalThis.fetch = (async () => {
    throw new Error("no network in test-brand-checkout");
  }) as typeof fetch;
  const log = console.log;
  const error = console.error;
  console.log = (...a: unknown[]) => {
    if (!String(a[0]).startsWith("[dev email]")) log(...a);
  };
  console.error = (...a: unknown[]) => {
    if (!/fx rate fetch failed/.test(String(a[0]))) error(...a);
  };

  const { prisma } = await import("@/lib/db");
  if ((await prisma.order.count()) > 0) {
    console.error("Refusing the database checks: the database already has orders. Use a fresh one.");
    process.exit(1);
  }
  const { seedBrandSkus } = await import("@/lib/inventory/brand-skus");
  const { POST: checkout } = await import("@/app/api/checkout/route");

  await prisma.product.create({
    data: { slug: "baclab-10ml", name: `${PRODUCT.name} ${PRODUCT.size}`, description: "x", priceGbp: SINGLE_BUNDLE.priceMinor / 100, stock: 200, supplyDays: 30 },
  });
  await prisma.product.create({ data: { slug: LAB_KIT.sku, name: LAB_KIT.name, description: "x", priceGbp: 5.99, stock: 20 } });
  const seeded = await seedBrandSkus(prisma, { apply: true });
  check("db: the seed creates every box and pack", seeded.created.includes("LUX-BOX") && seeded.created.includes("GYM-10ML-X10"));
  check("db: the seed is idempotent", (await seedBrandSkus(prisma, { apply: true })).created.length === 0);
  const luxKit = await prisma.sku.findUnique({ where: { code: "LUX-10ML-X3" }, include: { components: { include: { component: true } } } });
  check(
    "db: a pack's kit is N shared vials + the brand's box",
    JSON.stringify(Object.fromEntries(luxKit?.components.map((c) => [c.component.code, c.quantity]) ?? [])) ===
      JSON.stringify(Object.fromEntries([[VIAL_SKU_CODE, 3], ["LUX-BOX", 1]].sort())),
    JSON.stringify(luxKit?.components.map((c) => [c.component.code, c.quantity]))
  );

  let ip = 0;
  const post = (host: string, body: unknown) =>
    checkout(
      new Request(`http://${host}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", host, origin: `http://${host}`, "x-forwarded-for": `203.0.113.${++ip}` },
        body: JSON.stringify(body),
      })
    );

  // BacLab's host never reaches the brand checkout, whatever the body.
  const bl = await post("baclab.co.uk", { lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  check("db: on BacLab's host a brand body is BacLab's to refuse", bl.status === 400 && (await prisma.order.count()) === 0);

  // No brand has a way to pay: refused, and nothing is written.
  const made = stripeClientsMade();
  for (const host of ["gym.localhost:3000", "luxury.localhost:3000"]) {
    const res = await post(host, { lines: [{ sku: host.startsWith("gym") ? "GYM-10ML-X10" : "LUX-10ML-X3", qty: 1 }] });
    check(`db: ${host} without a way to pay is a 503`, res.status === 503);
  }
  check("db: no order is written without a way to pay", (await prisma.order.count()) === 0);

  // A stand-in provider for every brand: the gym still takes nothing.
  const { __registerTestPaymentAdapter, __clearTestPaymentAdapters } = await import("@/lib/commerce/payments");
  const { fulfillPaidOrder } = await import("@/lib/payments/fulfillment");
  const { setInventoryMode } = await import("@/lib/inventory/mode");
  const { receiveStock } = await import("@/lib/inventory/store");
  const asked: PaymentOrder[] = [];
  __registerTestPaymentAdapter(standInAdapter(asked));
  const gymRes = await post("gym.localhost:3000", { lines: [{ sku: "GYM-10ML-X10", qty: 1 }] });
  check("db: the gym takes no payment, whatever is configured", gymRes.status === 503 && (await prisma.order.count()) === 0);

  // Legacy stock: luxury's 3-pack twice, by next day, the only option it offers.
  const luxRes = await post("luxury.localhost:3000", { lines: [{ sku: "LUX-10ML-X3", qty: 2 }], consent: { tracking: false } });
  const luxBody = (await luxRes.json()) as { url?: string; error?: string };
  check("db: luxury checks out to the provider's page", luxRes.status === 200 && luxBody.url === "https://pay.example.test/approve/1", JSON.stringify(luxBody));
  const luxOrder = await prisma.order.findFirst({ where: { brand: "luxury" } });
  check("db: the order is luxury's, pending, priced from its catalogue", luxOrder?.status === "pending" && Number(luxOrder.totalAmount) === 43.98);
  check("db: the order names its provider", luxOrder?.paymentProvider === "paypal" && luxOrder.paymentMethod === "paypal");
  check("db: the order holds the provider's reference", luxOrder?.paymentRef === "stand-in-1");
  check("db: the delivery is recorded at checkout", luxOrder?.deliveryOption === "next_day" && luxOrder.deliveryMinor === 0);
  check("db: the provider is asked for the order as priced", asked[0]?.id === luxOrder?.id && asked[0]?.goodsMinor === 4398 && asked[0]?.lines.length === 1);
  check("db: the provider is told the delivery", asked[0]?.delivery.id === "next_day" && asked[0]?.delivery.priceMinor === 0);
  const paid = await fulfillPaidOrder(luxOrder!.id, { paymentRef: "capture-lux", provider: "paypal", deliveryMinor: 0, amountPaidMinor: 4398 });
  const luxAfter = await prisma.order.findUnique({ where: { id: luxOrder!.id } });
  check("db: fulfilment marks it paid, by its provider", !paid.alreadyPaid && luxAfter?.status === "paid" && luxAfter.paymentProvider === "paypal");
  check("db: and keeps the brand", luxAfter?.brand === "luxury");
  const vial = await prisma.product.findUniqueOrThrow({ where: { slug: "baclab-10ml" } });
  check("db: the shared vials came off the shelf", vial.stock === 194, String(vial.stock));

  // Beauty: two delivery options, so the buyer's choice is sent and charged.
  const beaRes = await post("beauty.localhost:3000", { lines: [{ sku: "BEA-10ML-X1", qty: 1 }], deliveryOption: "standard" });
  check("db: beauty checks out with the delivery it chose", beaRes.status === 200);
  const bea = await prisma.order.findFirst({ where: { brand: "beauty" } });
  check("db: the chosen delivery and its price are recorded", bea?.deliveryOption === "standard" && bea.deliveryMinor === 390, `${bea?.deliveryOption} ${bea?.deliveryMinor}`);

  // Wholesale: the trade buyer's details go into the notes.
  const whlRes = await post("wholesale.localhost:3000", {
    lines: [{ sku: "WHL-10ML-X50", qty: 1 }],
    business: { company: "Acme Labs Ltd", vatNumber: "GB123456789" },
  });
  check("db: wholesale checks out", whlRes.status === 200);
  const whl = await prisma.order.findFirst({ where: { brand: "wholesale" } });
  check("db: company and VAT number in the notes", !!whl?.notes?.includes("Company: Acme Labs Ltd") && !!whl.notes.includes("VAT number: GB123456789"), String(whl?.notes));

  // A provider that refuses: the order stays unpaid, with nothing attached.
  __registerTestPaymentAdapter({ ...standInAdapter([]), createPayment: async () => Promise.reject(new Error("refused")) });
  const refused = await post("luxury.localhost:3000", { lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  check("db: a provider's refusal is a 502", refused.status === 502);
  check("db: and leaves the order unpaid, with no payment attached", (await prisma.order.count({ where: { brand: "luxury", paymentRef: null, status: "pending" } })) === 1);
  __registerTestPaymentAdapter(standInAdapter(asked));

  // Warehouse mode: the pack is allocated as its kit, from the shared vials and the brand's boxes.
  const warehouse = await prisma.warehouse.create({ data: { code: "MAIN", name: "Main" } });
  const shelf = await prisma.location.create({ data: { warehouseId: warehouse.id, code: "A1" } });
  for (const [code, quantity] of [[VIAL_SKU_CODE, 40], ["LUX-BOX", 5]] as const) {
    const sku = await prisma.sku.findUniqueOrThrow({ where: { code } });
    await receiveStock({ skuId: sku.id, locationId: shelf.id, quantity, reference: "test", actor: "test" });
  }
  await setInventoryMode("warehouse");
  const shelfRes = await post("luxury.localhost:3000", { lines: [{ sku: "LUX-10ML-X3", qty: 2 }] });
  check("db: luxury checks out against the shelves", shelfRes.status === 200);
  const tooMany = await post("luxury.localhost:3000", { lines: [{ sku: "LUX-10ML-X3", qty: 6 }] });
  check("db: the brand's boxes limit what it can sell", tooMany.status === 409);
  const shelfOrder = await prisma.order.findFirst({ where: { brand: "luxury", paymentRef: `stand-in-${asked.length}` } });
  await fulfillPaidOrder(shelfOrder!.id, { paymentRef: "capture-shelf", provider: "paypal", deliveryMinor: 0 });
  const picks = await prisma.pickLine.findMany({ where: { orderId: shelfOrder!.id }, include: { sku: true } });
  const picked = Object.fromEntries(picks.map((p) => [p.sku.code, p.quantity]));
  check("db: allocated as 6 shared vials and 2 brand boxes", picked[VIAL_SKU_CODE] === 6 && picked["LUX-BOX"] === 2, JSON.stringify(picked));
  await setInventoryMode("legacy");
  __clearTestPaymentAdapters();

  await paypalChecks(post, () => `192.0.2.${++ip}`);

  // The confirmations go out after fulfilment answers; wait for them.
  const paidOrders = await prisma.order.count({ where: { status: "paid" } });
  for (let i = 0; i < 60 && (await prisma.emailLog.count({ where: { type: "confirmation" } })) < paidOrders; i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  check("db: each paid order is confirmed by email", (await prisma.emailLog.count({ where: { type: "confirmation" } })) === paidOrders, String(paidOrders));
  check("db: and no Stripe client is made", stripeClientsMade() === made);
  console.log = log;
  console.error = error;
  await prisma.$disconnect();
}

/**
 * PayPal, end to end against the database, with PayPal faked
 * (scripts/fixtures/fake-paypal.ts): the checkout, the buyer's return, and
 * the webhook as the backup. The fake keeps each PayPal order's state and
 * replays a repeated PayPal-Request-Id as PayPal does, so idempotency is
 * PayPal's own rule here, not an assumption.
 */
async function paypalChecks(post: (host: string, body: unknown) => Promise<Response>, nextIp: () => string) {
  const { prisma } = await import("@/lib/db");
  const { GET: paypalReturn } = await import("@/app/api/payments/paypal/return/route");
  const { POST: paypalWebhook } = await import("@/app/api/webhooks/paypal/route");
  const paypal = fakePayPal();
  setPayPalEnv("luxury", "sandbox");

  type Fake = { customId: string; status: string; country: string; captureValue?: string; capture?: string };
  const orders = new Map<string, Fake>();
  const replays = new Map<string, Response>();
  let verification = "SUCCESS";
  let declineNext = false;
  const show = (id: string) => {
    const o = orders.get(id)!;
    return paypalOrderJson({
      id,
      status: o.status,
      customId: o.customId,
      country: o.country,
      ...(o.capture ? { capture: { id: o.capture, status: "COMPLETED", value: o.captureValue! } } : {}),
    });
  };
  paypal.respond = (c) => {
    const key = c.headers.get("paypal-request-id");
    if (key && replays.has(key)) return replays.get(key)!.clone();
    let res: Response | undefined;
    const path = c.url.pathname;
    if (path === "/v2/checkout/orders" && c.method === "POST") {
      const body = JSON.parse(c.body) as { purchase_units: { custom_id: string; amount: { value: string } }[] };
      const id = `PPDB${orders.size + 1}`;
      orders.set(id, { customId: body.purchase_units[0]!.custom_id, status: "PAYER_ACTION_REQUIRED", country: "GB", captureValue: body.purchase_units[0]!.amount.value });
      res = json(201, { id, status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` }] });
    } else if (path.startsWith("/v2/checkout/orders/") && path.endsWith("/capture")) {
      const id = path.split("/")[4]!;
      const o = orders.get(id);
      if (!o) res = json(404, { name: "RESOURCE_NOT_FOUND" });
      else if (declineNext) {
        declineNext = false;
        res = json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] });
      } else if (o.status === "COMPLETED") res = json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] });
      else if (o.status !== "APPROVED") res = json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_NOT_APPROVED" }] });
      else {
        o.status = "COMPLETED";
        o.capture = `CAP${id}`;
        res = json(201, show(id));
      }
    } else if (path.startsWith("/v2/checkout/orders/") && c.method === "GET") {
      const id = path.split("/")[4]!;
      res = orders.has(id) ? json(200, show(id)) : json(404, { name: "RESOURCE_NOT_FOUND" });
    } else if (path === "/v1/notifications/verify-webhook-signature") {
      res = json(200, { verification_status: verification });
    }
    if (res && key) replays.set(key, res.clone());
    return res;
  };
  const captures = () => paypal.calls.filter((c) => c.url.pathname.endsWith("/capture")).length;
  const verifies = () => paypal.calls.filter((c) => c.url.pathname.endsWith("/verify-webhook-signature")).length;
  const back = (host: string, id: string) =>
    paypalReturn(new Request(`http://${host}/api/payments/paypal/return?order=${id}&token=x&PayerID=y`, { headers: { host, "x-forwarded-for": nextIp() } }));
  const hook = (event: unknown, environment: "sandbox" | "live" = "sandbox") =>
    paypalWebhook(new Request("http://luxury.localhost:3000/api/webhooks/paypal", { method: "POST", headers: webhookHeaders(environment), body: JSON.stringify(event) }));
  const checkoutFor = async (body: unknown) => {
    const res = await post("luxury.localhost:3000", body);
    const data = (await res.json()) as { url?: string };
    const ref = data.url?.split("token=")[1] ?? "";
    return { res, ref, order: await prisma.order.findFirst({ where: { paymentRef: ref } }) };
  };
  const vials = async () => (await prisma.product.findUniqueOrThrow({ where: { slug: "baclab-10ml" } })).stock;

  // 1. Checkout → PayPal's page, the order pending with PayPal's order on it.
  const first = await checkoutFor({ lines: [{ sku: "LUX-10ML-X3", qty: 1 }] });
  check("paypal db: checkout sends the buyer to PayPal", first.res.status === 200 && first.ref === "PPDB1");
  const o1 = first.order!;
  check("paypal db: the order is pending, by PayPal", o1?.status === "pending" && o1.paymentProvider === "paypal" && o1.brand === "luxury");
  check("paypal db: PayPal was given our order id", orders.get("PPDB1")?.customId === o1.id);

  // 2. The return on any other host is refused, and PayPal is not called.
  const callsBefore = paypal.calls.length;
  for (const host of ["beauty.localhost:3000", "baclab.co.uk", "gym.localhost:3000"]) {
    check(`paypal db: the return on ${host} is refused`, (await back(host, o1.id)).status === 404);
  }
  check("paypal db: a refused return never calls PayPal", paypal.calls.length === callsBefore);
  check("paypal db: nor touches the order", (await prisma.order.findUniqueOrThrow({ where: { id: o1.id } })).status === "pending");

  // 3. Back without approving: to the buy section, nothing taken.
  const notYet = await back("luxury.localhost:3000", o1.id);
  check("paypal db: back before approving reads as cancelled", notYet.headers.get("location")?.endsWith("/?payment=cancelled#buy") === true && captures() === 0);

  // 4. Approved, back on the brand's host: captured and paid.
  const before = await vials();
  orders.get("PPDB1")!.status = "APPROVED";
  const paidBack = await back("luxury.localhost:3000", o1.id);
  const p1 = await prisma.order.findUniqueOrThrow({ where: { id: o1.id } });
  check("paypal db: the return captures and goes to the confirmation", paidBack.status === 303 && paidBack.headers.get("location") === `http://luxury.localhost:3000/order-confirmation/${o1.id}?paid=1`, String(paidBack.headers.get("location")));
  check("paypal db: paid, by PayPal, against the capture", p1.status === "paid" && p1.paymentProvider === "paypal" && p1.paymentRef === "CAPPPDB1");
  check("paypal db: the amount charged is the capture's", p1.amountPaidMinor === 2199);
  check(
    "paypal db: the buyer's details from PayPal, in the Stripe webhook's shape",
    p1.customerEmail === "buyer@example.com" && p1.customerName === "Sam Buyer" && p1.customerPhone === "07700900123" &&
      p1.shippingAddress === JSON.stringify({ line1: "1 Mill Lane", line2: "Flat 2", city: "Leeds", country: "GB", postalCode: "LS1 1AA" })
  );
  check("paypal db: the stock came off the shared shelf", (await vials()) === before - 3, `${before} → ${await vials()}`);

  // 5. Every repeat is a no-op: the return again, and the webhooks for it.
  const capturesAfter = captures();
  const again = await back("luxury.localhost:3000", o1.id);
  check("paypal db: a second return goes to the confirmation without capturing", again.headers.get("location")?.includes(`/order-confirmation/${o1.id}`) === true && captures() === capturesAfter);
  const completed = { id: "WH-DB-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource_type: "capture", resource: { id: "CAPPPDB1", custom_id: o1.id, supplementary_data: { related_ids: { order_id: "PPDB1" } } } };
  const approvedEvent = { id: "WH-DB-2", event_type: "CHECKOUT.ORDER.APPROVED", resource_type: "checkout-order", resource: { id: "PPDB1", purchase_units: [{ custom_id: o1.id }] } };
  for (const event of [completed, completed, approvedEvent]) check(`paypal db: a duplicate ${event.event_type} is acknowledged`, (await hook(event)).status === 200);
  check("paypal db: and does nothing", captures() === capturesAfter && (await vials()) === before - 3 && (await prisma.order.findUniqueOrThrow({ where: { id: o1.id } })).paymentRef === "CAPPPDB1");

  // 6. The webhook as the backup, for a buyer who closed the tab.
  const second = await checkoutFor({ lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  const o2 = second.order!;
  orders.get(second.ref)!.status = "APPROVED";
  const approved2 = { id: "WH-DB-3", event_type: "CHECKOUT.ORDER.APPROVED", resource_type: "checkout-order", resource: { id: second.ref, purchase_units: [{ custom_id: o2.id }] } };
  verification = "FAILURE";
  const verifiesBefore = verifies();
  check("paypal db: an unverified event is refused", (await hook(approved2)).status === 400 && verifies() === verifiesBefore + 1);
  check("paypal db: and never acted on", (await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).status === "pending" && orders.get(second.ref)!.status === "APPROVED");
  verification = "SUCCESS";
  const wrongEnv = await hook(approved2, "live");
  check("paypal db: an event from live for a sandbox brand is ignored", wrongEnv.status === 200 && ((await wrongEnv.json()) as { ignored?: string }).ignored === "environment-mismatch");
  check("paypal db: without even being verified or acted on", verifies() === verifiesBefore + 1 && (await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).status === "pending");
  const bareHeaders = webhookHeaders("sandbox");
  bareHeaders.delete("paypal-transmission-sig");
  const unsigned = await paypalWebhook(new Request("http://luxury.localhost:3000/api/webhooks/paypal", { method: "POST", headers: bareHeaders, body: JSON.stringify(approved2) }));
  check("paypal db: an unsigned event is refused", unsigned.status === 400 && (await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).status === "pending");
  check("paypal db: the verified approval captures and pays", (await hook(approved2)).status === 200 && (await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).status === "paid");
  const lateReturn = await back("luxury.localhost:3000", o2.id);
  check("paypal db: the buyer's late return finds it paid", lateReturn.headers.get("location")?.includes("/order-confirmation/") === true);

  // 7. A capture for a different amount is logged, never blocked.
  const third = await checkoutFor({ lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  orders.get(third.ref)!.status = "APPROVED";
  orders.get(third.ref)!.captureValue = "1.00";
  const logged: string[] = [];
  const error = console.error;
  console.error = (...a: unknown[]) => {
    logged.push(a.map(String).join(" "));
  };
  await back("luxury.localhost:3000", third.order!.id);
  console.error = error;
  check("paypal db: an amount mismatch is logged", logged.some((l) => l.includes(`AMOUNT MISMATCH on order ${third.order!.id}`)), logged.join(" | "));
  check("paypal db: and the order is still paid", (await prisma.order.findUniqueOrThrow({ where: { id: third.order!.id } })).status === "paid");

  // 8. An address we do not deliver to: nothing is captured.
  const fourth = await checkoutFor({ lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  orders.get(fourth.ref)!.status = "APPROVED";
  orders.get(fourth.ref)!.country = "FR";
  const capturesBeforeFr = captures();
  const fr = await back("luxury.localhost:3000", fourth.order!.id);
  check("paypal db: a non-UK address is sent back, not captured", fr.headers.get("location")?.endsWith("/?payment=address#buy") === true && captures() === capturesBeforeFr);
  check("paypal db: and the order stays unpaid", (await prisma.order.findUniqueOrThrow({ where: { id: fourth.order!.id } })).status === "pending");

  // 9. Declined at capture: back to the buy section, unpaid.
  const fifth = await checkoutFor({ lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  orders.get(fifth.ref)!.status = "APPROVED";
  declineNext = true;
  const declined = await back("luxury.localhost:3000", fifth.order!.id);
  check("paypal db: a declined capture says so", declined.headers.get("location")?.endsWith("/?payment=declined#buy") === true);
  check("paypal db: and leaves the order unpaid", (await prisma.order.findUniqueOrThrow({ where: { id: fifth.order!.id } })).status === "pending");

  // 10. A refund is noted on the order, once per event.
  const refund = { id: "WH-DB-9", event_type: "PAYMENT.CAPTURE.REFUNDED", resource_type: "refund", resource: { id: "REF1", amount: { value: "21.99", currency_code: "GBP" }, links: [{ rel: "up", href: "https://api.sandbox.paypal.com/v2/payments/captures/CAPPPDB1" }] } };
  await hook(refund);
  await hook(refund);
  const refundedNotes = (await prisma.order.findUniqueOrThrow({ where: { id: o1.id } })).notes ?? "";
  check("paypal db: a refund is noted on its order", refundedNotes.includes("PayPal refunded: 21.99 GBP (event WH-DB-9"), refundedNotes);
  check("paypal db: once, however often it is sent", refundedNotes.split("WH-DB-9").length === 2);

  // 11. An event for an order that is not PayPal's is never acted on.
  const stripeOrder = await prisma.order.create({
    data: { status: "pending", items: "[]", currency: "GBP", totalAmount: 1, paymentMethod: "card", paymentProvider: "stripe", paymentRef: "cs_test_x" },
  });
  const foreign = { ...approvedEvent, id: "WH-DB-10", resource: { id: "PPX", purchase_units: [{ custom_id: stripeOrder.id }] } };
  const foreignRes = await hook(foreign);
  check("paypal db: an event naming a Stripe order is ignored", foreignRes.status === 200 && ((await foreignRes.json()) as { ignored?: string }).ignored === "unknown-order");
  await prisma.order.delete({ where: { id: stripeOrder.id } });

  // 12. The nightly clear-up asks PayPal, with the brand's own credentials, and never Stripe.
  const { clearAbandonedCheckouts } = await import("@/lib/payments/abandoned");
  orders.delete(fourth.ref);
  const cleared = await clearAbandonedCheckouts();
  check("paypal db: the clear-up removes an order PayPal no longer has", cleared.cleared >= 1 && !(await prisma.order.findUnique({ where: { id: fourth.order!.id } })));
  check("paypal db: and keeps one PayPal still has open", !!(await prisma.order.findUnique({ where: { id: fifth.order!.id } })));

  paypal.restore();
  clearPayPalEnv();
  // Back to the network-free fetch the rest of the checks run with.
  globalThis.fetch = (async () => {
    throw new Error("no network in test-brand-checkout");
  }) as typeof fetch;
}

async function main() {
  await routeChecks();
  await stripeAdapterChecks();
  if (process.env.BRAND_CHECKOUT_DB === "1") await databaseChecks();
  else console.log("  (database checks skipped: set BRAND_CHECKOUT_DB=1 and DATABASE_URL to a throwaway SQLite file)");
  if (failures > 0) {
    console.error(`\n${failures} brand checkout check(s) failed`);
    process.exit(1);
  }
  console.log(`brand checkout checks passed (${allBrands().length} brands)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
