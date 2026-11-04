/**
 * The bundle guard: no brand's browser code can reach another brand's data.
 * Run with `npm run test:bundle`. Exits non-zero on any failure.
 *
 * A client component's imports are its JavaScript bundle. Import the brand
 * registry, a profile or config/ from one, even indirectly, and every
 * brand's name (or BacLab's prices and ids) ships in that brand's site. So,
 * following every value import to the files it reaches:
 *
 *  - the commerce kit: every file under components/commerce/ (client or
 *    not: any of them may be rendered in a client tree), and every client
 *    file ("use client" first) under lib/commerce/ and lib/brand/, must
 *    reach nothing under config/ or brands/, nothing of BacLab's tree
 *    (app/(baclab)/), and not components/consent/consent-store.ts, which
 *    inlines BacLab's GA4 id (the kit uses consent-core.ts);
 *  - each brand's own client files (app/<id>/**, brands/<id>/**) must reach
 *    nothing under config/, not the registry or brands/hosts.json, nothing
 *    of another brand's tree or folder, and nothing of BacLab's.
 *
 * Server files are exempt: lib/commerce/checkout.ts reads the registry by
 * design, and its imports never reach a browser. The marker for a client
 * file is the repo's own: a "use client" directive (there is no
 * server-only package here). Type-only imports are skipped, because
 * TypeScript erases them.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const BRAND_TREES = Object.keys(JSON.parse(readFileSync(path.join(ROOT, "brands/hosts.json"), "utf8")) as Record<string, string[]>);

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  failures++;
}

// ── Reading a module's imports ──────────────────────────────────────

/** "use client" as the first statement, after any comments. */
export function isClientModule(src: string): boolean {
  let s = src.trimStart();
  for (;;) {
    if (s.startsWith("//")) s = s.slice(s.indexOf("\n") + 1 || s.length).trimStart();
    else if (s.startsWith("/*")) s = s.slice(s.indexOf("*/") + 2).trimStart();
    else break;
  }
  return /^["']use client["']/.test(s);
}

/** Specifiers whose bindings are all `type`: erased, so not a dependency. */
function typeOnlyBraces(clause: string): boolean {
  const m = clause.trim().match(/^\{([\s\S]*)\}$/);
  if (!m) return false;
  const names = m[1]!.split(",").map((n) => n.trim()).filter(Boolean);
  return names.length > 0 && names.every((n) => n.startsWith("type "));
}

/** Every module a file depends on at run time: imports, re-exports, side-effect and dynamic imports. */
export function valueImports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:^|[\n;])\s*import\s+(type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']/g)) {
    if (m[1] || typeOnlyBraces(m[2]!)) continue;
    out.push(m[3]!);
  }
  for (const m of src.matchAll(/(?:^|[\n;])\s*export\s+(type\s+)?(\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g)) {
    if (m[1] || typeOnlyBraces(m[2]!)) continue;
    out.push(m[3]!);
  }
  for (const m of src.matchAll(/(?:^|[\n;])\s*import\s*["']([^"']+)["']/g)) out.push(m[1]!);
  for (const m of src.matchAll(/\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]!);
  return out;
}

interface Fs {
  read(file: string): string;
  isFile(file: string): boolean;
}

const realFs: Fs = {
  read: (f) => readFileSync(f, "utf8"),
  isFile: (f) => existsSync(f) && statSync(f).isFile(),
};

/** A specifier to a repo file, or null for a package (react, next/link). */
function resolve(spec: string, from: string, fs: Fs): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (fs.isFile(c)) return c;
  }
  // An unresolvable local import is the build's problem, not a leak; say so anyway.
  return `${base} (unresolved)`;
}

/**
 * The first forbidden file each root reaches, with the chain of imports
 * that leads there, or nothing. `banned` judges a repo-relative path.
 */
export function findLeaks(roots: string[], banned: (rel: string, root: string) => string | null, fs: Fs = realFs): string[] {
  const leaks: string[] = [];
  for (const root of roots) {
    const seen = new Set<string>([root]);
    const stack: { file: string; chain: string[] }[] = [{ file: root, chain: [path.relative(ROOT, root)] }];
    let found: string | null = null;
    while (stack.length && !found) {
      const { file, chain } = stack.pop()!;
      if (!/\.(tsx?|js)$/.test(file)) continue;
      for (const spec of valueImports(fs.read(file))) {
        const target = resolve(spec, file, fs);
        if (!target) continue;
        const rel = path.relative(ROOT, target);
        const why = banned(rel, root);
        if (why) {
          found = `${[...chain, rel].join(" → ")}: ${why}`;
          break;
        }
        if (target.endsWith("(unresolved)") || seen.has(target)) continue;
        seen.add(target);
        stack.push({ file: target, chain: [...chain, rel] });
      }
    }
    if (found) leaks.push(found);
  }
  return leaks;
}

// ── What each kind of root may not reach ────────────────────────────

const BACLAB_ONLY = [
  ["app/(baclab)/", "BacLab's own tree"],
  ["components/consent/consent-store.ts", "inlines BacLab's GA4 id; the kit uses consent-core.ts"],
] as const;

function kitBan(rel: string): string | null {
  if (rel.startsWith("config/")) return "config/ is BacLab's catalogue and identity";
  if (rel.startsWith("brands/")) return "brands/ holds every brand's profile";
  for (const [prefix, why] of BACLAB_ONLY) if (rel.startsWith(prefix)) return why;
  return null;
}

/** The brand a root belongs to, from its path: app/<id>/… or brands/<id>/…. */
function ownBrand(root: string): string {
  return path.relative(ROOT, root).split(path.sep)[1]!;
}

function brandTreeBan(rel: string, root: string): string | null {
  const own = ownBrand(root);
  if (rel.startsWith("config/")) return "config/ is BacLab's catalogue and identity";
  if (rel === "brands/registry.ts") return "the registry holds every brand's profile";
  if (rel === "brands/hosts.json") return "hosts.json lists every brand's hosts";
  for (const id of BRAND_TREES) {
    if (id === own) continue;
    if (rel.startsWith(`app/${id}/`) || rel.startsWith(`brands/${id}/`)) return `another brand's (${id}) files`;
  }
  for (const [prefix, why] of BACLAB_ONLY) if (rel.startsWith(prefix)) return why;
  return null;
}

// ── The guard works ─────────────────────────────────────────────────
// A small module graph in memory: the guard must find what it is meant to.
{
  const files: Record<string, string> = {
    [path.join(ROOT, "components/commerce/Good.tsx")]: `"use client";\nimport { useState } from "react";\nimport type { BrandProfile } from "@/brands/types";\nimport { type BrandId } from "@/brands/types";\nimport { helper } from "./helper";\n`,
    [path.join(ROOT, "components/commerce/helper.ts")]: `export const helper = 1;\n`,
    [path.join(ROOT, "components/commerce/Bad.tsx")]: `"use client";\nimport {\n  thing,\n} from "./middle";\n`,
    [path.join(ROOT, "components/commerce/middle.ts")]: `export { thing } from "@/lib/x";\n`,
    [path.join(ROOT, "lib/x.ts")]: `import { PRODUCT } from "@/config/funnel";\nexport const thing = PRODUCT;\n`,
    [path.join(ROOT, "config/funnel.ts")]: `export const PRODUCT = 1;\n`,
    [path.join(ROOT, "components/commerce/Lazy.tsx")]: `"use client";\nconst m = () => import("@/brands/registry");\n`,
    [path.join(ROOT, "brands/registry.ts")]: ``,
    [path.join(ROOT, "brands/types.ts")]: ``,
    [path.join(ROOT, "app/gym/Buy.tsx")]: `"use client";\nimport "@/app/luxury/x";\n`,
    [path.join(ROOT, "app/luxury/x.ts")]: ``,
    [path.join(ROOT, "app/gym/Own.tsx")]: `"use client";\nimport { a } from "@/app/gym/own-helper";\n`,
    [path.join(ROOT, "app/gym/own-helper.ts")]: `export const a = 1;\n`,
  };
  const memFs: Fs = { read: (f) => files[f] ?? "", isFile: (f) => f in files };
  const at = (rel: string) => path.join(ROOT, rel);
  check("a clean graph passes (type-only imports skipped)", findLeaks([at("components/commerce/Good.tsx")], kitBan, memFs).length === 0);
  const deep = findLeaks([at("components/commerce/Bad.tsx")], kitBan, memFs);
  check("a config import two hops away is caught, with its chain", deep.length === 1 && deep[0]!.includes("middle.ts → lib/x.ts → config/funnel.ts"), deep.join());
  check("a dynamic import of the registry is caught", findLeaks([at("components/commerce/Lazy.tsx")], kitBan, memFs).length === 1);
  check("a brand reaching another brand's tree is caught", findLeaks([at("app/gym/Buy.tsx")], brandTreeBan, memFs).length === 1);
  check("a brand's own files are fine", findLeaks([at("app/gym/Own.tsx")], brandTreeBan, memFs).length === 0);
  check("\"use client\" after a comment is a client file", isClientModule(`/* x */\n// y\n"use client";\n`));
  check("a file without it is not", !isClientModule(`import x from "y";\n"use client";\n`));
}

// ── The repo ────────────────────────────────────────────────────────

function filesUnder(rel: string): string[] {
  const dir = path.join(ROOT, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(path.join(rel, name));
    return /\.(tsx?|js)$/.test(name) ? [full] : [];
  });
}
const client = (files: string[]) => files.filter((f) => isClientModule(readFileSync(f, "utf8")));

const kitRoots = [...filesUnder("components/commerce"), ...client(filesUnder("lib/commerce")), ...client(filesUnder("lib/brand"))];
check("the kit has files to guard", filesUnder("components/commerce").length > 0);
for (const leak of findLeaks(kitRoots, kitBan)) check("commerce kit reaches a brand's or BacLab's data", false, leak);

const brandRoots = BRAND_TREES.flatMap((id) => client([...filesUnder(`app/${id}`), ...filesUnder(`brands/${id}`)]));
check("every brand tree has client files to guard", BRAND_TREES.every((id) => brandRoots.some((f) => f.includes(`${path.sep}app${path.sep}${id}${path.sep}`))));
for (const leak of findLeaks(brandRoots, brandTreeBan)) check("a brand's client code reaches another's data", false, leak);

if (failures > 0) {
  console.error(`\n${failures} bundle check(s) failed.`);
  process.exit(1);
}
console.log(`✓ bundle guard: ${kitRoots.length} kit files and ${brandRoots.length} brand client files reach no other brand's data`);
