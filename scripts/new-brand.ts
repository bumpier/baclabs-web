/**
 * Make a new brand from brands/_template/ and register it.
 *
 *   npm run new-brand -- <id> --name "<Name>" --domain <domain>            # dry run
 *   npm run new-brand -- <id> --name "<Name>" --domain <domain> --apply    # write
 *
 * Options: --short XY (the two-letter staff code; default from the name),
 * --sku STEM (the SKU stem, as in STEM-10ML-X3; default the id in capitals).
 *
 * A dry run prints every file it would create and every edit it would make,
 * and writes nothing. --apply writes them. It:
 *  - copies the template's profile, catalogue and stylesheet to brands/<id>/,
 *    its app/ to app/<id>/ and its public/ to public/<id>/, with the name,
 *    id, domain, short code, SKU stem and statement descriptor filled in;
 *  - registers the brand everywhere that lists the brands by id:
 *    brands/types.ts (BRAND_IDS), brands/registry.ts (its profile),
 *    brands/hosts.json (its development host, <id>.localhost),
 *    middleware.ts (the two matcher literals Next reads statically),
 *    app/globals.css (keeps BacLab's Tailwind out of app/<id>) and
 *    lib/content-rules.ts (its copy-rule layer, empty: rules 1 and 2 only).
 *    Everything else that lists brands reads one of these: next.config.js
 *    reads hosts.json, the admin's switcher and chips read the registry, and
 *    the tests read BRAND_IDS or hosts.json.
 *
 * The domain goes on the brand's mailbox and in its TODO(launch) notes, not
 * in hosts.json: a brand serves only on its development host until it
 * launches (deploy/NEW-BRAND.md adds the domain then).
 *
 * It refuses an id that is taken (a brand, a folder, a route or a public
 * file of BacLab's, which the brand-tree matcher would turn into a 404 on
 * BacLab's site), or that is not lower-case letters and digits. Hyphens are
 * refused too: the id goes into env names (PAYPAL_CLIENT_ID__<ID>,
 * META_CAPI_ACCESS_TOKEN__<ID>), which cannot hold one, and into a
 * TypeScript identifier. Names, domains, short codes and SKU stems that
 * another brand already uses are refused as well.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { brandFor } from "@/brands/registry";
import { BRAND_IDS } from "@/brands/types";
import { descriptorProblems, TEMPLATE } from "./check-brands";

export interface NewBrandOptions {
  id: string;
  name: string;
  domain: string;
  shortCode?: string;
  skuStem?: string;
}

export interface FileToCreate {
  path: string;
  text: string;
}

export interface FileEdit {
  path: string;
  /** What the edit is for, for the dry run. */
  what: string;
  before: string;
  after: string;
}

export interface NewBrandPlan {
  id: string;
  name: string;
  domain: string;
  shortCode: string;
  skuStem: string;
  descriptor: string;
  creates: FileToCreate[];
  edits: FileEdit[];
}

/** A reason to refuse, for the person running the script. */
export class Refusal extends Error {}

const MAX_ID = 20;
/** SmartTrack's limit on the label's sender company, which starts as the name. */
const MAX_NAME = 25;
const MAX_STEM = 12;
/** Folders and names that are never a brand id, whatever is on disk. */
const RESERVED = new Set(["api", "admin", "_next", "static", "baclab", "brand", "brands", "template", "www", "app", "public"]);

/** Every top-level URL segment BacLab's site already answers, read from app/, public/ and the redirects. */
export function takenSegments(root: string): Set<string> {
  const out = new Set<string>();
  const stem = (name: string) => name.replace(/\.[^.]+$/, "").replace(/\.[^.]+$/, "").toLowerCase();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      // Route groups add no segment: their children are top-level.
      if (/^\(.+\)$/.test(name) && statSync(full).isDirectory()) walk(full);
      else out.add(stem(name));
    }
  };
  walk(path.join(root, "app"));
  for (const name of readdirSync(path.join(root, "public"))) out.add(stem(name));
  const config = readFileSync(path.join(root, "next.config.js"), "utf8");
  for (const m of config.matchAll(/source:\s*"\/([^/":?*]+)/g)) out.add(m[1]!.toLowerCase());
  return out;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The middleware host regex for a hosts.json, exactly as lib/brand/resolve.ts brandHostPattern() builds it. */
function hostPattern(hosts: Record<string, string[]>): string {
  return `(?:${Object.values(hosts).flat().map(escapeRegex).join("|")})`;
}

/** hosts.json as this repo lays it out: one brand per line. */
export function formatHosts(hosts: Record<string, string[]>): string {
  const lines = Object.entries(hosts).map(([id, list]) => `  ${JSON.stringify(id)}: [${list.map((h) => JSON.stringify(h)).join(", ")}]`);
  return `{\n${lines.join(",\n")}\n}\n`;
}

/** "Maison Rosé" -> "MAISON ROSE": the name as a card statement can print it. */
export function descriptorFor(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 .-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 22)
    .trim();
}

/** "Reserve No.10" -> "RN"; "Aurelle" -> "AU". */
export function shortCodeFor(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  return words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "").slice(0, 2);
}

/** Exactly one occurrence of `find` in `text`, replaced; anything else means the template has drifted. */
function replaceOnce(text: string, find: string, replace: string, file: string): string {
  const n = text.split(find).length - 1;
  if (n !== 1) throw new Refusal(`${file}: expected "${find}" once in the template, found it ${n} times. Update scripts/new-brand.ts with the template.`);
  return text.replace(find, () => replace);
}

/** The template's stand-ins. None may survive into a brand. */
const TOKENS = ["// TEMPLATE:", "_template", "Template Brand", "TEMPLATE BRAND", "template.invalid", "TPL-", "templateProfile", "templateCatalogue"];

/** One template file, made the brand's. */
function fill(file: string, text: string, o: Required<NewBrandOptions> & { descriptor: string }): string {
  let out = text;
  // The note that says this is the template, at the top of profile.ts.
  if (out.startsWith("// TEMPLATE:")) out = out.slice(out.indexOf("\n\n") + 2);
  if (file === "profile.ts") {
    out = replaceOnce(out, `import type { BrandId, BrandProfile } from "../types";`, `import hosts from "../hosts.json";\nimport type { BrandProfile } from "../types";`, file);
    out = replaceOnce(out, `id: "_template" as BrandId,`, `id: "${o.id}",`, file);
    out = replaceOnce(out, `domains: ["_template.localhost"],`, `domains: [...hosts.${o.id}],`, file);
    out = replaceOnce(out, `shortCode: "TB",`, `shortCode: "${o.shortCode}",`, file);
    out = replaceOnce(out, `statementDescriptor: "TEMPLATE BRAND",`, `statementDescriptor: "${o.descriptor}",`, file);
  }
  if (file === "public/icon.svg") {
    const initial = (o.name.match(/\p{L}|\p{N}/u)?.[0] ?? "").toUpperCase().replace(/&/g, "&amp;").replace(/</g, "&lt;");
    out = replaceOnce(out, ">T</text>", `>${initial}</text>`, file);
  }
  out = out
    .split("templateProfile").join(`${o.id}Profile`)
    .split("templateCatalogue").join(`${o.id}Catalogue`)
    .split("Template Brand").join(o.name)
    .split("template.invalid").join(o.domain)
    .split("TPL-").join(`${o.skuStem}-`)
    .split("_template").join(o.id);
  const left = TOKENS.filter((t) => out.includes(t));
  if (left.length > 0) throw new Refusal(`${file}: the template still has ${left.join(", ")} after filling in. Update scripts/new-brand.ts with the template.`);
  return out;
}

/** Every file under a folder, relative to it, with "/". */
function filesUnder(dir: string, rel = ""): string[] {
  return readdirSync(path.join(dir, rel)).flatMap((name) => {
    const child = rel ? `${rel}/${name}` : name;
    return statSync(path.join(dir, child)).isDirectory() ? filesUnder(dir, child) : [child];
  });
}

/** Where each template file goes in the repo. */
function destination(file: string, id: string): string {
  if (file.startsWith("app/")) return `app/${id}/${file.slice(4)}`;
  if (file.startsWith("public/")) return `public/${id}/${file.slice(7)}`;
  if (!file.includes("/")) return `brands/${id}/${file}`;
  throw new Refusal(`brands/_template/${file}: no place for it. The template holds profile, catalogue and stylesheet files, app/ and public/.`);
}

/** Check the options against the repo; the filled-in options, or a Refusal. */
function settle(root: string, opts: NewBrandOptions): Required<NewBrandOptions> & { descriptor: string } {
  const { id, domain } = opts;
  const name = opts.name.trim();
  if (!/^[a-z0-9-]+$/.test(id)) throw new Refusal(`"${id}": an id is lower-case letters and digits only.`);
  if (id.includes("-")) throw new Refusal(`"${id}": no hyphens. The id goes into env names (PAYPAL_CLIENT_ID__<ID>, META_CAPI_ACCESS_TOKEN__<ID>), which cannot hold one.`);
  if (!/^[a-z]/.test(id)) throw new Refusal(`"${id}": an id starts with a letter (it names the brand's profile function).`);
  if (id.length > MAX_ID) throw new Refusal(`"${id}": ${MAX_ID} characters at most.`);

  // The registered brands, BacLab included; never a fixture a test registered.
  const brands = BRAND_IDS.map((b) => brandFor(b));
  if (brands.some((b) => b.id === id)) throw new Refusal(`"${id}" is already a brand.`);
  for (const dir of [`brands/${id}`, `app/${id}`, `public/${id}`]) {
    if (existsSync(path.join(root, dir))) throw new Refusal(`"${id}": ${dir} already exists.`);
  }
  if (RESERVED.has(id) || takenSegments(root).has(id)) {
    throw new Refusal(`"${id}": /${id} is already a path on BacLab's site (a route, a public file or a redirect). The brand-tree matcher in middleware.ts would turn it into a 404 there.`);
  }

  if (name.length < 2 || name.length > MAX_NAME) throw new Refusal(`--name "${name}": 2 to ${MAX_NAME} characters (the carrier label's sender name starts as the brand's name).`);
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .&'’-]*$/u.test(name)) throw new Refusal(`--name "${name}": letters, digits, spaces and . & ' - only.`);
  if (/baclab/i.test(name)) throw new Refusal(`--name "${name}": a brand never names BacLab.`);
  for (const b of brands) {
    const [a, c] = [name.toLowerCase(), b.name.toLowerCase()];
    if (a === c || a.includes(c) || c.includes(a)) throw new Refusal(`--name "${name}": too close to ${b.name} (${b.id}). check:brands would read one inside the other as a leak.`);
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    throw new Refusal(`--domain "${domain}": a lower-case host name, no scheme, port or path.`);
  }
  if (domain.startsWith("www.")) throw new Refusal(`--domain "${domain}": the apex, without www.`);
  if (/baclab/i.test(domain)) throw new Refusal(`--domain "${domain}": a brand is never on BacLab's domain.`);
  for (const b of brands) {
    const theirs = [...b.domains, b.email.from, b.email.contact, b.email.inbox].join(" ").toLowerCase();
    if (theirs.includes(domain)) throw new Refusal(`--domain "${domain}": ${b.name} (${b.id}) uses it.`);
  }

  const shortCode = (opts.shortCode ?? shortCodeFor(name)).toUpperCase();
  if (!/^[A-Z]{2}$/.test(shortCode)) throw new Refusal(`short code "${shortCode}": two letters. Pass --short XY.`);
  const codeOwner = brands.find((b) => b.shortCode === shortCode);
  if (codeOwner) throw new Refusal(`short code ${shortCode} is ${codeOwner.name}'s. Pass --short XY with two other letters.`);

  const skuStem = (opts.skuStem ?? id).toUpperCase();
  if (!/^[A-Z][A-Z0-9]*$/.test(skuStem) || skuStem.length > MAX_STEM) {
    throw new Refusal(`SKU stem "${skuStem}": letters and digits, ${MAX_STEM} at most, starting with a letter. Pass --sku STEM.`);
  }
  if (/BACLAB/.test(skuStem) || ["ORD", "LOC"].includes(skuStem)) throw new Refusal(`SKU stem "${skuStem}" is reserved. Pass --sku STEM.`);
  for (const b of brands) {
    const stems = b.catalogue ? [b.catalogue.parentSku, b.catalogue.boxSku].map((c) => c.split("-")[0]) : [];
    if (stems.includes(skuStem)) throw new Refusal(`SKU stem ${skuStem} is ${b.name}'s. Pass --sku STEM with another.`);
  }

  const descriptor = descriptorFor(name);
  const problems = descriptorProblems(descriptor);
  if (problems.length > 0) throw new Refusal(`statement descriptor "${descriptor}" from the name ${problems.join(", ")}.`);
  return { id, name, domain, shortCode, skuStem, descriptor };
}

/** Everything --apply would do, worked out from the repo at `root` without writing a byte. */
export function planNewBrand(root: string, opts: NewBrandOptions): NewBrandPlan {
  const o = settle(root, opts);
  const { id } = o;
  const templateDir = path.join(root, TEMPLATE.dir);
  const creates = filesUnder(templateDir).map((file) => ({
    path: destination(file, id),
    text: fill(file, readFileSync(path.join(templateDir, file), "utf8"), o),
  }));

  const read = (p: string) => readFileSync(path.join(root, p), "utf8");
  const edits: FileEdit[] = [];
  const edit = (p: string, what: string, change: (text: string) => string) => {
    const before = read(p);
    edits.push({ path: p, what, before, after: change(before) });
  };
  const must = (m: RegExpMatchArray | null, p: string, what: string): RegExpMatchArray => {
    if (!m) throw new Refusal(`${p}: could not find ${what}. Has its layout changed? Update scripts/new-brand.ts.`);
    return m;
  };

  edit("brands/types.ts", "BRAND_IDS", (t) => {
    const m = must(t.match(/export const BRAND_IDS = \[([^\]]*)\] as const;/), "brands/types.ts", "BRAND_IDS");
    return t.replace(m[0], `export const BRAND_IDS = [${m[1]}, "${id}"] as const;`);
  });

  edit("brands/registry.ts", "import and register the profile", (t) => {
    const imports = [...t.matchAll(/^import \{ \w+Profile \} from "\.\/\w+\/profile";$/gm)];
    const last = must(imports[imports.length - 1] ?? null, "brands/registry.ts", "the profile imports");
    const at = last.index! + last[0].length;
    let out = `${t.slice(0, at)}\nimport { ${id}Profile } from "./${id}/profile";${t.slice(at)}`;
    const block = must(out.match(/const PROFILES: Record<BrandId, \(\) => BrandProfile> = \{\n[\s\S]*?\n\};/), "brands/registry.ts", "PROFILES");
    out = out.replace(block[0], block[0].replace(/\n\};$/, `\n  ${id}: ${id}Profile,\n};`));
    return out;
  });

  const oldHosts = JSON.parse(read("brands/hosts.json")) as Record<string, string[]>;
  if (formatHosts(oldHosts) !== read("brands/hosts.json")) throw new Refusal("brands/hosts.json is not laid out one brand per line any more. Update scripts/new-brand.ts.");
  const newHosts = { ...oldHosts, [id]: [`${id}.localhost`] };
  edit("brands/hosts.json", "the development host", () => formatHosts(newHosts));

  edit("middleware.ts", "the brand-tree and brand-host matcher literals", (t) => {
    const tree = (hosts: Record<string, string[]>) => JSON.stringify(`/(${Object.keys(hosts).join("|")})/:path*`);
    let out = replaceOnce(t, tree(oldHosts), tree(newHosts), "middleware.ts");
    out = replaceOnce(out, JSON.stringify(hostPattern(oldHosts)), JSON.stringify(hostPattern(newHosts)), "middleware.ts");
    return out;
  });

  edit("app/globals.css", "keep BacLab's Tailwind out of app/<id>", (t) => {
    const lines = [...t.matchAll(/^@source not "\.\.\/app\/[a-z0-9]+";$/gm)];
    const last = must(lines[lines.length - 1] ?? null, "app/globals.css", `the @source not "../app/<id>" lines`);
    const at = last.index! + last[0].length;
    return `${t.slice(0, at)}\n@source not "../app/${id}";${t.slice(at)}`;
  });

  edit("lib/content-rules.ts", "its copy-rule layer", (t) => {
    const block = must(t.match(/const BRAND_LAYERS: Record<BrandId, Rule\[\]> = \{\n[\s\S]*?\n\};/), "lib/content-rules.ts", "BRAND_LAYERS");
    return t.replace(block[0], block[0].replace(/\n\};$/, `\n  // Rules 1 and 2 only, until the brand's voice has words of its own to ban.\n  ${id}: [],\n};`));
  });

  return { ...o, creates, edits };
}

/** Write the plan. Every file it creates must still be absent and every file it edits unchanged since planning. */
export function applyPlan(root: string, plan: NewBrandPlan): void {
  for (const c of plan.creates) if (existsSync(path.join(root, c.path))) throw new Refusal(`${c.path} appeared since planning. Nothing written.`);
  for (const e of plan.edits) if (readFileSync(path.join(root, e.path), "utf8") !== e.before) throw new Refusal(`${e.path} changed since planning. Nothing written.`);
  for (const c of plan.creates) {
    mkdirSync(path.dirname(path.join(root, c.path)), { recursive: true });
    writeFileSync(path.join(root, c.path), c.text);
  }
  for (const e of plan.edits) writeFileSync(path.join(root, e.path), e.after);
}

/** The lines an edit removes and adds, for the dry run: a longest-common-subsequence diff (the files are small). */
export function changedLines(before: string, after: string): string[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  }
  const out: string[] = [];
  let [i, j] = [0, 0];
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) [i, j] = [i + 1, j + 1];
    else if (i < a.length && (j === b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) out.push(`      - ${a[i++]}`);
    else out.push(`      + ${b[j++]}`);
  }
  return out;
}

function parseArgs(argv: string[]): NewBrandOptions & { apply: boolean } {
  const usage = 'Usage: npm run new-brand -- <id> --name "<Name>" --domain <domain> [--short XY] [--sku STEM] [--apply]';
  const out: Partial<NewBrandOptions> & { apply: boolean } = { apply: false };
  const flags: Record<string, keyof NewBrandOptions> = { "--name": "name", "--domain": "domain", "--short": "shortCode", "--sku": "skuStem" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") out.apply = true;
    else if (flags[arg] && argv[i + 1] !== undefined) out[flags[arg]!] = argv[++i]!;
    else if (!arg.startsWith("--") && out.id === undefined) out.id = arg;
    else throw new Refusal(`Unknown or incomplete argument "${arg}".\n${usage}`);
  }
  if (!out.id || !out.name || !out.domain) throw new Refusal(usage);
  return out as NewBrandOptions & { apply: boolean };
}

function main() {
  const root = path.resolve(__dirname, "..");
  try {
    const args = parseArgs(process.argv.slice(2));
    const plan = planNewBrand(root, args);
    console.log(`${args.apply ? "Creating" : "Dry run: would create"} ${plan.name} (${plan.id}): short code ${plan.shortCode}, SKUs ${plan.skuStem}-10ML-X…, box ${plan.skuStem}-BOX, statement descriptor "${plan.descriptor}", development host ${plan.id}.localhost, mailbox hello@${plan.domain}.`);
    console.log(`\nFiles (${plan.creates.length}):`);
    for (const c of plan.creates) console.log(`  + ${c.path}`);
    console.log(`\nEdits (${plan.edits.length}):`);
    for (const e of plan.edits) {
      console.log(`  ~ ${e.path}: ${e.what}`);
      for (const l of changedLines(e.before, e.after)) console.log(l);
    }
    if (!args.apply) {
      console.log("\nNothing written. Re-run with --apply to write.");
      return;
    }
    applyPlan(root, plan);
    console.log(`\nDone. Next:
  1. npx tsc --noEmit && npm run check:brands && npm run test:hosts && npm run test:brands
  2. npm run dev, then open http://${plan.id}.localhost:3000
  3. Design the brand in brands/${plan.id}/ and app/${plan.id}/; give its copy rules in lib/content-rules.ts BRAND_LAYERS.
  4. Launch it with deploy/NEW-BRAND.md.`);
  } catch (err) {
    if (err instanceof Refusal) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
}

if (require.main === module) main();
