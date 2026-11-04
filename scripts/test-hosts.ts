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
import { stripBrandPrefix } from "@/lib/brand/use-brand-pathname";
import { breadcrumbSchema, pageMetadata, siteOf } from "@/lib/seo";
import { organizationRef, returnPolicySchema } from "@/lib/product-schema";
import { legalName, supportEmail } from "@/lib/legal";
import { robotsTxt, sitemapXml, webManifest } from "@/lib/brand/site";
import { brand as baclabConfig } from "@/config/brand";
import { canonicalOrigin } from "@/lib/site-url";
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

// ── useBrandPathname(): the prerendered path and the browser's agree.
check("prefix stripped from a brand page", stripBrandPrefix("/beauty/products/x", "/beauty") === "/products/x");
check("brand home is /", stripBrandPrefix("/beauty", "/beauty") === "/");
check("browser path is unchanged", stripBrandPrefix("/products/x", "/beauty") === "/products/x");
check("a lookalike segment is unchanged", stripBrandPrefix("/beauty-tips", "/beauty") === "/beauty-tips");
check("no provider (BacLab) is usePathname()", stripBrandPrefix("/beauty/x", null) === "/beauty/x");

// ── Shared helpers: BacLab by default and unchanged; another brand's from its profile alone.
const baclabSite = siteOf();
check("siteOf() is BacLab's name and canonical origin", baclabSite.name === baclabConfig.name && baclabSite.origin === canonicalOrigin());
check(
  "breadcrumb defaults to BacLab",
  JSON.stringify(breadcrumbSchema("FAQ", "/faq")) === JSON.stringify(breadcrumbSchema("FAQ", "/faq", DEFAULT_BRAND))
);
check("pageMetadata defaults to BacLab", JSON.stringify(pageMetadata({ title: "T", description: "D", path: "/t" })).includes(`| ${baclabConfig.name}`));
check("legalName() is BacLab's", legalName() === (baclabConfig.company.legalName || baclabConfig.name));
check("supportEmail() is BacLab's", supportEmail() === (baclabConfig.contact.email || null));
for (const id of nonDefault) {
  const b = brandFor(id);
  const out = JSON.stringify([
    breadcrumbSchema("Page", "/page", id),
    pageMetadata({ title: "Page", description: "D", path: "/page", brandId: id }),
    organizationRef(id),
    returnPolicySchema(id),
    legalName(id),
    supportEmail(id),
    robotsTxt(b, true),
    sitemapXml(b, ["/", "/page"]),
    webManifest(b),
  ]);
  check(`${id}: helpers use its own origin`, out.includes(b.origin) && !out.includes(canonicalOrigin()));
  check(`${id}: helpers name it, not BacLab`, out.includes(b.name) && !/baclab/i.test(out), out.slice(0, 200));
  check(`${id}: robots.txt disallows everything until launch`, robotsTxt(b, false) === "User-agent: *\nDisallow: /\n");
}

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
  // The packing slip inlines another brand's logo as a data: URI
  // (lib/brand/logo.ts), so no header names a brand's domain: a CSP listing
  // them on baclab.co.uk would tie the brands together for anyone reading it.
  const siteCsp = cspOf("/:path*");
  const siteImgSrc = imgSrcOf(siteCsp);
  check("img-src allows data: (the slip's inlined logo)", siteImgSrc.includes("data:"), siteImgSrc.join(" "));
  check("img-src has no wildcard host", !siteImgSrc.some((s) => s === "*" || /^https?:$/.test(s) || s.includes("//*")), siteImgSrc.join(" "));
  check("the CSP allows no brand's origin", !allBrands().some((b) => b.id !== DEFAULT_BRAND && siteImgSrc.some((s) => cspAllows(s, b.origin))));
  const allHeaderValues = JSON.stringify(headers);
  for (const h of allHosts) check(`no header names ${h}`, !allHeaderValues.includes(h));
  for (const source of ["/admin", "/admin/:path*"]) {
    check(`${source} sets no CSP of its own (the site's applies)`, cspOf(source) === "");
    check(`${source} is noindex`, headers.find((x) => x.source === source)?.headers.some((x) => x.key === "X-Robots-Tag") === true);
  }

  if (failures > 0) {
    console.error(`\n${failures} host check(s) failed.`);
    process.exit(1);
  }
  console.log("✓ hosts: all checks passed");
};
void run();
