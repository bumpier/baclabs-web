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
 *  - each brand's legal pages: its own party and no other's, every brand's
 *    copy rules, no payment provider named until BrandProfile.payment says
 *    so, and every cross-reference resolving;
 *  - the contact topics, and the checkout's redirect targets;
 *  - the brand pages' source (app/<id>/**) against the brand's copy rules.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactForm } from "@/components/commerce/ContactForm";
import { cookieBannerBody } from "@/components/commerce/CookieBanner";
import { DEFAULT_QUIET_PATHS } from "@/components/commerce/SignupPopup";
import { brandFor, type BrandProfile } from "@/brands/registry";
import { BRAND_IDS, type BrandId } from "@/brands/types";
import { PAYPAL_PAYMENT, STRIPE_PAYMENT } from "@/brands/payment-methods";
import { checkBrandCopy } from "@/lib/content-rules";
import { stockIsLow, storefrontView, withStockLevel } from "@/lib/commerce/storefront";
import { LOW_STOCK_VIALS, summariseVialStock, type SentOrder } from "@/lib/vial-stock";
import { __clearTestPaymentAdapters, __registerTestPaymentAdapter } from "@/lib/commerce/payments";
import { deliveryQuote, freeDeliveryShortfallMinor, packSavingMinor, priceBasket } from "@/lib/commerce/view";
import { priceBrandLines } from "@/lib/commerce/pricing";
import { catalogueDeliveryOptions } from "@/lib/commerce/catalogue";
import { GIFT_NOTE_MAX } from "@/lib/commerce/gift-note";
import { formatCutoffHour } from "@/lib/delivery-date";
import { serviceFacts } from "@/brands/luxury/service";
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
  check(`${id}: the view names Stripe only as the method's id`, !/stripe/i.test(json.replaceAll('"id":"stripe"', "")), json);
  // No payment env is set here, as in `next build`: the view still offers
  // what the profile lists, so a prerendered page keeps its checkout button.
  check(
    `${id}: the view offers what the profile lists, with no payment env`,
    view.payment.methods.map((m) => m.id).join() === (b.paymentProviders ?? []).join(),
    JSON.stringify(view.payment.methods)
  );
  check(`${id}: its mailing list words are the profile's`, (view.mailingList?.consentText ?? null) === (b.mailingList?.consentText ?? null));
  check(`${id}: the free-delivery threshold is the catalogue's`, view.delivery.freeFromMinor === b.catalogue!.delivery.freeFromMinor);
  check(`${id}: a gift note offered only where the catalogue takes one`, view.flags.giftNote === b.catalogue!.collectGiftNote && view.limits.maxGiftNote === GIFT_NOTE_MAX);
  for (const pack of view.packs) check(`${id}: ${pack.sku} saves nothing negative`, packSavingMinor(view, pack) >= 0);
}
check("wholesale runs no list", storefrontView(profiles.wholesale!).mailingList === null);
// ── The stock level ─────────────────────────────────────────────────
for (const id of BRANDS) check(`${id}: the view is built not low, with no database read`, storefrontView(profiles[id]!).stock.low === false);
{
  const DAY = "2026-10-08";
  const ON = new Date("2026-10-12T12:00:00Z");
  const sold = (vials: number): SentOrder => ({ paidAt: new Date("2026-10-10T10:00:00Z"), items: JSON.stringify([{ qty: vials }]), kind: "sale" });
  const count = (received: number, sent: number) => summariseVialStock([{ vials: received, receivedOn: DAY }], sent ? [sold(sent)] : [], ON);
  check("stock: nothing booked in is not low", !stockIsLow(summariseVialStock([], [], ON)));
  check("stock: above the admin's warning level is not low", !stockIsLow(count(1000, 1000 - (LOW_STOCK_VIALS + 1))) && !stockIsLow(count(LOW_STOCK_VIALS + 1, 0)));
  check("stock: at the warning level is low", stockIsLow(count(LOW_STOCK_VIALS, 0)));
  check("stock: under it is low", stockIsLow(count(1000, 1000 - 12)));
  check("stock: a count that has run out says nothing", !stockIsLow(count(100, 100)) && !stockIsLow(count(100, 130)));
}
check("luxury offers a gift note", storefrontView(profiles.luxury!).flags.giftNote);
// A listed provider is offered whether or not it is configured (the
// checkout answers 503 while it is off), in the profile's words when it has
// some; a brand that lists none is offered none whatever is set.
for (const configured of [false, true]) {
  __registerTestPaymentAdapter({ id: "stripe", label: "Stand-in", configured: () => configured, createPayment: () => Promise.reject(new Error("never")) });
  for (const id of BRANDS) {
    const methods = storefrontView(profiles[id]!).payment.methods;
    const listed = profiles[id]!.paymentProviders ?? [];
    check(`${id}: the view offers what is listed, ${configured ? "configured" : "not configured"}`, methods.map((m) => m.id).join() === listed.join(), JSON.stringify(methods));
    const words = profiles[id]!.payment?.methods.find((m) => m.id === "stripe");
    if (methods[0]) check(`${id}: the method is in the profile's words`, methods[0].label === (words?.label ?? "Stand-in"));
    // Its terms and refunds sentences name the provider: the legal pages
    // read them from the profile, and the view the browser gets carries
    // the id and label alone.
    check(`${id}: the view carries no method's terms`, methods.every((m) => JSON.stringify(Object.keys(m)) === '["id","label"]'), JSON.stringify(methods));
  }
  check("a brand that lists no provider is offered no way to pay", storefrontView({ ...profiles.gym!, paymentProviders: [] }).payment.methods.length === 0);
}
__clearTestPaymentAdapters();
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
// The order-by time is a field of its own, the one the sentence names.
for (const id of BRANDS) {
  for (const o of storefrontView(profiles[id]!).delivery.options) {
    check(
      `${id}: ${o.id}'s cutoff is its own field`,
      o.id === "next_day" ? o.cutoff === formatCutoffHour() && o.transit.endsWith(`if ordered by ${o.cutoff}`) : o.cutoff === null,
      `${o.cutoff} / ${o.transit}`
    );
  }
}
const lux = storefrontView(profiles.luxury!);
const facts = serviceFacts(lux);
check("luxury: the timetable reads the cutoff from the view", facts?.cutoff === formatCutoffHour() && facts.arrives === "Next working day", JSON.stringify(facts));
check("luxury: no cutoff, no clause dropped", serviceFacts({ ...lux, delivery: { ...lux.delivery, options: [{ ...lux.delivery.options[0]!, cutoff: null, transit: "two working days" }] } })?.arrives === "Two working days");
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
    // A provider, and cards, are named only when the brand's own profile takes it.
    const takes = (provider: "stripe" | "paypal") =>
      (b.paymentProviders ?? []).includes(provider) && !!b.payment?.methods.some((m) => m.id === provider);
    check(`${where}: names no payment provider but its own`, (takes("stripe") || !/stripe|apple pay|google pay/i.test(text)) && (takes("paypal") || !/paypal/i.test(text)));
    check(`${where}: names cards only if it takes them`, takes("stripe") || !/\bcards?\b/i.test(text), text.match(/.{40}\bcards?\b.{40}/i)?.[0] ?? "");
    check(`${where}: no crypto, plan or welcome vial`, !/crypto|monthly plan|welcome (?:vial|gift)/i.test(text));
    // Shared wording, so every brand's text must pass every brand's rules.
    for (const rulesOf of BRAND_IDS.filter((r) => r !== "baclab")) {
      const v = checkBrandCopy(rulesOf as BrandId, legalDocText(doc), where);
      check(`${where}: passes ${rulesOf}'s copy rules`, v.length === 0, JSON.stringify(v));
    }
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
const unpaid: BrandProfile = { ...profiles.gym!, paymentProviders: [], payment: undefined };
check("an unconfigured brand names its provider generically", legalDocText(brandPrivacy(unpaid, TRACKING_VARIANTS[0]!)).join("\n").includes("Our payment provider"));
for (const doc of docsFor(unpaid)) {
  check(`unconfigured ${doc.path}: names no provider and no card`, !/stripe|paypal|apple pay|google pay|\bcards?\b/i.test(legalDocText(doc).join("\n")));
}

// Stripe's own words, on every brand: all four take it.
for (const id of BRANDS) {
  const b = profiles[id]!;
  check(`${id}: takes Stripe, in Stripe's words`, (b.paymentProviders ?? []).join() === "stripe" && b.payment === STRIPE_PAYMENT);
  const terms = legalDocText(brandTerms(b)).join("\n");
  const returns = legalDocText(brandReturns(b)).join("\n");
  const privacy = legalDocText(brandPrivacy(b, TRACKING_VARIANTS[0]!)).join("\n");
  check(`${id}: the terms say how Stripe takes payment`, terms.includes("card, Apple Pay or Google Pay: you pay on Stripe’s own hosted checkout page. Your card details are entered there and never reach us"));
  check(`${id}: the returns policy says how Stripe refunds`, returns.includes("card, Apple Pay or Google Pay: we refund through Stripe, to the card you paid with"));
  check(`${id}: the privacy notice names Stripe`, privacy.includes("Stripe Payments Europe, Ltd.") && privacy.includes("stripe.com/gb/privacy"));
  check(`${id}: as a separate controller`, privacy.includes("except Stripe Payments Europe, Ltd., which is a separate controller"));
  check(`${id}: Stripe's own cookies are its own`, privacy.includes("Stripe sets its own cookies there, including for fraud prevention"));
  for (const doc of docsFor(b)) check(`${id} ${doc.path}: never names PayPal`, !/paypal/i.test(legalDocText(doc).join("\n")));
}

// PayPal's own words, on a brand moved to PayPal by its profile alone.
{
  const moved: BrandProfile = { ...profiles.luxury!, paymentProviders: ["paypal"], payment: PAYPAL_PAYMENT };
  const terms = legalDocText(brandTerms(moved)).join("\n");
  const returns = legalDocText(brandReturns(moved)).join("\n");
  const privacy = legalDocText(brandPrivacy(moved, TRACKING_VARIANTS[0]!)).join("\n");
  check("on PayPal: the terms say how PayPal takes payment", terms.includes("PayPal: you approve the payment on PayPal’s own pages"));
  check("on PayPal: the returns policy says how PayPal refunds", returns.includes("PayPal: we refund through PayPal, to the PayPal account you paid from."));
  check("on PayPal: the privacy notice names PayPal UK Ltd", privacy.includes("PayPal UK Ltd") && privacy.includes("paypal.com/uk/legalhub/paypal/privacy-full"));
  check("on PayPal: as a separate controller", privacy.includes("except PayPal UK Ltd, which is a separate controller"));
  check("on PayPal: PayPal's own cookies are its own", privacy.includes("set PayPal’s own cookies under PayPal’s own notice"));
  for (const doc of docsFor(moved)) {
    const text = legalDocText(doc).join("\n");
    check(`on PayPal ${doc.path}: never names Stripe or cards`, !/stripe|apple pay|google pay|\bcards?\b/i.test(text), text.match(/.{40}(?:stripe|\bcards?\b).{40}/i)?.[0] ?? "");
    for (const rulesOf of BRANDS) check(`on PayPal ${doc.path}: passes ${rulesOf}'s copy rules`, checkBrandCopy(rulesOf as BrandId, legalDocText(doc)).length === 0);
  }
}

// ── The kit components' props ───────────────────────────────────────
// The app's JSX compiles to React.createElement here (tsconfig "jsx":
// "preserve" leaves it to Next), so React must be in scope to render.
(globalThis as unknown as { React: typeof React }).React = React;
{
  const topics = brandContactTopics({ trade: { label: "Clinic and salon orders" } });
  const form = (props: Partial<React.ComponentProps<typeof ContactForm>> = {}) =>
    renderToStaticMarkup(createElement(ContactForm, { topics, complaintAckDays: 5, messageMax: 2000, ...props }));
  const chosen = (html: string) => [...html.matchAll(/<option value="([^"]*)"[^>]*selected=""/g)].map((m) => m[1]);
  const plain = form();
  check("contact form: its own words by default", ["What is it about?", "Choose a topic", "Your name", "Email", "Message", "Send message"].every((w) => plain.includes(w)));
  check("contact form: opens on no topic by default", chosen(plain).join() === "", JSON.stringify(chosen(plain)));
  const clinic = form({ defaultTopic: "wholesale", text: { topic: "What would you like to order?", submit: "Send enquiry" } });
  check("contact form: opens on its default topic, with no ?topic= link", chosen(clinic).join() === "wholesale", JSON.stringify(chosen(clinic)));
  check(
    "contact form: the words given replace the kit's, the rest stay",
    clinic.includes("What would you like to order?") && clinic.includes("Send enquiry") && !clinic.includes("Send message") && clinic.includes("Your name")
  );
  check("contact form: a default topic it does not offer opens on none", chosen(form({ defaultTopic: "not-a-topic" })).join() === "");
  check("cookie banner: a plain string names the companies", cookieBannerBody("{companies} cookies tell us how the site is used.", "Meta and Google") === "Meta and Google cookies tell us how the site is used.");
  check("cookie banner: a function still works", cookieBannerBody((c: string) => `Cookies from ${c}.`, "Google") === "Cookies from Google.");
  check("cookie banner: no body, the kit's own words", cookieBannerBody(undefined, "Google") === null);
  check(
    "signup popup: its quiet pages are exported, paying, receipt, legal and contact",
    ["/checkout", "/order-confirmation", "/privacy", "/terms", "/returns", "/disclaimer", "/contact"].every((p) => DEFAULT_QUIET_PATHS.includes(p))
  );
}

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
    const v = checkBrandCopy(id as BrandId, src, rel);
    check(`${rel} passes ${id}'s copy rules`, v.length === 0, JSON.stringify(v));
    check(`${rel} names no payment provider`, !/stripe/i.test(src));
  }
}
for (const file of filesUnder(path.join(ROOT, "components", "commerce"))) {
  check(`${path.relative(ROOT, file)} names no payment provider`, !/stripe/i.test(readFileSync(file, "utf8")));
}

/**
 * The stock level as a prerender on the VPS reads it: the database is a
 * placeholder that cannot be opened. It must read as "not low", say why in
 * one line, and never throw.
 */
async function stockWithoutDatabase() {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "file:/nonexistent-test-kit-dir/placeholder.db";
  const warn = console.warn;
  const warned: string[] = [];
  console.warn = (...a: unknown[]) => {
    warned.push(a.map(String).join(" "));
  };
  try {
    const view = await withStockLevel(storefrontView(profiles.gym!));
    check("stock: no database reads as not low", view.stock.low === false);
    check("stock: and says so in one line", warned.length === 1 && warned[0]!.startsWith("[internal]") && !warned[0]!.includes("\n"), JSON.stringify(warned));
    check("stock: the rest of the view is as built", JSON.stringify({ ...view, stock: undefined }) === JSON.stringify({ ...storefrontView(profiles.gym!), stock: undefined }));
  } finally {
    console.warn = warn;
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
}

stockWithoutDatabase().then(() => {
  if (failures > 0) {
    console.error(`\n${failures} kit check(s) failed.`);
    process.exit(1);
  }
  console.log("✓ commerce kit: all checks passed");
});
