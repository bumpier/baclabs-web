/**
 * scripts/new-brand.ts against this repo, as a dry run: the plan for a demo
 * brand copies every template file with nothing of the template left in it,
 * edits each place that lists the brands, and the brand it would make
 * passes every check:brands rule; and every id, name, domain and code that
 * is taken or malformed is refused. Run with `npm run test:new-brand`.
 * Writes nothing. The end-to-end proof (apply, tsc, build, curl) runs in a
 * throwaway copy, never here: deploy/NEW-BRAND.md.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { brandFor } from "@/brands/registry";
import { BRAND_IDS } from "@/brands/types";
import { checkBrandCopy } from "@/lib/content-rules";
import { checkCopy, checkLeaks, leakMarkers, sourceFacts } from "./check-brands";
import { changedLines, descriptorFor, formatHosts, planNewBrand, Refusal, shortCodeFor, type NewBrandOptions } from "./new-brand";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const ROOT = path.resolve(__dirname, "..");
const DEMO: NewBrandOptions = { id: "demo", name: "Demo", domain: "demo.invalid" };

function filesUnder(dir: string, rel = ""): string[] {
  return readdirSync(path.join(dir, rel)).flatMap((name) => {
    const child = rel ? `${rel}/${name}` : name;
    return statSync(path.join(dir, child)).isDirectory() ? filesUnder(dir, child) : [child];
  });
}

// ── The plan for a demo brand ───────────────────────────────────────
const plan = planNewBrand(ROOT, DEMO);
const template = filesUnder(path.join(ROOT, "brands/_template"));
check("every template file is copied", plan.creates.length === template.length, `${plan.creates.length} vs ${template.length}`);
check(
  "into brands/demo, app/demo and public/demo",
  plan.creates.every((c) => /^(?:brands|app|public)\/demo\//.test(c.path)) && plan.creates.some((c) => c.path === "app/demo/[...missing]/page.tsx")
);
check("nothing is written by a plan", !existsSync(path.join(ROOT, "brands/demo")) && !existsSync(path.join(ROOT, "app/demo")));
const leftovers = plan.creates.filter((c) => /_template|template brand|template\.invalid|TPL-|templateProfile|templateCatalogue|^\/\/ TEMPLATE/i.test(c.text));
check("nothing of the template is left", leftovers.length === 0, leftovers.map((c) => c.path).join());
const file = (p: string) => plan.creates.find((c) => c.path === p)?.text ?? "";
const profile = file("brands/demo/profile.ts");
check("the profile is the demo brand's", /id: "demo",/.test(profile) && /export function demoProfile\(\)/.test(profile) && /name: "Demo",/.test(profile));
check("its domains are its hosts.json entry", profile.includes('import hosts from "../hosts.json";') && profile.includes("domains: [...hosts.demo],"));
check("no cast is left", !/as BrandId/.test(profile) && !/BrandId/.test(profile));
check("its codes", /shortCode: "DE",/.test(profile) && /statementDescriptor: "DEMO",/.test(profile) && file("brands/demo/catalogue.ts").includes('parentSku: "DEMO-10ML"'));
check("its mailbox is on its domain", profile.includes("hello@demo.invalid"));
check("it starts with no payment provider", profile.includes("paymentProviders: [],"));
check("it starts not live", /export const LIVE = false;/.test(file("app/demo/site.ts")));
check("its layout loads its own stylesheet", file("app/demo/layout.tsx").includes('import "@/brands/demo/styles.css";'));
check("its stylesheet scans its own tree", file("brands/demo/styles.css").includes('@source "../../app/demo";'));
check("its icon carries its initial", />D<\/text>/.test(file("public/demo/icon.svg")));

const edits = new Map(plan.edits.map((e) => [e.path, e]));
check(
  "it edits every place that lists the brands",
  ["brands/types.ts", "brands/registry.ts", "brands/hosts.json", "middleware.ts", "app/globals.css", "lib/content-rules.ts"].every((p) => edits.has(p)) && plan.edits.length === 6,
  [...edits.keys()].join()
);
for (const e of plan.edits) check(`${e.path}: the edit changes it`, e.before !== e.after && e.before === readFileSync(path.join(ROOT, e.path), "utf8"));
const after = (p: string) => edits.get(p)?.after ?? "";
check("BRAND_IDS gains it last", after("brands/types.ts").includes(`export const BRAND_IDS = [${BRAND_IDS.map((id) => `"${id}"`).join(", ")}, "demo"] as const;`));
check("the registry imports and lists it", after("brands/registry.ts").includes('import { demoProfile } from "./demo/profile";') && /\n {2}demo: demoProfile,\n\};/.test(after("brands/registry.ts")));
const hosts = JSON.parse(after("brands/hosts.json")) as Record<string, string[]>;
check("hosts.json gains its development host only", JSON.stringify(hosts.demo) === '["demo.localhost"]' && Object.keys(hosts).at(-1) === "demo");
check("middleware's tree matcher names it", after("middleware.ts").includes('"/(beauty|gym|wholesale|luxury|demo)/:path*"'));
check("middleware's host matcher names its host", after("middleware.ts").includes("|demo\\\\.localhost)\""));
check("BacLab's stylesheet skips its tree", after("app/globals.css").includes('@source not "../app/luxury";\n@source not "../app/demo";'));
check("its copy-rule layer starts empty", /\n {2}demo: \[\],\n\};/.test(after("lib/content-rules.ts")));
for (const e of plan.edits) {
  const removed = changedLines(e.before, e.after).filter((l) => l.trimStart().startsWith("- "));
  if (["brands/registry.ts", "app/globals.css", "lib/content-rules.ts"].includes(e.path)) check(`${e.path}: only adds lines`, removed.length === 0, removed.join("\n"));
}

// What it makes passes check:brands: every brand's rules (it has none of
// its own yet), no other brand named, and the raw source (comments too, as
// npm run test:kit reads it) holds no banned word or payment provider.
const strings = plan.creates.filter((c) => /\.(?:tsx?|css)$/.test(c.path)).flatMap((c) => sourceFacts(c.path, c.text).strings);
for (const id of BRAND_IDS) check(`its copy passes ${id}'s rules`, checkCopy("demo", id, strings).length === 0, JSON.stringify(checkCopy("demo", id, strings)));
const registered = BRAND_IDS.map((id) => brandFor(id));
check("it names no other brand", checkLeaks("demo", strings, leakMarkers("demo", registered)).length === 0, JSON.stringify(checkLeaks("demo", strings, leakMarkers("demo", registered))));
for (const c of plan.creates.filter((x) => x.path.startsWith("app/"))) {
  check(`${c.path}: raw source passes the base rules`, checkBrandCopy("wholesale", c.text, c.path).length === 0);
  check(`${c.path}: names no payment provider`, !/stripe|paypal/i.test(c.text));
}

// ── Refusals ────────────────────────────────────────────────────────
function refusal(over: Partial<NewBrandOptions>): string {
  try {
    planNewBrand(ROOT, { ...DEMO, ...over });
    return "";
  } catch (err) {
    if (err instanceof Refusal) return err.message;
    throw err;
  }
}
const refuses = (label: string, over: Partial<NewBrandOptions>, re: RegExp) => {
  const why = refusal(over);
  check(`refuses ${label}`, re.test(why), why || "(accepted)");
};
refuses("an existing brand", { id: "luxury" }, /already a brand/);
refuses("BacLab", { id: "baclab" }, /already a brand/);
refuses("capitals", { id: "Demo" }, /lower-case letters and digits only/);
refuses("an underscore", { id: "_template" }, /lower-case letters and digits only/);
refuses("a hyphen", { id: "demo-x" }, /no hyphens/);
refuses("a leading digit", { id: "9demo" }, /starts with a letter/);
refuses("a long id", { id: "a".repeat(21) }, /20 characters at most/);
refuses("a BacLab page", { id: "products" }, /already a path on BacLab's site/);
refuses("BacLab's admin", { id: "admin" }, /app\/admin already exists/);
refuses("the API", { id: "api" }, /app\/api already exists/);
refuses("a public folder", { id: "brand" }, /public\/brand already exists/);
refuses("a public file", { id: "logo" }, /already a path on BacLab's site/);
refuses("a redirect", { id: "cart" }, /already a path on BacLab's site/);
refuses("a metadata route", { id: "robots" }, /already a path on BacLab's site/);
refuses("another brand's name", { name: "GymWater" }, /too close to GymWater/);
refuses("a name inside another's", { name: "Water" }, /too close to GymWater/);
refuses("BacLab's name", { name: "BacLab Plus" }, /never names BacLab/);
refuses("a name too long for the label", { name: "A".repeat(26) }, /2 to 25 characters/);
refuses("a name with a quote", { name: 'Demo "X"' }, /letters, digits, spaces/);
refuses("another brand's host", { domain: "luxury.localhost" }, /LuxeVial \(luxury\) uses it/);
refuses("another brand's mailbox domain", { domain: "gym.invalid" }, /GymWater \(gym\) uses it/);
refuses("BacLab's domain", { domain: "baclab.co.uk" }, /never on BacLab's domain/);
refuses("a www host", { domain: "www.demo.co.uk" }, /without www/);
refuses("a URL", { domain: "https://demo.co.uk" }, /lower-case host name/);
refuses("a taken short code", { shortCode: "LV" }, /LV is LuxeVial's/);
refuses("a derived short code that is taken", { name: "Lilac Vale" }, /LV is LuxeVial's/);
refuses("a short code of three letters", { shortCode: "DEM" }, /two letters/);
refuses("a taken SKU stem", { skuStem: "lux" }, /LUX is LuxeVial's/);
refuses("a scanner prefix as the stem", { skuStem: "ORD" }, /reserved/);
check("accepts its own short code and stem", refusal({ shortCode: "dx", skuStem: "dmo" }) === "" && planNewBrand(ROOT, { ...DEMO, shortCode: "dx", skuStem: "dmo" }).creates.some((c) => c.text.includes('parentSku: "DMO-10ML"')));

// ── The helpers ─────────────────────────────────────────────────────
check("descriptor: accents dropped", descriptorFor("Maison Rosé") === "MAISON ROSE");
check("descriptor: . kept", descriptorFor("Reserve No.10") === "RESERVE NO.10");
check("descriptor: & dropped", descriptorFor("Grit & Iron") === "GRIT IRON");
check("descriptor: cut to 22", descriptorFor("A Very Long Brand Name Indeed").length <= 22);
check("short code: two words", shortCodeFor("Reserve No.10") === "RN" && shortCodeFor("Aurelle") === "AU" && shortCodeFor("Maison Rosé") === "MR");
check("hosts.json is laid out as the script writes it", formatHosts(JSON.parse(readFileSync(path.join(ROOT, "brands/hosts.json"), "utf8"))) === readFileSync(path.join(ROOT, "brands/hosts.json"), "utf8"));
check("a diff shows only what changed", changedLines("a\nb\nc", "a\nB\nc\nd").join("|") === "      - b|      + B|      + d");

if (failures > 0) {
  console.error(`\n${failures} new-brand check(s) failed.`);
  process.exit(1);
}
console.log("✓ new-brand: the plan is complete and every bad input is refused");
