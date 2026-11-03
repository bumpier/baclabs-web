/**
 * Test suite for host routing: brands/hosts.json, lib/brand/resolve.ts and
 * the literals in middleware.ts and next.config.js that must agree with it.
 * Run with `npm run test:hosts`. Exits non-zero on any failure, like the
 * other tsx test scripts.
 */
import hosts from "@/brands/hosts.json";
import { allBrands, BRAND_IDS, brandFor, brandFromHost, DEFAULT_BRAND } from "@/brands/registry";
import {
  BRAND_HOSTS,
  BRAND_TREE_IDS,
  NOT_FOUND_PATH,
  brandHostPattern,
  brandIdForHost,
  brandRewrite,
} from "@/lib/brand/resolve";
import { config } from "../middleware";

type Cond = { type: string; value?: string };
// next.config.js is CommonJS and has no types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require("../next.config.js") as {
  redirects: () => Promise<{ source: string; has?: Cond[]; missing?: Cond[]; destination: string }[]>;
  headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>;
  allowedDevOrigins?: string[];
};

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const anchored = (body: string) => new RegExp(`^${body}$`);
const allHosts = Object.values(hosts).flat();
const notBrandHosts = [
  "baclab.co.uk",
  "www.baclab.co.uk",
  "mirror.example.com",
  "localhost",
  "127.0.0.1",
  "xbeauty.localhost",
  "beauty.localhost.example.com",
  "beautyxlocalhost",
];

// ── hosts.json and the registry agree.
const nonDefault = BRAND_IDS.filter((id) => id !== DEFAULT_BRAND);
check(
  "hosts.json lists exactly the registered brands but BacLab",
  JSON.stringify([...BRAND_TREE_IDS].sort()) === JSON.stringify([...nonDefault].sort()),
  `${BRAND_TREE_IDS.join(",")} vs ${nonDefault.join(",")}`
);
check("BacLab is not in hosts.json", !(DEFAULT_BRAND in BRAND_HOSTS));
for (const id of nonDefault) {
  const listed = BRAND_HOSTS[id] ?? [];
  check(`${id}: has a host`, listed.length > 0);
  check(`${id}: profile domains are its hosts.json entry`, JSON.stringify(brandFor(id).domains) === JSON.stringify(listed));
  check(`${id}: has a development host`, listed.includes(`${id}.localhost`));
  for (const h of listed) {
    check(`${h} is lower-case, no port or scheme`, /^[a-z0-9.-]+$/.test(h), h);
    check(`${h} resolves to ${id} (resolve.ts)`, brandIdForHost(h) === id);
    check(`${h}:3201 resolves to ${id}`, brandIdForHost(`${h.toUpperCase()}:3201`) === id);
    check(`${h} resolves to ${id} (registry)`, brandFromHost(h).id === id);
  }
}
check("every brand host belongs to one brand", new Set(allHosts).size === allHosts.length);
for (const h of notBrandHosts) {
  check(`${h} is BacLab`, brandIdForHost(h) === null && brandFromHost(h).id === DEFAULT_BRAND);
}
check("an empty host is BacLab", brandIdForHost("") === null && brandIdForHost(null) === null);
check("BacLab's own hosts are not brand hosts", brandFor(DEFAULT_BRAND).domains.every((d) => brandIdForHost(d) === null));
check("every registered brand but BacLab has a tree id", allBrands().every((b) => b.id === DEFAULT_BRAND || BRAND_TREE_IDS.includes(b.id)));

// ── The host pattern.
const pattern = anchored(brandHostPattern());
for (const h of allHosts) check(`pattern matches ${h}`, pattern.test(h));
for (const h of notBrandHosts) check(`pattern does not match ${h}`, !pattern.test(h));

// ── middleware.ts: Next reads its matcher statically, so the host regex and
// the brand-tree ids are literals there. They must be exactly these.
type Matcher = string | { source: string; has?: Cond[]; missing?: Cond[] };
const matchers = config.matcher as Matcher[];
const hostEntries = matchers.filter((m): m is Exclude<Matcher, string> => typeof m !== "string" && !!m.has);
check("middleware has one host-conditioned matcher", hostEntries.length === 1);
const hostEntry = hostEntries[0];
const hostCond = hostEntry?.has?.find((c) => c.type === "host");
check(
  "middleware host regex is brandHostPattern()",
  hostCond?.value === brandHostPattern(),
  `${hostCond?.value} vs ${brandHostPattern()}`
);
check("middleware host matcher covers every path but /_next and /api", hostEntry?.source === "/((?!_next/|api/).*)");
const treeEntry = matchers.find((m) => typeof m === "string" && m.startsWith("/(") && m.endsWith("/:path*"));
check(
  "middleware brand-tree matcher names every tree id",
  treeEntry === `/(${BRAND_TREE_IDS.join("|")})/:path*`,
  String(treeEntry)
);
for (const m of ["/admin/:path*", "/guides/:path*", "/blog/:path*"]) check(`middleware still matches ${m}`, matchers.includes(m));
// BacLab's funnel must not run middleware: no other unconditioned entry.
check(
  "no unconditioned catch-all matcher",
  matchers.every((m) => (typeof m === "string" ? !/^\/(\(\(\?!|:path\*|\(\.\*\))/.test(m) : !!m.has))
);

// ── The rewrite decision.
const cases: [host: string, path: string, expected: string | null][] = [
  // Brand hosts: every path into the brand's tree.
  ["beauty.localhost", "/", "/beauty"],
  ["beauty.localhost:3000", "/products/x", "/beauty/products/x"],
  ["BEAUTY.LOCALHOST", "/robots.txt", "/beauty/robots.txt"],
  ["gym.localhost", "/icon.svg", "/gym/icon.svg"],
  ["gym.localhost", "/sitemap.xml", "/gym/sitemap.xml"],
  ["wholesale.localhost", "/admin", "/wholesale/admin"],
  ["wholesale.localhost", "/admin/login", "/wholesale/admin/login"],
  ["luxury.localhost", "/guides/what-is-bacteriostatic-water", "/luxury/guides/what-is-bacteriostatic-water"],
  ["luxury.localhost", "/luxury", "/luxury/luxury"],
  ["luxury.localhost", "/beauty/x", "/luxury/beauty/x"],
  ["luxury.localhost", "/api", "/luxury/api"],
  // Shared on every host.
  ["beauty.localhost", "/_next/static/chunks/a.js", null],
  ["beauty.localhost", "/api/checkout", null],
  // BacLab: untouched, except a brand's tree asked for directly.
  ["baclab.co.uk", "/", null],
  ["baclab.co.uk", "/admin", null],
  ["baclab.co.uk", "/robots.txt", null],
  ["baclab.co.uk", "/beautyproducts", null],
  ["baclab.co.uk", "/beauty", NOT_FOUND_PATH],
  ["baclab.co.uk", "/beauty/", NOT_FOUND_PATH],
  ["baclab.co.uk", "/gym/robots.txt", NOT_FOUND_PATH],
  ["www.baclab.co.uk", "/wholesale/x/y", NOT_FOUND_PATH],
  ["mirror.example.com", "/luxury", NOT_FOUND_PATH],
  ["mirror.example.com", "/products", null],
  ["", "/", null],
];
for (const [host, path, expected] of cases) {
  const got = brandRewrite(host, path);
  check(`${host || "(no host)"}${path} -> ${expected}`, got === expected, String(got));
}
check("the not-found path is no brand's tree", brandRewrite("baclab.co.uk", NOT_FOUND_PATH) === null);

/** Does a CSP source expression (`https://host`, `http://host:*`) allow this origin? */
function cspAllows(source: string, origin: string): boolean {
  const m = /^(https?):\/\/([^:/]+)(?::(\d+|\*))?$/.exec(source);
  if (!m) return false;
  const o = new URL(origin);
  const port = m[3] ?? "";
  return `${m[1]}:` === o.protocol && m[2] === o.hostname && (port === "*" || port === o.port);
}

// ── next.config.js: every BacLab redirect stands down on brand hosts, a
// brand's www form (if it has one) goes to its apex, and the admin may load
// every brand's logo.
const run = async () => {
  const redirects = await nextConfig.redirects();
  const isBrandWww = (r: (typeof redirects)[number]) =>
    !!r.has?.some((c) => c.type === "host" && allHosts.some((h) => anchored(c.value ?? "").test(h)));
  const brandWww = redirects.filter(isBrandWww);
  for (const r of redirects.filter((r) => !isBrandWww(r))) {
    const missing = r.missing?.find((c) => c.type === "host");
    check(`redirect ${r.source} stands down on brand hosts`, missing?.value === brandHostPattern(), String(missing?.value));
  }
  const expectedWww = allHosts.filter((h) => h.startsWith("www.") && allHosts.includes(h.slice(4)));
  check("one www -> apex redirect per brand www host", brandWww.length === expectedWww.length, `${brandWww.length} vs ${expectedWww.length}`);
  check("dev origins allow *.localhost", nextConfig.allowedDevOrigins?.includes("*.localhost") === true);

  const headers = await nextConfig.headers();
  const cspOf = (source: string) =>
    headers.find((h) => h.source === source)?.headers.find((x) => x.key === "Content-Security-Policy")?.value ?? "";
  const imgSrcOf = (csp: string) =>
    (csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("img-src")) ?? "").split(/\s+/).slice(1);
  for (const source of ["/admin", "/admin/:path*"]) {
    const imgSrc = imgSrcOf(cspOf(source));
    for (const b of allBrands()) {
      if (b.id === DEFAULT_BRAND) continue;
      check(`${source} img-src allows ${b.origin}`, imgSrc.some((s) => cspAllows(s, b.origin)), imgSrc.join(" "));
    }
    check(`${source} img-src has no wildcard host`, !imgSrc.some((s) => s === "*" || /^https?:$/.test(s) || s.includes("//*")), imgSrc.join(" "));
  }
  const siteImgSrc = imgSrcOf(cspOf("/:path*"));
  check("the storefront img-src allows no brand", !allBrands().some((b) => b.id !== DEFAULT_BRAND && siteImgSrc.some((s) => cspAllows(s, b.origin))));
  const adminCsp = cspOf("/admin/:path*").replace(/img-src[^;]*/, "");
  check("the admin CSP is the storefront's but for img-src", adminCsp === cspOf("/:path*").replace(/img-src[^;]*/, ""));

  if (failures > 0) {
    console.error(`\n${failures} host check(s) failed.`);
    process.exit(1);
  }
  console.log("✓ hosts: all checks passed");
};
void run();
