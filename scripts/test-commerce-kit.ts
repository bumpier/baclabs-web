/**
 * Test suite for the brand storefronts' commerce kit. Run with
 * `npm run test:kit`. Exits non-zero on any failure, like the other tsx
 * test scripts. No database, no network.
 *
 *  - storefrontView: a brand's view carries its own catalogue and nothing of
 *    any other brand's, BacLab's included;
 *  - the view's pricing and delivery quote agree with the checkout's own
 *    (lib/commerce/pricing.ts, lib/commerce/catalogue.ts), refusals word for
 *    word, so a storefront never shows a figure or an error the checkout
 *    would contradict;
 *  - the basket's cleaning of stored and linked lines;
 *  - each brand's legal pages: its own party and no other's, no payment
 *    provider named until BrandProfile.payment says so, and every
 *    cross-reference resolving;
 *  - the contact topics, and the checkout's redirect targets;
 *  - the brand pages' source (app/<id>/**) names no payment provider.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { brandFor, type BrandProfile } from "@/brands/registry";
import { BRAND_IDS } from "@/brands/types";
import { storefrontView } from "@/lib/commerce/storefront";
import { deliveryQuote, freeDeliveryShortfallMinor, packSavingMinor, priceBasket } from "@/lib/commerce/view";
import { priceBrandLines } from "@/lib/commerce/pricing";
import { catalogueDeliveryOptions } from "@/lib/commerce/catalogue";
import { parseBuyParam } from "@/lib/commerce/links";
import { isRedirectTarget } from "@/lib/commerce/start-checkout";
import { cleanLines } from "@/components/commerce/cart";
import { brandContactTopics } from "@/lib/commerce/contact";
import { CONTACT_TOPIC_IDS } from "@/lib/contact";
import { brandDisclaimer, brandPrivacy, brandReturns, brandTerms, legalIdentity } from "@/lib/commerce/legal";
import { legalDocText, type LegalDoc, type LegalInline } from "@/lib/commerce/legal-doc";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const ROOT = path.resolve(__dirname, "..");
const BRANDS = BRAND_IDS.filter((id) => id !== "baclab");
const profiles = Object.fromEntries(BRANDS.map((id) => [id, brandFor(id)])) as Record<string, BrandProfile>;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Every other brand's public name, id-host and SKU stem, and BacLab's name: none may appear in this brand's output. */
function foreignMarkers(id: string): RegExp[] {
  return [
    /baclab/i,
    ...BRANDS.filter((o) => o !== id).flatMap((o) => [
      new RegExp(escape(profiles[o]!.name), "i"),
      new RegExp(`${o}\\.localhost`, "i"),
      new RegExp(escape(profiles[o]!.catalogue!.parentSku), "i"),
    ]),
  ];
}

// ── storefrontView ──────────────────────────────────────────────────
for (const id of BRANDS) {
  const b = profiles[id]!;
  const view = storefrontView(b);
  const json = JSON.stringify(view);
  for (const re of foreignMarkers(id)) check(`${id}: storefront view never names ${re}`, !re.test(json));
  check(`${id}: every pack is listed`, view.packs.map((p) => p.sku).join() === b.catalogue!.packs.map((p) => p.sku).join());
  check(`${id}: prices are the catalogue's`, view.packs.every((p, i) => p.priceMinor === b.catalogue!.packs[i]!.priceMinor));
  check(`${id}: it is serialisable`, JSON.stringify(JSON.parse(json)) === json);
  check(`${id}: no payment method until one is configured`, view.payment.methods.length === 0);
  check(`${id}: its mailing list words are the profile's`, (view.mailingList?.consentText ?? null) === (b.mailingList?.consentText ?? null));
  check(`${id}: the free-delivery threshold is the catalogue's`, view.delivery.freeFromMinor === b.catalogue!.delivery.freeFromMinor);
  for (const pack of view.packs) check(`${id}: ${pack.sku} saves nothing negative`, packSavingMinor(view, pack) >= 0);
}
check("wholesale runs no list", storefrontView(profiles.wholesale!).mailingList === null);
let threw = false;
try {
  storefrontView(brandFor("baclab"));
} catch {
  threw = true;
}
check("BacLab has no storefront view: its storefront is config/funnel.ts", threw);

// ── The view's pricing is the checkout's ────────────────────────────
for (const id of BRANDS) {
  const b = profiles[id]!;
  const c = b.catalogue!;
  const view = storefrontView(b);
  const packs = c.packs;
  const baskets: { sku: string; qty: number }[][] = [
    [{ sku: packs[0]!.sku, qty: 1 }],
    [{ sku: packs[0]!.sku, qty: 2 }, { sku: packs[1]!.sku, qty: 1 }],
    [{ sku: packs[1]!.sku, qty: 1 }, { sku: packs[0]!.sku, qty: 3 }],
    [{ sku: packs[0]!.sku.toLowerCase(), qty: 1 }, { sku: packs[0]!.sku, qty: 1 }],
    [{ sku: packs[packs.length - 1]!.sku, qty: 10 }],
    [{ sku: packs[0]!.sku, qty: 11 }],
    [{ sku: packs[0]!.sku, qty: 6 }, { sku: packs[0]!.sku, qty: 6 }],
    [{ sku: "NOT-A-SKU", qty: 1 }],
    [{ sku: packs[0]!.sku, qty: 0 }],
    ...c.packs.filter((p) => !p.available).map((p) => [{ sku: p.sku, qty: 1 }]),
    ...c.addOns.map((a) => [{ sku: a.sku, qty: 1 }]),
    ...c.addOns.map((a) => [{ sku: packs[0]!.sku, qty: 1 }, { sku: a.sku, qty: 1 }]),
    ...c.addOns.map((a) => [{ sku: packs[0]!.sku, qty: 1 }, { sku: a.sku, qty: packs[0]!.vials + 1 }]),
  ];
  for (const labKitOnSale of [false, true]) {
    // The view reads the kit's switch when it is built, as the checkout does when it prices.
    const before = process.env.NEXT_PUBLIC_LAB_KIT;
    process.env.NEXT_PUBLIC_LAB_KIT = labKitOnSale ? "1" : "";
    const v = storefrontView(b);
    process.env.NEXT_PUBLIC_LAB_KIT = before;
    for (const lines of baskets) {
      const server = priceBrandLines(c, lines, { labKitOnSale });
      const shown = priceBasket(v, lines);
      const label = `${id} (kit ${labKitOnSale ? "on" : "off"}) ${JSON.stringify(lines)}`;
      if (server.ok) {
        check(`${label}: the view takes what the checkout takes`, shown.problem === null, String(shown.problem));
        check(`${label}: same goods total`, shown.goodsMinor === server.order.goodsMinor, `${shown.goodsMinor} vs ${server.order.goodsMinor}`);
        check(`${label}: same vials`, shown.vials === server.order.vials);
        check(
          `${label}: same lines, same order`,
          shown.items.map((i) => `${i.sku}:${i.qty}`).join() === server.order.lines.map((l) => `${l.sku}:${l.quantity}`).join()
        );
      } else {
        check(`${label}: the view refuses in the checkout's words`, shown.problem === server.error, `${shown.problem} vs ${server.error}`);
      }
    }
  }
  check(`${id}: an empty basket is a state, not an error`, priceBasket(view, []).problem === null);
  for (const goods of [0, 1, 999, 3999, 4000, 4001, 20000, 1_000_000]) {
    const server = catalogueDeliveryOptions(c, goods).map((o) => `${o.option.id}:${o.priceMinor}`).join();
    const shown = deliveryQuote(view, goods).map((o) => `${o.option.id}:${o.priceMinor}`).join();
    check(`${id}: delivery at ${goods}p is the checkout's`, server === shown, `${shown} vs ${server}`);
  }
}
const lux = storefrontView(profiles.luxury!);
check("luxury: next day is free on every order", deliveryQuote(lux, 799).every((o) => o.priceMinor === 0));
check("luxury: never short of free delivery", freeDeliveryShortfallMinor(lux, 0) === null);
const gymView = storefrontView(profiles.gym!);
check("gym: £40 threshold shortfall", freeDeliveryShortfallMinor(gymView, 2799) === 4000 - 2799);

// ── The basket's cleaning ───────────────────────────────────────────
const gymSku = profiles.gym!.catalogue!.packs[0]!.sku;
check("cleanLines keeps the brand's SKUs", cleanLines([{ sku: gymSku, qty: 2 }], gymView).length === 1);
check("cleanLines drops another brand's", cleanLines([{ sku: profiles.luxury!.catalogue!.packs[0]!.sku, qty: 1 }], gymView).length === 0);
check("cleanLines merges and clamps", JSON.stringify(cleanLines([{ sku: gymSku.toLowerCase(), qty: 7 }, { sku: gymSku, qty: 7 }], gymView)) === JSON.stringify([{ sku: gymSku, qty: 10 }]));
check("cleanLines drops junk", cleanLines([null, "x", { sku: gymSku, qty: 1.5 }, { sku: gymSku, qty: -1 }, { qty: 1 }], gymView).length === 0);
check("cleanLines takes a non-array as empty", cleanLines({ sku: gymSku, qty: 1 }, gymView).length === 0);
check(
  "a reorder link fills the basket",
  JSON.stringify(cleanLines(parseBuyParam(`${gymSku}:2,nope:1`), gymView)) === JSON.stringify([{ sku: gymSku, qty: 2 }])
);

// ── Redirect targets: a site path or a web URL, never anything else ──
for (const ok of ["/checkout/pay/0b5c0d2e-1111-4a4a-9a9a-000000000000", "https://pay.example.com/s/1", "http://localhost:3000/x"]) {
  check(`redirect to ${ok}`, isRedirectTarget(ok));
}
for (const bad of ["//evil.example.com", "javascript:alert(1)", "data:text/html,x", "", "checkout"]) {
  check(`no redirect to ${JSON.stringify(bad)}`, !isRedirectTarget(bad));
}

// ── Contact topics ──────────────────────────────────────────────────
const plain = brandContactTopics();
check("topics are ContactSchema's own ids", plain.every((t) => (CONTACT_TOPIC_IDS as readonly string[]).includes(t.id)));
check("no trade topic unless asked for", !plain.some((t) => t.id === "wholesale"));
const trade = brandContactTopics({ trade: { label: "A quote, or a standing order" } });
check("the trade topic takes the brand's label", trade.find((t) => t.id === "wholesale")?.label === "A quote, or a standing order");
check("topics never name BacLab", !/baclab/i.test(JSON.stringify(trade)));

// ── Legal pages ─────────────────────────────────────────────────────
const TRACKING_VARIANTS = [
  { ga4: false, metaPixel: false, metaServer: false },
  { ga4: true, metaPixel: true, metaServer: true },
  { ga4: true, metaPixel: false, metaServer: false },
];
function docsFor(b: BrandProfile): LegalDoc[] {
  return [
    brandTerms(b),
    brandReturns(b),
    brandDisclaimer(b),
    ...TRACKING_VARIANTS.map((t) => brandPrivacy(b, t)),
  ];
}
function links(doc: LegalDoc): string[] {
  const out: string[] = [];
  const walk = (runs: LegalInline[]) => runs.forEach((r) => typeof r === "object" && "href" in r && out.push(r.href));
  for (const s of doc.sections) {
    for (const blk of s.blocks) {
      if (blk.kind === "p") walk(blk.content);
      else if (blk.kind === "dl") blk.items.forEach((i) => walk(i.detail));
      else if (blk.kind !== "h3") blk.items.forEach(walk);
    }
  }
  return out;
}
const PAGE_PATHS = new Set(["/", "/contact", "/terms", "/privacy", "/returns", "/disclaimer"]);
for (const id of BRANDS) {
  const b = profiles[id]!;
  const docs = docsFor(b);
  for (const doc of docs) {
    const text = legalDocText(doc).join("\n");
    const where = `${id} ${doc.path}`;
    for (const re of foreignMarkers(id)) check(`${where}: never names ${re}`, !re.test(text));
    check(`${where}: names no payment provider`, !/stripe|paypal|apple pay|google pay/i.test(text));
    check(`${where}: is not card-only`, !/\bcards?\b/i.test(text), text.match(/.{40}\bcards?\b.{40}/i)?.[0] ?? "");
    check(`${where}: no crypto, plan or welcome vial`, !/crypto|monthly plan|welcome (?:vial|gift)/i.test(text));
    check(`${where}: section anchors are unique`, new Set(doc.sections.map((s) => s.id)).size === doc.sections.length);
    for (const href of links(doc)) {
      const [p, hash] = href.split("#");
      if (!href.startsWith("/")) continue;
      check(`${where}: links to a page that exists (${href})`, PAGE_PATHS.has(p!), href);
      if (hash) {
        const target = docs.find((d) => d.path === p);
        check(`${where}: ${href} names a real clause`, !!target?.sections.some((s) => s.id === hash));
      }
    }
  }
  const terms = legalDocText(brandTerms(b)).join("\n");
  check(`${id}: the terms name the party`, terms.includes(legalIdentity(b).party));
  check(`${id}: the terms name the brand on its logo clause`, terms.includes(`the ${b.name} name and logo`));
  check(`${id}: the terms state the order limit`, terms.includes(`no more than ${b.catalogue!.maxVials} vials`));
  check(`${id}: the terms list each delivery option`, b.catalogue!.delivery.options.every((o) => terms.includes(o.carrier)));
  check(`${id}: clause numbers resolve`, !/clause 0\b/.test(terms) && /clause \d+/.test(terms));
  const privacy = legalDocText(brandPrivacy(b, TRACKING_VARIANTS[0]!)).join("\n");
  check(`${id}: the privacy notice describes its list only if it has one`, /Our mailing list\./.test(privacy) === Boolean(b.mailingList));
  check(`${id}: with no tracker, it says so`, privacy.includes("We run no analytics"));
  check(`${id}: with trackers, it names them`, legalDocText(brandPrivacy(b, TRACKING_VARIANTS[1]!)).join("\n").includes("Google Analytics and the Meta Pixel"));
}
check("trade terms drop the resale restriction", !legalDocText(brandTerms(profiles.wholesale!)).join(" ").includes("without our prior written consent"));
check("consumer terms keep it", legalDocText(brandTerms(profiles.luxury!)).join(" ").includes("without our prior written consent"));
check("wholesale lists its quote-only packs", legalDocText(brandTerms(profiles.wholesale!)).join(" ").includes("Packs of 250, 500 and 1,000 vials are supplied on quotation only."));

// Payment methods and processors are parameters: set, they are named; unset, nothing is.
const paying: BrandProfile = {
  ...profiles.luxury!,
  legalName: "Example Trading Ltd",
  company: { number: "01234567", registeredAddress: "1 Example Street, London" },
  payment: {
    methods: [{ id: "transfer", label: "Bank transfer", terms: "pay from your bank within 3 days.", refunds: "we pay you back to the account you paid from." }],
    processors: [{ name: "Example Payments Ltd", purpose: "taking payments and making refunds", privacyUrl: "https://payments.example.com/privacy", separateController: true }],
  },
};
const payTerms = legalDocText(brandTerms(paying)).join("\n");
check("a configured method is in the terms", payTerms.includes("Bank transfer") && payTerms.includes("pay from your bank within 3 days."));
check("a trading name is declared", payTerms.includes(`${paying.name} is a trading name of Example Trading Ltd.`));
check("the company number is shown", payTerms.includes("no. 01234567"));
check("a method's refund line is in the returns policy", legalDocText(brandReturns(paying)).join("\n").includes("we pay you back"));
const payPrivacy = legalDocText(brandPrivacy(paying, TRACKING_VARIANTS[0]!)).join("\n");
check("a configured processor is named", payPrivacy.includes("Example Payments Ltd"));
check("a separate controller is said to be one", payPrivacy.includes("except Example Payments Ltd, which is a separate controller"));
check("an unconfigured brand names its provider generically", legalDocText(brandPrivacy(profiles.gym!, TRACKING_VARIANTS[0]!)).join("\n").includes("Our payment provider"));

// ── The brand pages' source against the brand's own rules ───────────
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}
for (const id of BRANDS) {
  for (const file of filesUnder(path.join(ROOT, "app", id))) {
    const rel = path.relative(ROOT, file);
    const src = readFileSync(file, "utf8");
    check(`${rel} names no payment provider`, !/stripe/i.test(src));
  }
}
for (const file of filesUnder(path.join(ROOT, "components", "commerce"))) {
  check(`${path.relative(ROOT, file)} names no payment provider`, !/stripe/i.test(readFileSync(file, "utf8")));
}

if (failures > 0) {
  console.error(`\n${failures} kit check(s) failed.`);
  process.exit(1);
}
console.log("✓ commerce kit: all checks passed");
