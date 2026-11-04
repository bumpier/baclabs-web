/**
 * The new brands' commerce backend: catalogues, pricing, order lines, the
 * Stripe session, the per-brand Stripe account, the brand checks on the
 * public routes, and that BacLab never reaches any of it. Run with
 * `npm run test:brand-checkout`. Exits non-zero on any failure, like the
 * other tsx test scripts. Never calls Stripe: the session is built by a
 * pure function, and the database part stubs the client.
 *
 * The database part is opt-in. It writes rows, so give it a fresh file:
 *
 *   export DATABASE_URL="file:/path/to/scratch/brand-checkout.db"
 *   BRAND_CHECKOUT_DB=1 npm run -s test:brand-checkout
 *
 * It migrates that file itself, seeds the brand SKUs, checks out through
 * the real route with Stripe stubbed, pays through fulfillPaidOrder and the
 * real webhook, and checks the stock that came off the shared shelves.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { allBrands, belongsToHost, brandFor, brandFromHost, BRAND_IDS, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import type { BrandCatalogue } from "@/brands/types";
import { DELIVERY, DELIVERY_OPTIONS, LAB_KIT, PRODUCT, SINGLE_BUNDLE, bundleById, deliveryOptionById, priceOrder } from "@/config/funnel";
import {
  brandLineName,
  brandStripeProductId,
  catalogueDeliveryOptions,
  catalogueItem,
  defaultBrandProductStem,
  packPerVialMinor,
} from "@/lib/commerce/catalogue";
import { MAX_LINE_QTY, priceBrandLines, type PricedBrandOrder } from "@/lib/commerce/pricing";
import { brandBuyLink, parseBuyParam } from "@/lib/commerce/links";
import { brandSessionParams, businessDetailsNote, COMPANY_FIELD } from "@/lib/commerce/checkout";
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
import { getStripe, stripeFor, stripeKeyFor, verifyStripeWebhook, webhookAccounts } from "@/lib/payments/stripe";

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
  check(`${b.id}: Stripe product env is STRIPE_PRODUCT__${b.id.toUpperCase()}`, c.stripeProductEnv === `STRIPE_PRODUCT__${b.id.toUpperCase()}`);
  const biggestSold = Math.max(...c.packs.filter((p) => p.available).map((p) => p.vials));
  check(`${b.id}: one order can hold the biggest pack on sale`, c.maxVials >= biggestSold);
  for (const o of c.delivery.options) {
    check(`${b.id}: delivery "${o.id}" is one of BacLab's ids`, deliveryOptionById(o.id)?.id === o.id);
    // lib/shipping matches services to the option the customer paid for by id:
    // with none linked it must say so by name, which it can only for a known id.
    const plan = selectService([], { weightGrams: 100, lengthMm: 100, widthMm: 100, heightMm: 30 }, "GB", null, o.id);
    check(`${b.id}: lib/shipping knows delivery "${o.id}"`, plan.note.startsWith("No service is linked to"), plan.note);
  }
  const copy = [...c.packs.map((p) => p.label), ...c.addOns.map((a) => a.name), b.mailingList?.consentText ?? "", b.stripe?.statementDescriptorSuffix ?? ""];
  check(`${b.id}: catalogue copy passes the content rules`, checkCompliance(copy).length === 0, JSON.stringify(checkCompliance(copy)));
  const suffix = b.stripe?.statementDescriptorSuffix ?? "";
  check(`${b.id}: descriptor suffix fits Stripe's rules`, suffix.length <= 22 && /[A-Z]/i.test(suffix) && !/[<>\\'"*]/.test(suffix), suffix);
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

// ── The Stripe session ───────────────────────────────────────────────
// The order id is "ord-fixture" because Tailwind scans scripts/ too: an id
// spelled like a utility class (order, then a dash and a digit) would add
// that class to BacLab's stylesheet.
const NOW = new Date("2026-11-04T10:00:00Z");
function session(b: BrandProfile, lines: { sku: string; qty: number }[], extra: { productStem?: string | null; preselect?: "standard" | "next_day" } = {}) {
  const r = priceBrandLines(b.catalogue!, lines, { labKitOnSale: true });
  if (!r.ok) throw new Error(r.error);
  return brandSessionParams({
    brand: b,
    catalogue: b.catalogue!,
    orderId: "ord-fixture",
    order: r.order,
    productStem: extra.productStem ?? null,
    preselect: extra.preselect ?? null,
    now: NOW,
  });
}
for (const b of NEW_BRANDS) {
  const first = b.catalogue!.packs.find((p) => p.available)!;
  const lines = [{ sku: first.sku, qty: 2 }, ...b.catalogue!.addOns.map((a) => ({ sku: a.sku, qty: 1 }))];
  const s = session(b, lines);
  const names = (s.line_items ?? []).map((l) => l.price_data?.product_data?.name ?? "");
  check(`${b.id} session: neutral line names`, names.every((n) => /^10ml bacteriostatic water × \d+$/.test(n) || n === LAB_KIT.name), names.join(" | "));
  check(`${b.id} session: no brand name or slang on Stripe's lines`, names.every((n) => !n.includes(b.name)) && checkCompliance(names).length === 0);
  check(`${b.id} session: prices from the catalogue`, s.line_items?.[0]?.price_data?.unit_amount === first.priceMinor && s.line_items?.[0]?.quantity === 2);
  check(`${b.id} session: no promotion codes`, s.allow_promotion_codes === false);
  check(`${b.id} session: metadata`, JSON.stringify(s.metadata) === JSON.stringify({ orderId: "ord-fixture", brand: b.id, kind: "brand" }));
  check(`${b.id} session: same metadata on the PaymentIntent`, JSON.stringify(s.payment_intent_data?.metadata) === JSON.stringify(s.metadata));
  check(`${b.id} session: descriptor suffix from the profile`, s.payment_intent_data?.statement_descriptor_suffix === b.stripe?.statementDescriptorSuffix);
  check(`${b.id} session: no branding while the origin is http`, s.branding_settings === undefined);
  check(`${b.id} session: success URL on the brand's origin`, s.success_url === `${b.origin}/order-confirmation/ord-fixture?session_id={CHECKOUT_SESSION_ID}`);
  check(`${b.id} session: cancel URL on the brand's origin`, s.cancel_url === `${b.origin}/#buy`);
  check(`${b.id} session: cards only`, JSON.stringify(s.payment_method_types) === '["card"]');
  const rates = (s.shipping_options ?? []).map((o) => String(o.shipping_rate_data?.metadata?.deliveryOption ?? ""));
  check(`${b.id} session: every rate carries an id the webhook knows`, rates.length > 0 && rates.every((id) => !!deliveryOptionById(id)), rates.join());
  check(`${b.id} session: delivery instructions field`, (s.custom_fields ?? []).some((f) => f.key === "deliveryinstructions"));
  const company = (s.custom_fields ?? []).some((f) => f.key === COMPANY_FIELD);
  check(`${b.id} session: business fields only for wholesale`, company === (b.id === "wholesale") && !!s.tax_id_collection?.enabled === (b.id === "wholesale"));
  const stem = defaultBrandProductStem(b.id);
  const persistent = session(b, lines, { productStem: stem });
  check(
    `${b.id} session: lines on the brand's persistent Products when set`,
    (persistent.line_items ?? []).every((l) => l.price_data?.product?.startsWith(`${stem}_`) && !l.price_data.product_data)
  );
  check(`${b.id} session: the pack's own Product`, persistent.line_items?.[0]?.price_data?.product === brandStripeProductId(stem, first.id));
}
{
  // Preselect: the requested option is listed first (Stripe preselects the first).
  const beauty = brandFor("beauty");
  const s = session(beauty, [{ sku: "BEA-10ML-X1", qty: 1 }], { preselect: "next_day" });
  const ids = (s.shipping_options ?? []).map((o) => o.shipping_rate_data?.metadata?.deliveryOption).join();
  check("session: the requested delivery is listed first", ids === "next_day,standard", ids);
  check("session: names the brand nowhere in delivery", (s.shipping_options ?? []).every((o) => !String(o.shipping_rate_data?.display_name).includes(beauty.name)));
  // Branding only on https, with the logo only when the profile has a PNG for it.
  const https = { ...brandFor("luxury"), origin: "https://reserve.example", stripe: { statementDescriptorSuffix: "RESERVE NO10", logo: "/stripe/logo.png" } };
  const live = session(https, [{ sku: "LUX-10ML-X1", qty: 1 }]);
  check("session: branding once the origin is https", live.branding_settings?.display_name === https.name);
  check("session: logo is a public https URL", live.branding_settings?.logo?.url === "https://reserve.example/stripe/logo.png");
  check("session: no icon when the profile has none", live.branding_settings?.icon === undefined);
  const plain = session({ ...https, stripe: undefined }, [{ sku: "LUX-10ML-X1", qty: 1 }]);
  check("session: no descriptor suffix when the profile has none", plain.payment_intent_data?.statement_descriptor_suffix === undefined);
  check("session: line names match stripe-setup's Product names", brandLineName({ kind: "pack", vials: 12 }) === "10ml bacteriostatic water × 12");
}
check(
  "business details: company and VAT into the notes",
  businessDetailsNote({
    custom_fields: [{ key: COMPANY_FIELD, text: { value: "  Acme   Labs Ltd " } }] as never,
    customer_details: { business_name: "Ignored Ltd", tax_ids: [{ type: "gb_vat", value: "GB123456789" }] },
  }) === "Company: Acme Labs Ltd\nVAT number: GB123456789"
);
check(
  "business details: Stripe's business name when the field is empty",
  businessDetailsNote({ custom_fields: [], customer_details: { business_name: "Beta Ltd", tax_ids: [] } }) === "Company: Beta Ltd"
);
check("business details: nothing for a consumer", businessDetailsNote({ custom_fields: [], customer_details: null }) === "");

// ── One Stripe account per brand, by config ─────────────────────────────
{
  const saved = { ...process.env };
  process.env.STRIPE_SECRET_KEY = "sk_test_shared_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_shared_fixture";
  delete process.env.STRIPE_SECRET_KEY__GYM;
  delete process.env.STRIPE_WEBHOOK_SECRET__GYM;
  check("stripe: BacLab is the shared client", stripeFor({ id: DEFAULT_BRAND }) === getStripe());
  check("stripe: a brand without a key shares it", stripeFor({ id: "gym" }) === getStripe() && stripeKeyFor("gym") === "sk_test_shared_fixture");
  check("stripe: only the shared secret, by default", JSON.stringify(webhookAccounts().map((a) => a.env)) === '["STRIPE_SECRET_KEY"]');
  const payload = JSON.stringify({ id: "evt_fixture", object: "event", livemode: false, type: "ping", data: { object: {} } });
  const header = (secret: string) => getStripe().webhooks.generateTestHeaderString({ payload, secret });
  const shared = verifyStripeWebhook(payload, header("whsec_shared_fixture"));
  check("stripe: the shared secret verifies, as before", shared.event.id === "evt_fixture" && shared.keyEnv === "STRIPE_SECRET_KEY" && shared.stripe === getStripe());
  let refused = false;
  try {
    verifyStripeWebhook(payload, header("whsec_someone_else"));
  } catch {
    refused = true;
  }
  check("stripe: an unknown secret is refused", refused);
  process.env.STRIPE_SECRET_KEY__GYM = "sk_live_gym_fixture";
  process.env.STRIPE_WEBHOOK_SECRET__GYM = "whsec_gym_fixture";
  check("stripe: a brand's own key gets its own client", stripeFor({ id: "gym" }) !== getStripe() && stripeKeyFor("gym") === "sk_live_gym_fixture");
  check("stripe: BacLab never uses a brand's key", stripeKeyFor(DEFAULT_BRAND) === "sk_test_shared_fixture");
  const own = verifyStripeWebhook(payload, header("whsec_gym_fixture"));
  check("stripe: the brand's secret verifies with the brand's key", own.keyEnv === "STRIPE_SECRET_KEY__GYM" && own.secretKey === "sk_live_gym_fixture" && own.stripe === stripeFor({ id: "gym" }));
  check("stripe: the shared secret still verifies first", verifyStripeWebhook(payload, header("whsec_shared_fixture")).keyEnv === "STRIPE_SECRET_KEY");
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
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
  const { brandCheckout } = await import("@/lib/commerce/checkout");
  const saved = { ...process.env };
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
  delete process.env.STRIPE_SECRET_KEY;
  const keyless = await answer(await post(lux, { lines: [{ sku: "LUX-10ML-X1", qty: 1 }] }));
  check("brandCheckout: no Stripe key is a 503, before any order is written", keyless.status === 503);
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
}

/**
 * Against a throwaway SQLite file: migrate it, seed the brand SKUs, check
 * out through the real route with Stripe's session call stubbed, pay, and
 * read back the order and the shared stock. Refuses the real database and
 * any database that already has orders.
 */
async function databaseChecks() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:") || /data\/baclab\.db/.test(url)) {
    console.error("Refusing the database checks: point DATABASE_URL at a throwaway SQLite file.");
    process.exit(1);
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, stdio: "ignore" });

  // Nothing leaves this process: Stripe's session call is stubbed below,
  // and every fetch (FX rates, Meta, Resend) fails at once.
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
  const { setInventoryMode } = await import("@/lib/inventory/mode");
  const { receiveStock } = await import("@/lib/inventory/store");
  const { fulfillPaidOrder } = await import("@/lib/payments/fulfillment");
  const { POST: checkout } = await import("@/app/api/checkout/route");
  const { POST: webhook } = await import("@/app/api/webhooks/stripe/route");

  const vial = await prisma.product.create({
    data: { slug: "baclab-10ml", name: `${PRODUCT.name} ${PRODUCT.size}`, description: "x", priceGbp: SINGLE_BUNDLE.priceMinor / 100, stock: 200, supplyDays: 30 },
  });
  const kit = await prisma.product.create({ data: { slug: LAB_KIT.sku, name: LAB_KIT.name, description: "x", priceGbp: 5.99, stock: 20 } });
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

  // Stripe, stubbed: what the checkout would have sent, and a session back.
  const sent: { params: Record<string, unknown>; key?: string }[] = [];
  const sessions = getStripe().checkout.sessions as unknown as { create: (p: unknown, o?: { idempotencyKey?: string }) => Promise<unknown> };
  sessions.create = async (params, opts) => {
    sent.push({ params: params as Record<string, unknown>, key: opts?.idempotencyKey });
    return { id: `cs_test_stub_${sent.length}`, url: `https://checkout.stripe.test/c/pay/cs_test_stub_${sent.length}` };
  };
  const post = (host: string, body: unknown) =>
    checkout(
      new Request(`http://${host}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", host, origin: `http://${host}` },
        body: JSON.stringify(body),
      })
    );

  // BacLab's host never reaches the brand checkout, whatever the body.
  const bl = await post("baclab.co.uk", { lines: [{ sku: "LUX-10ML-X1", qty: 1 }] });
  check("db: on BacLab's host a brand body is BacLab's to refuse", bl.status === 400 && sent.length === 0 && (await prisma.order.count()) === 0);

  // Legacy stock: the gym's 10-pack and two kits.
  const gymRes = await post("gym.localhost:3000", { lines: [{ sku: "GYM-10ML-X10", qty: 1 }, { sku: "GYM-LAB-KIT", qty: 2 }], consent: { tracking: false } });
  const gymBody = (await gymRes.json()) as { url?: string; error?: string };
  check("db: the gym checks out", gymRes.status === 200 && gymBody.url === "https://checkout.stripe.test/c/pay/cs_test_stub_1", JSON.stringify(gymBody));
  const gymOrder = await prisma.order.findFirst({ where: { brand: "gym" } });
  check("db: the order is the gym's, pending, priced from its catalogue", gymOrder?.status === "pending" && Number(gymOrder.totalAmount) === 59.97);
  check("db: the order holds the session", gymOrder?.paymentRef === "cs_test_stub_1");
  check("db: the session is keyed on the order", sent[0]?.key === `checkout:${gymOrder?.id}`);
  check("db: the session names the order and brand", JSON.stringify(sent[0]?.params.metadata) === JSON.stringify({ orderId: gymOrder?.id, brand: "gym", kind: "brand" }));
  const paid = await fulfillPaidOrder(gymOrder!.id, { paymentRef: "pi_stub_gym", provider: "stripe", deliveryMinor: 0, amountPaidMinor: 5997 });
  const gymAfter = await prisma.order.findUnique({ where: { id: gymOrder!.id } });
  check("db: fulfilment marks it paid", !paid.alreadyPaid && gymAfter?.status === "paid");
  check("db: and keeps the brand", gymAfter?.brand === "gym");
  check("db: the shared vials came off the shelf", (await prisma.product.findUnique({ where: { id: vial.id } }))?.stock === 190);
  check("db: the shared kits came off theirs", (await prisma.product.findUnique({ where: { id: kit.id } }))?.stock === 18);

  // Through the real webhook: a trade order's company and VAT number.
  const whlRes = await post("wholesale.localhost:3000", { lines: [{ sku: "WHL-10ML-X50", qty: 1 }] });
  check("db: wholesale checks out", whlRes.status === 200);
  const whl = await prisma.order.findFirst({ where: { brand: "wholesale" } });
  const event = {
    id: "evt_db_fixture",
    object: "event",
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_stub_2",
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: "pi_stub_whl",
        client_reference_id: whl?.id,
        metadata: { orderId: whl?.id, brand: "wholesale", kind: "brand" },
        amount_total: 19999,
        currency: "gbp",
        total_details: { amount_shipping: 0 },
        shipping_cost: { shipping_rate: { id: "shr_stub", metadata: { deliveryOption: "next_day" } } },
        custom_fields: [{ key: COMPANY_FIELD, text: { value: "Acme Labs Ltd" } }],
        customer_details: { email: "buyer@acme.example", name: "Sam Buyer", phone: "", business_name: null, tax_ids: [{ type: "gb_vat", value: "GB123456789" }], address: null },
        collected_information: { shipping_details: { name: "Sam Buyer", address: { line1: "1 Mill Lane", line2: null, city: "Leeds", postal_code: "LS1 1AA", country: "GB", state: null } } },
      },
    },
  };
  const payload = JSON.stringify(event);
  const hook = await webhook(
    new Request("http://127.0.0.1:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": getStripe().webhooks.generateTestHeaderString({ payload, secret: "whsec_db_fixture" }) },
      body: payload,
    })
  );
  const whlAfter = await prisma.order.findUnique({ where: { id: whl!.id } });
  check("db: the webhook accepts the brand's session", hook.status === 200);
  check("db: paid, and still wholesale's", whlAfter?.status === "paid" && whlAfter.brand === "wholesale");
  check("db: company and VAT number in the notes", !!whlAfter?.notes?.includes("Company: Acme Labs Ltd") && !!whlAfter.notes.includes("VAT number: GB123456789"), String(whlAfter?.notes));
  check("db: the delivery the customer chose is recorded", whlAfter?.deliveryOption === "next_day");
  check("db: 50 more shared vials came off the shelf", (await prisma.product.findUnique({ where: { id: vial.id } }))?.stock === 140);

  // Warehouse mode: the pack is allocated as its kit, from the shared vials and the brand's boxes.
  const warehouse = await prisma.warehouse.create({ data: { code: "MAIN", name: "Main" } });
  const shelf = await prisma.location.create({ data: { warehouseId: warehouse.id, code: "A1" } });
  for (const [code, quantity] of [[VIAL_SKU_CODE, 40], ["LUX-BOX", 5]] as const) {
    const sku = await prisma.sku.findUniqueOrThrow({ where: { code } });
    await receiveStock({ skuId: sku.id, locationId: shelf.id, quantity, reference: "test", actor: "test" });
  }
  await setInventoryMode("warehouse");
  const luxRes = await post("luxury.localhost:3000", { lines: [{ sku: "LUX-10ML-X3", qty: 2 }], deliveryOption: "next_day" });
  check("db: luxury checks out against the shelves", luxRes.status === 200);
  const tooMany = await post("luxury.localhost:3000", { lines: [{ sku: "LUX-10ML-X3", qty: 6 }] });
  check("db: the brand's boxes limit what it can sell", tooMany.status === 409);
  const lux = await prisma.order.findFirst({ where: { brand: "luxury" } });
  await fulfillPaidOrder(lux!.id, { paymentRef: "pi_stub_lux", provider: "stripe", deliveryMinor: 0 });
  const picks = await prisma.pickLine.findMany({ where: { orderId: lux!.id }, include: { sku: true } });
  const picked = Object.fromEntries(picks.map((p) => [p.sku.code, p.quantity]));
  check("db: allocated as 6 shared vials and 2 brand boxes", picked[VIAL_SKU_CODE] === 6 && picked["LUX-BOX"] === 2, JSON.stringify(picked));
  check("db: paid, and still luxury's", (await prisma.order.findUnique({ where: { id: lux!.id } }))?.status === "paid");

  // The confirmations go out after the webhook answers; wait for them.
  for (let i = 0; i < 60 && (await prisma.emailLog.count({ where: { type: "confirmation" } })) < 3; i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  check("db: each brand's order is confirmed by email", (await prisma.emailLog.count({ where: { type: "confirmation" } })) === 3);
  console.log = log;
  console.error = error;
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
