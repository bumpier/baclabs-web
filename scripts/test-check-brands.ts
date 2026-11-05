/**
 * Proves every rule in scripts/check-brands.ts fires: a launch-ready fixture
 * brand passes clean, then each rule is broken on its own and must fail (or,
 * for a placeholder, warn). Run with `npm run test:check-brands`. Exits
 * non-zero on any failure, like the other tsx test scripts.
 *
 * The fixture is scripts/fixtures/test-brand.ts, filled out to launch: it is
 * never registered as a real brand, and nothing here writes a file.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { brandFor, type BrandProfile } from "@/brands/registry";
import { PAYPAL_PAYMENT, STRIPE_PAYMENT } from "@/brands/payment-methods";
import type { BrandCatalogue } from "@/brands/types";
import { DELIVERY, DELIVERY_OPTIONS } from "@/config/funnel";
import { brandSkuSpecs } from "@/lib/inventory/brand-skus";
import { VIAL_SKU_CODE } from "@/lib/inventory/demand";
import {
  checkAssets,
  checkCatalogue,
  checkCopy,
  checkIdentity,
  checkLeaks,
  checkNotes,
  checkPayments,
  checkRegistry,
  descriptorProblems,
  stripeDescriptorProblems,
  failuresOf,
  leakMarkers,
  profileStrings,
  runChecks,
  seedStrings,
  sourceFacts,
  type CopyString,
  type Finding,
  type Registry,
} from "./check-brands";
import { registerTestBrand, TEST_BRAND_ID } from "./fixtures/test-brand";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const ROOT = path.resolve(__dirname, "..");
const show = (fs: readonly Finding[]) => fs.map((f) => `${f.level}: ${f.message}`).join(" | ");
const fails = (fs: readonly Finding[], re: RegExp) => fs.some((f) => f.level === "fail" && re.test(f.message));
const warns = (fs: readonly Finding[], re: RegExp) => fs.some((f) => f.level === "warn" && re.test(f.message));
const noFailures = (fs: readonly Finding[]) => fs.every((f) => f.level !== "fail");

// ── A launch-ready fixture ──────────────────────────────────────────
const catalogue: BrandCatalogue = {
  parentSku: "FIX-10ML",
  boxSku: "FIX-BOX",
  packs: [
    { id: "x1", sku: "FIX-10ML-X1", vials: 1, priceMinor: 699, label: "", available: true },
    { id: "x3", sku: "FIX-10ML-X3", vials: 3, priceMinor: 1899, label: "", available: true },
    { id: "x5", sku: "FIX-10ML-X5", vials: 5, priceMinor: 2999, label: "", available: true },
  ],
  addOns: [],
  delivery: { options: DELIVERY_OPTIONS, freeFromMinor: DELIVERY.freeFromMinor },
  maxVials: 100,
  allowPromotionCodes: false,
  collectBusinessDetails: false,
  collectGiftNote: false,
};
const DOMAINS = ["fixturebrand.co.uk", "www.fixturebrand.co.uk", `${TEST_BRAND_ID}.localhost`];
const good: BrandProfile = {
  ...registerTestBrand(),
  origin: "https://fixturebrand.co.uk",
  domains: DOMAINS,
  email: {
    from: "Fixture & Co <hello@fixturebrand.co.uk>",
    contact: "help@fixturebrand.co.uk",
    // A subdomain of the brand's own apex is the brand's own.
    inbox: "contact@send.fixturebrand.co.uk",
  },
  legalName: "Fixture Trading Ltd",
  company: { number: "01234567", registeredAddress: "1 Test Street, London" },
  paymentProviders: ["paypal"],
  payment: PAYPAL_PAYMENT,
  statementDescriptor: "FIXTURE CO",
  shipping: { senderCompany: "Fixture Co", packingNote: "Fixture box" },
  catalogue,
};
const luxury = brandFor("luxury");
const gym = brandFor("gym");

function registry(b: BrandProfile, over: Partial<Registry> = {}): Registry {
  return {
    hosts: { [TEST_BRAND_ID]: b.domains, luxury: luxury.domains, gym: gym.domains },
    brands: [brandFor("baclab"), luxury, gym, b],
    seeded: brandSkuSpecs([luxury, gym, b]),
    hasAdapter: (p) => p === "paypal" || p === "stripe",
    stripePrefix: "FIXCO",
    ...over,
  };
}
const identity = (b: BrandProfile, over: Partial<Registry> = {}) => checkIdentity(b, registry(b, over));
const payments = (b: BrandProfile) => checkPayments(b, registry(b));
const cataloguing = (b: BrandProfile, over: Partial<Registry> = {}) => checkCatalogue(b, registry(b, over));
const all = (b: BrandProfile) => [...identity(b), ...payments(b), ...cataloguing(b)];

check("the fixture is launch-ready: no findings at all", all(good).length === 0, show(all(good)));

// ── Identity ────────────────────────────────────────────────────────
check("domains must be the hosts.json entry", fails(identity(good, { hosts: { [TEST_BRAND_ID]: ["fixturebrand.co.uk"] } }), /are not its brands\/hosts\.json entry/));
check("a brand must be in hosts.json", fails(identity(good, { hosts: {} }), /is not in brands\/hosts\.json/));
const noDev = { ...good, domains: DOMAINS.slice(0, 2) };
check("a brand needs its development host", fails(identity(noDev), /no development host/));
const sharing = { ...good, domains: [...DOMAINS, "luxury.localhost"] };
check("a domain of another brand's fails", fails(identity(sharing), /domain luxury\.localhost is Reserve No\.10's/), show(identity(sharing)));
const takingBacLab = { ...good, domains: [...DOMAINS, "baclab.co.uk"] };
check("BacLab's domain fails", fails(identity(takingBacLab), /domain baclab\.co\.uk is BacLab's/), show(identity(takingBacLab)));
const badHost = { ...good, domains: [...DOMAINS, "Fixture.co.uk:443"] };
check("a domain must be a bare lower-case host", fails(identity(badHost), /not a lower-case host name/));
check("the origin must be on its domains", fails(identity({ ...good, origin: "https://elsewhere.co.uk" }), /is not on one of its domains/));
check("the origin has no path or trailing slash", fails(identity({ ...good, origin: "https://fixturebrand.co.uk/" }), /scheme and host only/));
check("the origin must be a URL", fails(identity({ ...good, origin: "fixturebrand.co.uk" }), /is not a URL/));
const mail = (field: "from" | "contact" | "inbox", value: string) => identity({ ...good, email: { ...good.email, [field]: value } });
check("from: another brand's domain fails", fails(mail("from", "Fixture <hello@luxury.invalid>"), /email\.from .* is on Reserve No\.10's domain/), show(mail("from", "Fixture <hello@luxury.invalid>")));
check("contact: BacLab's domain fails", fails(mail("contact", "hello@baclab.co.uk"), /email\.contact .* is on BacLab's domain/), show(mail("contact", "hello@baclab.co.uk")));
check("inbox: a domain not the brand's fails", fails(mail("inbox", "fixture@gmail.com"), /email\.inbox .* is not on the brand's own domain/));
check("from: no mailbox fails", fails(mail("from", "Fixture & Co"), /has no mailbox/));
check("from: empty fails", fails(mail("from", ""), /email\.from is empty/));

// Placeholders are warnings, never failures.
const building: BrandProfile = {
  ...good,
  origin: `http://${TEST_BRAND_ID}.localhost:3000`,
  domains: [`${TEST_BRAND_ID}.localhost`],
  email: { from: "Fixture & Co <hello@fixturebrand.invalid>", contact: "", inbox: "" },
  legalName: "",
  company: undefined,
};
const b1 = identity(building);
check("a brand being built has no failures", noFailures(b1), show(b1));
check("warns: development origin", warns(b1, /a development origin/));
check("warns: no public domain", warns(b1, /has no public domain yet/));
check("warns: placeholder mailbox", warns(b1, /is a placeholder mailbox/));
check("warns: no contact address", warns(b1, /email\.contact is empty/));
check("warns: no inbox", warns(b1, /email\.inbox is empty/));
check("warns: no legal name", warns(b1, /legalName is empty/));
check("warns: no company details", warns(b1, /company number and registered office/));
const realMailNoHosts = identity({ ...building, email: { ...building.email, from: "Fixture <hello@fixturebrand.co.uk>" } });
check("a real mailbox before the domain is in hosts.json warns", noFailures(realMailNoHosts) && warns(realMailNoHosts, /does not list for the brand yet/), show(realMailNoHosts));

// ── Payments ────────────────────────────────────────────────────────
for (const b of [brandFor("beauty"), gym, brandFor("wholesale"), luxury]) {
  check(`${b.id}'s descriptor is valid`, descriptorProblems(b.statementDescriptor ?? "x").length === 0, b.statementDescriptor);
}
const desc = (d: string) => payments({ ...good, statementDescriptor: d });
check("descriptor: 23 characters fails", fails(desc("FIXTURE COMPANY LIMITED"), /is 23 characters; a statement prints 22/));
check("descriptor: 22 characters passes", noFailures(desc("FIXTURE COMPANY LIMITE")));
check("descriptor: * fails", fails(desc("FIXTURE*CO"), /may only use letters, digits, spaces/));
check("descriptor: a quote fails", fails(desc("FIXTURE'S"), /may only use letters, digits, spaces/));
check("descriptor: an accent fails", fails(desc("MAISON ROSÉ"), /may only use letters, digits, spaces/));
check("descriptor: no letter fails", fails(desc("12345"), /needs at least one letter/));
check("descriptor: a double space fails", fails(desc("FIXTURE  CO"), /double space/));
check("descriptor: \".\" and \"-\" pass", noFailures(desc("NO.10 FIX-CO")));
check("descriptor: unset with a provider warns", warns(payments({ ...good, statementDescriptor: undefined }), /has no statementDescriptor/));

// Stripe: the account's prefix, then "* ", then the descriptor, 22 in all.
const onStripe: BrandProfile = {
  ...good,
  paymentProviders: ["stripe"],
  payment: STRIPE_PAYMENT,
  paymentPage: { logo: "/checkout-logo.png", icon: "/checkout-icon.png" },
};
const stripeWith = (b: BrandProfile, prefix: string | null) => checkPayments(b, registry(b, { stripePrefix: prefix }));
check("stripe: a launch-ready Stripe brand has no findings", stripeWith(onStripe, "FIXCO").length === 0, show(stripeWith(onStripe, "FIXCO")));
const fit = (d: string, prefix: string | null) => stripeWith({ ...onStripe, statementDescriptor: d }, prefix);
check("stripe: prefix + \"* \" + descriptor at 22 passes", noFailures(fit("RESERVE NO10", "ABCDEFGH")), show(fit("RESERVE NO10", "ABCDEFGH")));
check(
  "stripe: at 23 fails, showing the statement",
  fails(fit("RESERVE NO10", "ABCDEFGHI"), /prints on Stripe as "ABCDEFGHI\* RESERVE NO10", 23 characters; Stripe allows 22 with the prefix, which leaves 11/),
  show(fit("RESERVE NO10", "ABCDEFGHI"))
);
check("stripe: a short prefix leaves more room", noFailures(fit("FIXTURE COMPANY LT", "FX")));
check("stripe: with no prefix recorded, a launch warning", noFailures(fit("FIXTURE CO", null)) && warns(fit("FIXTURE CO", null), /shortened descriptor is not recorded in STRIPE_STATEMENT_PREFIX/));
check(
  "stripe: and the worst case is warned of, never failed",
  noFailures(fit("RESERVE NO10", null)) && warns(fit("RESERVE NO10", null), /is 12 characters; after Stripe's longest prefix \(10\) and "\* " there is room for 10/),
  show(fit("RESERVE NO10", null))
);
check("stripe: the rule is Stripe's alone", payments({ ...good, statementDescriptor: "FIXTURE COMPANY LIMITE" }).every((f) => !/Stripe/.test(f.message)));
check("stripe: no images for Stripe's page warns", warns(stripeWith({ ...onStripe, paymentPage: undefined }, "FIXCO"), /Stripe's page shows the account's own, which are BacLab's/));
check("stripe: a logo without an icon warns", warns(stripeWith({ ...onStripe, paymentPage: { logo: "/checkout-logo.png" } }, "FIXCO"), /has no paymentPage\.logo and \.icon/));
for (const b of [brandFor("beauty"), gym, brandFor("wholesale"), luxury]) {
  // Each fits after Stripe's longest prefix (10), so the account's shortened
  // descriptor may be any length Stripe allows (deploy/BRAND-PAYMENTS.md).
  check(`${b.id}'s descriptor fits after any prefix`, stripeDescriptorProblems(b.statementDescriptor ?? "", null).length === 0, b.statementDescriptor);
}
const prefixed = (prefix: string) => checkRegistry(registry(good, { stripePrefix: prefix }));
check("prefix: a good one passes", prefixed("FIXCO").length === 0, show(prefixed("FIXCO")));
check("prefix: 1 character fails", fails(prefixed("F"), /is 1 characters; Stripe's shortened descriptor is 2 to 10/));
check("prefix: 11 characters fails", fails(prefixed("FIXTURECOMP"), /is 11 characters/));
check("prefix: no letter fails", fails(prefixed("12345"), /needs at least one letter/));
check("prefix: \"*\" fails", fails(prefixed("FIX*CO"), /may only use letters, digits, spaces/));
check("prefix: BacLab's name fails", fails(prefixed("BACLAB"), /names BacLab/) && fails(prefixed("BAC LAB CO"), /names BacLab/));
check("prefix: unset is no registry finding", checkRegistry(registry(good, { stripePrefix: null })).length === 0);
const sender = (s: string) => payments({ ...good, shipping: { senderCompany: s } });
check("sender company: 26 characters fails", fails(sender("Fixture Company Trading Lt"), /is 26 characters; SmartTrack takes 25/));
check("sender company: 25 characters passes", noFailures(sender("Fixture Company Trading L")));
check("sender company: unset warns", warns(payments({ ...good, shipping: undefined }), /has no shipping\.senderCompany/));
// A provider id outside BRAND_PAYMENT_PROVIDERS can only arrive by a cast: that is the mistake being caught.
const unknownProvider = { ...good, paymentProviders: ["airwallex"] as unknown as BrandProfile["paymentProviders"] };
check("a provider without an adapter fails", fails(payments(unknownProvider), /payment provider "airwallex" has no adapter/));
check("a provider listed twice fails", fails(payments({ ...good, paymentProviders: ["paypal", "paypal"] }), /lists a provider twice/));
const wordsOnly = payments({ ...good, paymentProviders: [] });
check("method words without the provider fail", fails(wordsOnly, /payment\.methods describes "paypal"/));
check("no provider warns", warns(wordsOnly, /takes no payment/));
check("a provider without words warns", warns(payments({ ...good, payment: undefined }), /do not say how paypal takes payment/));

// ── Catalogue ───────────────────────────────────────────────────────
const withPacks = (packs: BrandCatalogue["packs"], over: Partial<BrandCatalogue> = {}): BrandProfile => ({ ...good, catalogue: { ...catalogue, packs, ...over } });
const [p1, p3, p5] = catalogue.packs as [BrandCatalogue["packs"][number], BrandCatalogue["packs"][number], BrandCatalogue["packs"][number]];
const rising = withPacks([p1, { ...p3, priceMinor: 2199 }, p5]);
check("per-vial price rising fails", fails(cataloguing(rising), /does not fall from the 1-pack \(£6\.99\) to the 3-pack \(£7\.33\)/), show(cataloguing(rising)));
check("per-vial price level fails", fails(cataloguing(withPacks([p1, { ...p3, priceMinor: 2097 }])), /does not fall from the 1-pack/));
check("two packs of one size fail", fails(cataloguing(withPacks([p1, { ...p1, id: "x1b", sku: "FIX-10ML-X1B" }])), /two packs hold 1 vials/));
const notSeeded = registry(good, { seeded: brandSkuSpecs([luxury, gym, withPacks([p1, p3])]) });
check("a pack the seed does not create fails", fails(checkCatalogue(good, notSeeded), /pack FIX-10ML-X5 is not a kit that scripts\/seed-brand-skus\.ts creates/));
check("no seed at all fails", fails(cataloguing(good, { seeded: [] }), /seeds nothing for it/));
const lower = withPacks([{ ...p1, sku: "fix-10ml-x1" }, p3, p5]);
check("a lower-case SKU fails", fails(cataloguing(lower), /"fix-10ml-x1" is not written as the warehouse stores it/));
check("a SKU off its stem fails", fails(cataloguing(withPacks([{ ...p1, sku: "FIX-10ML-X2" }, p3, p5])), /pack FIX-10ML-X2 should be FIX-10ML-X1/));
check("a SKU the scanner would misread fails", fails(cataloguing(withPacks(catalogue.packs, { boxSku: "ORD-BOX" })), /cannot start with ORD-/));
check("another brand's box SKU fails", fails(cataloguing(withPacks(catalogue.packs, { boxSku: "LUX-BOX" })), /SKU LUX-BOX is also Reserve No\.10's/));
check("no catalogue fails", fails(cataloguing({ ...good, catalogue: undefined }), /has no catalogue/));

// ── Assets ──────────────────────────────────────────────────────────
const roots = { app: "app/fixture", public: "public/fixture" };
const have = (...files: string[]) => (p: string) => files.includes(p);
const icon = "public/fixture/icon.svg";
check("logo and icon present passes", checkAssets({ id: TEST_BRAND_ID, logo: "/icon.svg" }, [], roots, have(icon)).length === 0);
check("a missing logo fails", fails(checkAssets({ id: TEST_BRAND_ID, logo: "/logo.svg" }, [], roots, have(icon)), /logo \/logo\.svg is not in public\/fixture\//));
check("a missing icon fails", fails(checkAssets({ id: TEST_BRAND_ID, logo: "/logo.svg" }, [], roots, have("public/fixture/logo.svg")), /icon\.svg is missing/));
check("a logo that is not a site path fails", fails(checkAssets({ id: TEST_BRAND_ID, logo: "logo.svg" }, [], roots, have(icon)), /is not a site path/));
const stripeImages = (paymentPage: { logo?: string; icon?: string }, ...files: string[]) =>
  checkAssets({ id: TEST_BRAND_ID, logo: "/icon.svg", paymentPage }, [], roots, have(icon, ...files));
check("Stripe's images present pass", stripeImages({ logo: "/pay-logo.png", icon: "/pay-icon.jpg" }, "public/fixture/pay-logo.png", "public/fixture/pay-icon.jpg").length === 0);
check("an SVG for Stripe's page fails", fails(stripeImages({ logo: "/icon.svg" }), /paymentPage\.logo "\/icon\.svg" must be a PNG or JPG site path: Stripe takes no SVG/));
check("a missing image for Stripe's page fails", fails(stripeImages({ icon: "/pay-icon.png" }), /paymentPage\.icon \/pay-icon\.png is not in public\/fixture\//));
const page = sourceFacts("app/fixture/page.tsx", `export default function P() { return <main><img src="/hero.jpg" alt="Box" /><a href="/sitemap.xml">Map</a></main>; }`);
check("a page's site paths are read", page.assets.some((a) => a.site === "/hero.jpg") && page.assets.some((a) => a.site === "/sitemap.xml"));
const pageAssets = (exists: (p: string) => boolean) => checkAssets({ id: TEST_BRAND_ID, logo: "/icon.svg" }, page.assets, roots, exists);
check("a missing public file fails", fails(pageAssets(have(icon, "app/fixture/sitemap.xml/route.ts")), /names \/hero\.jpg, which is neither/));
check("a file served by a route passes", noFailures(pageAssets(have(icon, "public/fixture/hero.jpg", "app/fixture/sitemap.xml/route.ts"))));
const layout = sourceFacts("app/fixture/layout.tsx", `import "@/brands/fixture/styles.css";\nimport hero from "./hero.png";\nexport const x = hero;`);
check("imported files are read", layout.assets.map((a) => a.file).join() === "brands/fixture/styles.css,app/fixture/hero.png", JSON.stringify(layout.assets));
check("a missing import fails", fails(checkAssets({ id: TEST_BRAND_ID, logo: "/icon.svg" }, layout.assets, roots, have(icon, "brands/fixture/styles.css")), /imports app\/fixture\/hero\.png/));

// ── Reading copy: strings, template text and JSX, never comments ─────
const texts = (file: string, src: string) => sourceFacts(file, src).strings.map((s) => s.text);
const SRC = `"use client";
import Link from "next/link";
import type { Sale } from "./sale-types";
// The brand does not discount: this comment is not copy.
/* Nor is this sale. */
type Kind = "sale" | "discount";
const keys = { "sale": 1, cheap: "Hand finished" };
const lookup = keys["discount"];
export function P({ n }: { n: number }) {
  return (
    <main className="sale-banner" aria-label="Order now">
      <h1>Our   finest
        vials</h1>
      <p>{\`\${n} vials, sealed\`}</p>
      <Link href="/contact">Contact us</Link>
    </main>
  );
}`;
const got = texts("app/fixture/P.tsx", SRC);
check(
  "reads string literals, template text and JSX text",
  ["Hand finished", "Order now", "Our finest vials", "vials, sealed", "/contact", "Contact us"].every((t) => got.includes(t)),
  JSON.stringify(got)
);
check("skips comments, directives, specifiers, types, keys and class names", !got.some((t) => /sale|discount|use client|next\/link|sale-types/i.test(t)), JSON.stringify(got));
check("strings carry their line", sourceFacts("app/fixture/P.tsx", SRC).strings.find((s) => s.text === "Contact us")?.where === "app/fixture/P.tsx:15");
// The real file the brief names: its comment says the brand "does not discount".
const luxCatalogue = readFileSync(path.join(ROOT, "brands/luxury/catalogue.ts"), "utf8");
check("brands/luxury/catalogue.ts says it in a comment", /does not discount/.test(luxCatalogue));
const luxCopy = sourceFacts("brands/luxury/catalogue.ts", luxCatalogue).strings;
check("and that comment is not luxury copy", checkCopy("luxury", "luxury", luxCopy).length === 0, show(checkCopy("luxury", "luxury", luxCopy)));

const copyFails = (id: "luxury" | "gym" | "beauty" | "wholesale", src: string) => checkCopy(id, id, sourceFacts("app/fixture/P.tsx", src).strings);
check("luxury: JSX text naming a sale fails", fails(copyFails("luxury", `export const P = () => <p>Our winter sale</p>;`), /"sale" breaks luxury's copy rules/));
check("luxury: template text naming a discount fails", fails(copyFails("luxury", "export const t = (n: number) => `A ${n}% discount`;"), /"discount" breaks luxury's copy rules/));
check("gym: a compound in a string fails", fails(copyFails("gym", `export const s = "Stock up for your tren cycle";`), /"tren" breaks gym's copy rules/));
check("gym: slang the user allowed passes", copyFails("gym", `export const s = "Stock up before your next cycle";`).length === 0);
check("beauty: a treatment claim fails", fails(copyFails("beauty", `export const s = "Smooths your skin";`), /breaks beauty's copy rules/));
check("every brand: injection framing fails", fails(copyFails("wholesale", `export const s = "Ready to inject";`), /injection framing/));
check("every brand: the preservative named fails", fails(copyFails("wholesale", `export const s = "With benzyl alcohol";`), /names the preservative/));
check("a profile string is copy too", fails(checkCopy("luxury", "luxury", profileStrings({ ...luxury, disclaimer: "Never on sale." })), /profile disclaimer: "sale"/));

const css = sourceFacts("brands/fixture/styles.css", `/* A sale banner, in a comment. */\n.badge::after { content: "Sale now on"; }\n.x::before { content: ''; }`);
check("CSS content strings are copy", css.strings.map((s) => s.text).join() === "Sale now on" && css.strings[0]!.where === "brands/fixture/styles.css:2");
check("a CSS content string fails the rules", fails(checkCopy("luxury", "luxury", css.strings), /"Sale" breaks luxury's copy rules/));

// ── Leaks ───────────────────────────────────────────────────────────
const markers = leakMarkers("luxury", [brandFor("baclab"), luxury, gym, brandFor("beauty")]);
const src = (text: string): CopyString[] => [{ where: "app/luxury/x.tsx:1", text, kind: "source" }];
const leaks = (strings: CopyString[]) => checkLeaks("luxury", strings, markers);
check("another brand's name fails", fails(leaks(src("As worn at Brute Lab")), /names Brute Lab's name/));
check("a name inside a longer word passes", noFailures(leaks(src("Brute Labrador"))));
check("another brand's host fails", fails(leaks(src("http://gym.localhost:3000/x")), /names Brute Lab's host gym\.localhost/));
check("another brand's mailbox domain fails", fails(leaks(src("hello@beauty.invalid")), /Aurelle's host beauty\.invalid/));
check("another brand's SKU fails", fails(leaks(src("GYM-10ML-X10")), /Brute Lab's SKU GYM-10ML/));
check("BacLab's name fails", fails(leaks(src("By BacLab")), /names BacLab/));
check("BacLab's domain fails", fails(leaks(src("https://baclab.co.uk/terms")), /names BacLab/));
check("the brand's own name passes", noFailures(leaks(src("Reserve No.10, sealed"))));
const seeded = brandSkuSpecs([luxury])[0]!;
check("the seed names the shared vial", seedStrings(seeded).some((s) => s.text.includes(VIAL_SKU_CODE)));
check("the allow-list lets the shared vial code through in the seed", noFailures(leaks(seedStrings(seeded))), show(leaks(seedStrings(seeded))));
check("but not on a page", fails(leaks(src(`Made from ${VIAL_SKU_CODE}`)), /names BacLab/));
check("an SVG naming another brand fails", fails(leaks([{ where: "public/luxury/icon.svg", text: "<svg><text>Aurelle</text></svg>", kind: "asset" }]), /Aurelle's name/));

// ── Launch notes and the LIVE flag ──────────────────────────────────
const site = sourceFacts(
  "app/fixture/site.ts",
  `/**\n * TODO(launch): true once the brand is live.\n */\nexport const LIVE = false;\n// TODO(confirm): the summary line.\nexport const DESCRIPTION = "Coming soon.";\n`
);
check("site.ts: the LIVE flag is read", site.live === false);
check("site.ts: LIVE's own TODO is not a note", !site.notes.some((n) => /once the brand is live/.test(n.text)));
check("site.ts: other TODOs are notes", site.notes.length === 1 && site.notes[0]!.where === "app/fixture/site.ts:5");
check("notes are launch warnings", checkNotes("fixture", site.notes).every((f) => f.level === "warn"));
check("LIVE = true is read", sourceFacts("app/fixture/site.ts", "export const LIVE = true;\n").live === true);
check("a LIVE that is not a literal is null", sourceFacts("app/fixture/site.ts", "export const LIVE = process.env.X === '1';\n").live === null);

const report = { id: "fixture", name: "Fixture", live: false, findings: [...identity(building), ...checkNotes("fixture", site.notes)] };
check("warnings alone do not fail", failuresOf(report, new Set()).length === 0);
check("--launch turns them into failures", failuresOf(report, new Set(["fixture"])).length === report.findings.length && report.findings.length > 0);
check("--launch for another brand leaves them", failuresOf(report, new Set(["other"])).length === 0);
check("a live brand is held to launch", failuresOf({ ...report, live: true }, new Set()).length === report.findings.length);

// ── The registry ────────────────────────────────────────────────────
check("BacLab in hosts.json fails", fails(checkRegistry(registry(good, { hosts: { baclab: ["baclab.localhost"] } })), /lists BacLab/));
check("an unregistered id in hosts.json fails", fails(checkRegistry(registry(good, { hosts: { ghost: ["ghost.localhost"] } })), /lists "ghost"/));

// ── The real tree, and the command line ─────────────────────────────
const tree = runChecks();
check("the real tree has no failures", tree.registry.length === 0 && tree.brands.every((r) => failuresOf(r, new Set()).length === 0), show([...tree.registry, ...tree.brands.flatMap((r) => r.findings.filter((f) => f.level === "fail"))]));
check("the template passes every brand's rules", tree.template.length === 0, show(tree.template));
// The template's copy is held to every brand's rules, not just one: a word
// only one brand bans still fails it.
const templateLine: CopyString[] = [{ where: "brands/_template/app/page.tsx:1", text: "Our winter sale", kind: "source" }];
check("a word only luxury bans fails the template", (["beauty", "gym", "wholesale", "baclab"] as const).every((id) => checkCopy("_template", id, templateLine).length === 0) && fails(checkCopy("_template", "luxury", templateLine), /breaks luxury's/));
const lux = tree.brands.find((r) => r.id === "luxury")!;
const cli = (...args: string[]) => spawnSync(process.execPath, [require.resolve("tsx/cli"), path.join(ROOT, "scripts/check-brands.ts"), ...args], { cwd: ROOT, encoding: "utf8" });
check("the command passes on the tree", cli().status === 0);
const launch = cli("--launch", "luxury");
check(
  "--launch luxury fails while luxury has launch warnings",
  launch.status === (lux.findings.some((f) => f.level === "warn") ? 1 : 0),
  `${launch.status}: ${launch.stderr.slice(0, 300)}`
);
check("--launch for an unknown brand is refused", cli("--launch", "nope").status === 2);
check("--launch for BacLab is refused", cli("--launch", "baclab").status === 2);

if (failures > 0) {
  console.error(`\n${failures} check-brands check(s) failed.`);
  process.exit(1);
}
console.log("✓ check-brands: every rule fires");
