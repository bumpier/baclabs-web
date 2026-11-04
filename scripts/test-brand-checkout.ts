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
 * the real route.
 */
// First: it counts every Stripe client made from here on (see the file).
import { stripeClientsMade } from "./fixtures/stripe-trap";
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
import { checkCompliance } from "@/lib/content-rules";

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

// ── No brand reaches Stripe: the checkout's code never loads it ─────────
// BacLab's Stripe account is BacLab's alone. Every module the brand checkout
// can run, followed import by import from lib/commerce/checkout.ts, must
// stay clear of lib/payments/stripe.ts and the SDK itself: code that is
// never loaded cannot make a client, by a fallback or any other way. The
// trap check in routeChecks proves the same at run time.
const ROOT = process.cwd();
function moduleFile(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? resolve(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(base + ext) && /\.tsx?$/.test(base + ext)) return base + ext;
  }
  return null;
}
function moduleGraph(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [resolve(ROOT, entry)];
  while (queue.length > 0) {
    const file = queue.pop()!;
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
  return { files, packages };
}
{
  const graph = moduleGraph("lib/commerce/checkout.ts");
  const stripeModule = resolve(ROOT, "lib/payments/stripe.ts");
  check("no Stripe: the brand checkout's modules were followed", graph.files.size > 1, String(graph.files.size));
  check("no Stripe: the brand checkout never loads lib/payments/stripe.ts", !graph.files.has(stripeModule));
  check("no Stripe: the brand checkout never loads the Stripe SDK", !graph.packages.has("stripe"), [...graph.packages].join());
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

async function routeChecks() {
  const { brandCheckout, CHECKOUT_UNAVAILABLE } = await import("@/lib/commerce/checkout");
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

  // Every brand's host, through the real route, with BacLab's Stripe keys
  // set: not one Stripe client is made. The route itself loads the SDK (for
  // BacLab), so this is the trap's word, not just the import graph's.
  const { POST: route } = await import("@/app/api/checkout/route");
  const before = stripeClientsMade();
  let n = 0;
  for (const b of NEW_BRANDS) {
    const first = b.catalogue!.packs.find((p) => p.available)!;
    const host = new URL(b.origin).host;
    const res = await route(
      new Request(`http://${host}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", host, origin: `http://${host}`, "x-forwarded-for": `198.51.100.${++n}` },
        body: JSON.stringify({ lines: [{ sku: first.sku, qty: 1 }] }),
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
  check("db: and no Stripe client is made", stripeClientsMade() === made);
  await prisma.$disconnect();
}

async function main() {
  await routeChecks();
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
