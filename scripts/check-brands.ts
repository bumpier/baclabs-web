/**
 * The brand registry's own check: `npm run check:brands`. For every
 * registered brand but BacLab (whose identity is config/brand.ts, held to its
 * own scripts), it fails, one line per problem, on anything that would break
 * the brand's site, its payments or its separation from the other brands:
 *
 *  - identity: its domains are its brands/hosts.json entry and nobody
 *    else's, its origin is on one of them, and its mailboxes are on its own
 *    domain, never another brand's;
 *  - payments: every provider it lists has an adapter, the statement
 *    descriptor is one a card statement prints as written (on Stripe, after
 *    the account's shortened descriptor, STRIPE_STATEMENT_PREFIX, which
 *    must itself be Stripe's 2 to 10 characters and never BacLab's name),
 *    a Stripe brand has its own PNG or JPG logo and icon for Stripe's page,
 *    and the label's sender name fits SmartTrack;
 *  - catalogue: the per-vial price falls as the packs grow, and every pack
 *    and box is a SKU that scripts/seed-brand-skus.ts creates, unique across
 *    the brands;
 *  - assets: its logo, its icon and every file its pages name are in
 *    public/<id>/, and next/image is never left on its default loader,
 *    which cannot fetch them (checkImages);
 *  - copy: every string a customer can see in brands/<id>/** and app/<id>/**
 *    (string literals, template text and JSX text, read with the TypeScript
 *    compiler, never comments) and in its profile passes its rules
 *    (lib/content-rules.ts brandRules);
 *  - leaks: none of those strings names another brand, its domains or its
 *    SKUs, or BacLab, except the internal codes in LEAK_ALLOW.
 *
 * It checks brands/_template/ too (checkTemplate): never registered or
 * routed, LIVE off, no payment provider, and placeholder copy that passes
 * every brand's rules and names no brand.
 *
 * A brand that has not launched runs on placeholders: development hosts,
 * .invalid mailboxes, empty legal details, TODO(launch) and TODO(confirm)
 * notes. Those are "not ready for launch" warnings, so the tree passes while
 * brands are being built. `--launch <id>` makes that brand's warnings
 * failures; deploy/NEW-BRAND.md runs it before the brand's LIVE flag is
 * turned on. A brand whose site.ts already says LIVE = true is always held
 * to it.
 *
 *   npm run check:brands
 *   npm run check:brands -- --launch luxury
 *
 * The rules are pure functions of a profile and the files it is built from,
 * so scripts/test-check-brands.ts proves that each one fires on a broken
 * fixture without touching a real brand.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import hostsJson from "@/brands/hosts.json";
import { brandFor, DEFAULT_BRAND, type BrandProfile } from "@/brands/registry";
import { BRAND_IDS, type BrandId } from "@/brands/types";
import { templateProfile } from "@/brands/_template/profile";
import { checkBrandCopy } from "@/lib/content-rules";
import { paymentAdapter } from "@/lib/commerce/payments";
import { STRIPE_STATEMENT_PREFIX } from "@/lib/commerce/payments/stripe";
import { BRAND_ICON_PATH } from "@/lib/brand/site";
import { brandSkuSpecs, type BrandSkuSpec } from "@/lib/inventory/brand-skus";
import { normaliseCode, skuCodeError } from "@/lib/inventory/codes";
import { LAB_KIT_SKU_CODE, VIAL_SKU_CODE } from "@/lib/inventory/demand";
import { LIMITS } from "@/lib/smarttrack/payload";

export type Level = "fail" | "warn";

export interface Finding {
  brand: string;
  /** "warn" is "not ready for launch": a failure only under --launch, or once the brand is live. */
  level: Level;
  message: string;
}

/** A string that can reach a customer, and where it came from. */
export interface CopyString {
  /** "app/luxury/page.tsx:12", "profile email.from", "seed LUX-BOX name". */
  where: string;
  text: string;
  /** Where it came from. The leak allow-list is scoped by it. */
  kind: "source" | "profile" | "seed" | "asset";
}

/** A file a page names: a static import, or a site path such as "/hero.jpg". */
export interface AssetRef {
  where: string;
  /** An import, resolved to a repo-relative path. */
  file?: string;
  /** A site path, served from the brand's public folder or one of its routes. */
  site?: string;
}

/** A TODO(launch) or TODO(confirm) note left in a brand's files. */
export interface LaunchNote {
  where: string;
  text: string;
}

/** What a brand's site is built from, read out of one file. */
export interface SourceFacts {
  strings: CopyString[];
  assets: AssetRef[];
  notes: LaunchNote[];
  /** site.ts only: the LIVE flag, or null if the file has none. */
  live?: boolean | null;
  /** Where it imports next/image without a loader of its own (checkImages). */
  defaultImageLoader?: string[];
}

/** Everything the checks need from outside the profile: the registry, as it is on disk. */
export interface Registry {
  /** brands/hosts.json: id -> hosts, for every brand but BacLab. */
  hosts: Readonly<Record<string, readonly string[]>>;
  /** Every registered brand, BacLab first. */
  brands: readonly BrandProfile[];
  /** What scripts/seed-brand-skus.ts creates (lib/inventory/brand-skus.ts). */
  seeded: readonly BrandSkuSpec[];
  hasAdapter(provider: string): boolean;
  /**
   * BacLab's Stripe account's shortened descriptor, as recorded in
   * lib/commerce/payments/stripe.ts STRIPE_STATEMENT_PREFIX. null or unset:
   * not recorded yet.
   */
  stripePrefix?: string | null;
}

// ── Hosts and mailboxes ─────────────────────────────────────────────

/**
 * Hosts no launched brand can be on: development hosts and the names
 * reserved for examples and tests (RFC 2606, RFC 6761). A profile on one of
 * these is a brand still being built, not a mistake.
 */
export function isPlaceholderHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || /\.(?:localhost|invalid|test|example)$/.test(h) || /(?:^|\.)example\.(?:com|net|org)$/.test(h);
}

/** Hosts that say nothing about which brand they belong to (BacLab's local fallback origin is one). */
function isGenericHost(host: string): boolean {
  return host === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || /(?:^|\.)example\.(?:com|net|org)$/.test(host);
}

/** The domain of `Name <box@domain>` or a bare `box@domain`, lower-cased; null if there is no mailbox. */
export function addressDomain(address: string): string | null {
  const m = /<([^<>\s]+)>\s*$/.exec(address) ?? /^\s*([^<>\s]+)\s*$/.exec(address);
  const box = m?.[1] ?? "";
  const at = box.lastIndexOf("@");
  return at > 0 && at < box.length - 1 ? box.slice(at + 1).toLowerCase() : null;
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Every host a brand is known by: its domains, its origin's host and its mailboxes' domains. */
function hostsOf(b: BrandProfile): string[] {
  const out = new Set(b.domains.map((d) => d.toLowerCase()));
  const own = originHost(b.origin);
  if (own) out.add(own);
  for (const a of [b.email.from, b.email.contact, b.email.inbox]) {
    const d = a ? addressDomain(a) : null;
    if (d) out.add(d);
  }
  return [...out].filter((h) => !isGenericHost(h));
}

/** `host` is `domain` or a subdomain of it ("send.aurelle.co.uk" is on "www.aurelle.co.uk"'s apex). */
function isOn(host: string, domain: string): boolean {
  const apex = domain.replace(/^www\./, "");
  return host === domain || host === apex || host.endsWith(`.${apex}`);
}

/** The other brand a host belongs to, if any. */
function ownerOf(host: string, brands: readonly BrandProfile[], self: string): BrandProfile | null {
  return brands.find((o) => o.id !== self && hostsOf(o).some((h) => isOn(host, h))) ?? null;
}

const HOST_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

function findings(brand: string) {
  const out: Finding[] = [];
  return {
    out,
    fail: (message: string) => out.push({ brand, level: "fail", message }),
    warn: (message: string) => out.push({ brand, level: "warn", message }),
  };
}

// ── The registry as a whole ─────────────────────────────────────────

/**
 * hosts.json lists the registered brands and nothing else. (A host that
 * belongs to two brands is each brand's own failure, in checkIdentity.)
 */
export function checkRegistry(reg: Registry): Finding[] {
  const { out, fail } = findings("registry");
  const ids = new Set<string>(reg.brands.map((b) => b.id));
  for (const id of Object.keys(reg.hosts)) {
    if (id === DEFAULT_BRAND) fail(`brands/hosts.json lists BacLab, which must stay off it (BacLab is every host that is not a brand's)`);
    else if (!ids.has(id)) fail(`brands/hosts.json lists "${id}", which is not a registered brand`);
  }
  // One prefix for the whole account, so it is checked once, here.
  const prefix = reg.stripePrefix;
  if (prefix) for (const problem of stripePrefixProblems(prefix)) fail(`STRIPE_STATEMENT_PREFIX "${prefix}" ${problem}`);
  return out;
}

// ── One brand ───────────────────────────────────────────────────────

/** Domains, origin and mailboxes. */
export function checkIdentity(b: BrandProfile, reg: Registry): Finding[] {
  const { out, fail, warn } = findings(b.id);
  const listed = reg.hosts[b.id];
  if (!listed) fail("is not in brands/hosts.json, so the host rewrite never serves it");
  else if (JSON.stringify(b.domains) !== JSON.stringify(listed)) {
    fail(`its profile's domains ${JSON.stringify(b.domains)} are not its brands/hosts.json entry ${JSON.stringify(listed)}`);
  }
  if (!b.domains.includes(`${b.id}.localhost`)) fail(`its domains have no development host (${b.id}.localhost)`);
  for (const d of b.domains) if (!HOST_NAME.test(d)) fail(`domain "${d}" is not a lower-case host name (no scheme, port or path)`);
  for (const d of b.domains) {
    const owner = ownerOf(d, reg.brands, b.id);
    if (owner) fail(`domain ${d} is ${owner.name}'s`);
  }
  const publicDomains = b.domains.filter((d) => !isPlaceholderHost(d));
  if (publicDomains.length === 0) warn(`has no public domain yet: brands/hosts.json lists only ${b.domains.join(", ")}`);

  const host = originHost(b.origin);
  if (!host) fail(`origin "${b.origin}" is not a URL`);
  else {
    const url = new URL(b.origin);
    if (`${url.protocol}//${url.host}` !== b.origin) fail(`origin "${b.origin}" must be a scheme and host only, with no path or trailing slash`);
    if (!b.domains.includes(host)) fail(`origin ${b.origin} is not on one of its domains`);
    if (url.protocol !== "https:" || isPlaceholderHost(host)) warn(`origin is ${b.origin}, a development origin: set the brand's https:// apex`);
  }

  const boxes: [field: string, value: string][] = [
    ["email.from", b.email.from],
    ["email.contact", b.email.contact],
    ["email.inbox", b.email.inbox],
  ];
  for (const [field, value] of boxes) {
    if (!value) {
      if (field === "email.from") fail("email.from is empty: the brand's emails have no sender");
      else if (field === "email.contact") warn("email.contact is empty: its emails and receipts give customers no address to write to");
      else warn("email.inbox is empty: its contact page publishes no address, and contact-form messages reach only /admin/messages unless CONTACT_FORM_TO is set");
      continue;
    }
    const domain = addressDomain(value);
    if (!domain) {
      fail(`${field} "${value}" has no mailbox`);
      continue;
    }
    const owner = ownerOf(domain, reg.brands, b.id);
    if (owner) fail(`${field} ${value} is on ${owner.name}'s domain`);
    else if (isPlaceholderHost(domain)) warn(`${field} ${value} is a placeholder mailbox: use one on the brand's own domain, verified in Resend`);
    else if (publicDomains.length === 0) warn(`${field} is on ${domain}, which brands/hosts.json does not list for the brand yet`);
    else if (!publicDomains.some((d) => isOn(domain, d))) fail(`${field} ${value} is not on the brand's own domain (${publicDomains.join(", ")})`);
  }

  if (!b.legalName) warn("legalName is empty: the legal pages must name the company that trades as the brand");
  if (!b.company?.number || !b.company.registeredAddress) {
    warn("company number and registered office are not set (Trading Disclosures Regulations 2008)");
  }
  return out;
}

/** The most a card statement shows of a descriptor, whichever provider sends it. */
export const STATEMENT_DESCRIPTOR_MAX = 22;

/**
 * Letters, digits, spaces, "." and "-": a set inside every provider's rules,
 * so whatever passes prints as written.
 *  - PayPal (checked 4 Nov 2026): the Orders v2 reference for
 *    soft_descriptor names no character set (its pattern is ^[\S\s]*$) and
 *    cuts anything past 22 characters. The one PayPal page that does name the
 *    characters, the classic API's SoftDescriptor, allows letters, digits,
 *    "-" and "." only, never "*", with spaces quoted. That Orders v2 takes the
 *    same set is our reading, not something PayPal states.
 *  - Stripe: at least one letter and none of < > \ ' " *, as brands/types.ts
 *    records it, so this set is inside its rules too.
 */
const DESCRIPTOR_CHARS = /^[A-Za-z0-9 .-]+$/;

/**
 * Why a statement descriptor cannot be used as it is; [] when it can.
 * Provider-neutral on purpose: a provider whose statement puts a prefix of
 * its own in front adds that rule (Stripe's is stripeDescriptorProblems).
 */
export function descriptorProblems(d: string): string[] {
  const out: string[] = [];
  if (d.length > STATEMENT_DESCRIPTOR_MAX) out.push(`is ${d.length} characters; a statement prints ${STATEMENT_DESCRIPTOR_MAX}`);
  if (!DESCRIPTOR_CHARS.test(d)) out.push(`may only use letters, digits, spaces, "." and "-"`);
  if (!/[A-Za-z]/.test(d)) out.push("needs at least one letter");
  if (d !== d.trim() || /\s{2}/.test(d)) out.push("has a leading, trailing or double space");
  return out;
}

/**
 * Stripe's rule for a card payment with a dynamic suffix, from
 * https://docs.stripe.com/get-started/account/statement-descriptors (read
 * 4 Nov 2026): the statement reads "<prefix>* <suffix>", the prefix being
 * the account's shortened descriptor, of 2 to 10 characters. The whole, "* "
 * included, must be 5 to 22 Latin characters, with at least one letter in
 * both the prefix and the suffix and none of < > \ ' " *. A brand's
 * statementDescriptor is the suffix; descriptorProblems already holds it to
 * the character rules, so what is left is the room the prefix leaves.
 */
export const STRIPE_PREFIX_MIN = 2;
export const STRIPE_PREFIX_MAX = 10;
const STRIPE_SEPARATOR = "* ";

/**
 * Why a shortened descriptor cannot be the account's prefix; [] when it
 * can. Never BacLab's name: it would be on every brand's statements.
 */
export function stripePrefixProblems(prefix: string): string[] {
  const out: string[] = [];
  if (prefix.length < STRIPE_PREFIX_MIN || prefix.length > STRIPE_PREFIX_MAX) {
    out.push(`is ${prefix.length} characters; Stripe's shortened descriptor is ${STRIPE_PREFIX_MIN} to ${STRIPE_PREFIX_MAX}`);
  }
  if (!DESCRIPTOR_CHARS.test(prefix)) out.push(`may only use letters, digits, spaces, "." and "-"`);
  if (!/[A-Za-z]/.test(prefix)) out.push("needs at least one letter");
  if (/bac\s*lab/i.test(prefix)) out.push("names BacLab, which would put BacLab on every brand's statements");
  return out;
}

/**
 * Why a descriptor will not print whole after Stripe's prefix; [] when it
 * will. `prefix` null: the account's is not recorded, so the longest Stripe
 * allows is assumed.
 */
export function stripeDescriptorProblems(suffix: string, prefix: string | null): string[] {
  const room = STATEMENT_DESCRIPTOR_MAX - (prefix?.length ?? STRIPE_PREFIX_MAX) - STRIPE_SEPARATOR.length;
  if (suffix.length <= room) return [];
  const full = `${prefix ?? "<prefix>"}${STRIPE_SEPARATOR}${suffix}`;
  return [
    prefix
      ? `prints on Stripe as "${full}", ${full.length} characters; Stripe allows ${STATEMENT_DESCRIPTOR_MAX} with the prefix, which leaves ${room} for it`
      : `is ${suffix.length} characters; after Stripe's longest prefix (${STRIPE_PREFIX_MAX}) and "${STRIPE_SEPARATOR}" there is room for ${room}`,
  ];
}

/** Payment providers, the statement descriptor and the label's sender. */
export function checkPayments(b: BrandProfile, reg: Registry): Finding[] {
  const { out, fail, warn } = findings(b.id);
  const providers: readonly string[] = b.paymentProviders ?? [];
  if (providers.length === 0) warn("takes no payment: paymentProviders is empty, so its site shows no checkout");
  if (new Set(providers).size !== providers.length) fail(`paymentProviders lists a provider twice: ${providers.join(", ")}`);
  for (const p of providers) if (!reg.hasAdapter(p)) fail(`payment provider "${p}" has no adapter in lib/commerce/payments`);
  const methods = b.payment?.methods ?? [];
  for (const m of methods) if (!providers.includes(m.id)) fail(`payment.methods describes "${m.id}", which paymentProviders does not list`);
  if (providers.length > 0) {
    const undescribed = providers.filter((p) => !methods.some((m) => m.id === p));
    if (undescribed.length > 0) warn(`its legal pages do not say how ${undescribed.join(" or ")} takes payment (payment.methods)`);
  }

  const d = b.statementDescriptor;
  if (d) for (const problem of descriptorProblems(d)) fail(`statementDescriptor "${d}" ${problem}`);
  else if (providers.length > 0) warn("has no statementDescriptor: statements show only the payment account's own descriptor");

  // Stripe: BacLab's own account, so its prefix and its page's images are
  // BacLab's unless the brand's own take their place.
  if (providers.includes("stripe")) {
    const prefix = reg.stripePrefix ?? null;
    if (d && descriptorProblems(d).length === 0) {
      const problems = stripeDescriptorProblems(d, prefix);
      // Known prefix: a hard rule. Unknown: a launch warning, with the worst case.
      for (const problem of problems) (prefix ? fail : warn)(`statementDescriptor "${d}" ${problem}`);
    }
    if (prefix === null) {
      warn(
        `Stripe prints "<prefix>* ${d ?? ""}", and the account's shortened descriptor is not recorded in STRIPE_STATEMENT_PREFIX (lib/commerce/payments/stripe.ts): set a neutral one in Stripe and record it there`
      );
    }
    if (!b.paymentPage?.logo || !b.paymentPage.icon) {
      warn("has no paymentPage.logo and .icon: Stripe's page shows the account's own, which are BacLab's");
    }
  }

  const sender = b.shipping?.senderCompany;
  if (!sender) warn("has no shipping.senderCompany: its carrier labels name the warehouse's company instead");
  else if (sender.length > LIMITS.senderCompany) {
    fail(`shipping.senderCompany "${sender}" is ${sender.length} characters; SmartTrack takes ${LIMITS.senderCompany}`);
  }
  return out;
}

const pence = (minor: number) => `£${(minor / 100).toFixed(2)}`;

/** Packs, prices and SKUs, against the seed and every other brand's codes. */
export function checkCatalogue(b: BrandProfile, reg: Registry): Finding[] {
  const { out, fail } = findings(b.id);
  const c = b.catalogue;
  if (!c) {
    fail("has no catalogue, so there is nothing to sell");
    return out;
  }
  if (c.packs.length === 0) fail("its catalogue lists no packs");

  const byVials = [...c.packs].sort((x, y) => x.vials - y.vials);
  for (let i = 1; i < byVials.length; i++) {
    const [smaller, bigger] = [byVials[i - 1]!, byVials[i]!];
    if (smaller.vials === bigger.vials) fail(`two packs hold ${bigger.vials} vials`);
    else if (bigger.priceMinor / bigger.vials >= smaller.priceMinor / smaller.vials) {
      fail(
        `the per-vial price does not fall from the ${smaller.vials}-pack (${pence(smaller.priceMinor / smaller.vials)}) to the ${bigger.vials}-pack (${pence(bigger.priceMinor / bigger.vials)})`
      );
    }
  }

  const codes = [c.boxSku, ...c.packs.map((p) => p.sku), ...c.addOns.map((a) => a.sku)];
  for (const code of codes) {
    if (normaliseCode(code) !== code) fail(`SKU "${code}" is not written as the warehouse stores it (${normaliseCode(code)})`);
    const problem = skuCodeError(normaliseCode(code));
    if (problem) fail(`SKU "${code}": ${problem}`);
  }
  if (new Set(codes.map(normaliseCode)).size !== codes.length) fail("its catalogue uses one SKU code twice");

  const spec = reg.seeded.find((s) => s.brand === b.id);
  if (!spec) fail("scripts/seed-brand-skus.ts seeds nothing for it");
  else {
    if (spec.box.code !== normaliseCode(c.boxSku)) fail(`the seed's box is ${spec.box.code}, not the catalogue's ${c.boxSku}`);
    for (const p of c.packs) {
      if (p.sku !== `${c.parentSku}-X${p.vials}`) fail(`pack ${p.sku} should be ${c.parentSku}-X${p.vials}`);
      if (!spec.kits.some((k) => k.code === normaliseCode(p.sku) && k.vials === p.vials)) {
        fail(`pack ${p.sku} is not a kit that scripts/seed-brand-skus.ts creates`);
      }
    }
  }

  for (const o of reg.brands) {
    if (o.id === b.id || !o.catalogue) continue;
    const theirs = new Set([o.catalogue.boxSku, ...o.catalogue.packs.map((p) => p.sku), ...o.catalogue.addOns.map((a) => a.sku)].map(normaliseCode));
    for (const code of codes) if (theirs.has(normaliseCode(code))) fail(`SKU ${code} is also ${o.name}'s`);
  }
  return out;
}

/** Where a brand's files live: app/<id> and public/<id> for a brand, its own folders for the template. */
export interface BrandRoots {
  app: string;
  public: string;
}

/** The logo, the icon and every file the brand's pages name exist. */
export function checkAssets(
  b: Pick<BrandProfile, "logo" | "paymentPage"> & { id: string },
  refs: readonly AssetRef[],
  roots: BrandRoots,
  exists: (repoPath: string) => boolean
): Finding[] {
  const { out, fail } = findings(b.id);
  const served = (site: string) =>
    exists(`${roots.public}${site}`) || ["route.ts", "route.tsx", "page.tsx"].some((f) => exists(`${roots.app}${site}/${f}`));
  if (!b.logo.startsWith("/")) fail(`logo "${b.logo}" is not a site path`);
  else if (!exists(`${roots.public}${b.logo}`)) fail(`logo ${b.logo} is not in ${roots.public}/`);
  if (!exists(`${roots.public}${BRAND_ICON_PATH}`)) fail(`${roots.public}${BRAND_ICON_PATH} is missing: every page's icon and the web manifest point at it`);
  // Stripe fetches these from the brand's origin, and takes PNG or JPG only.
  for (const [field, site] of [["paymentPage.logo", b.paymentPage?.logo], ["paymentPage.icon", b.paymentPage?.icon]] as const) {
    if (!site) continue;
    if (!/^\/[A-Za-z0-9._/-]+\.(?:png|jpe?g)$/.test(site)) fail(`${field} "${site}" must be a PNG or JPG site path: Stripe takes no SVG`);
    else if (!exists(`${roots.public}${site}`)) fail(`${field} ${site} is not in ${roots.public}/`);
  }
  for (const r of refs) {
    if (r.file && !exists(r.file)) fail(`${r.where} imports ${r.file}, which does not exist`);
    if (r.site && !served(r.site)) fail(`${r.where} names ${r.site}, which is neither in ${roots.public}/ nor a route of ${roots.app}/`);
  }
  return out;
}

/**
 * next/image only with a loader of the brand's own. The default one sends
 * every image through /_next/image, whose optimiser fetches the file from
 * this server without the brand's Host, so the host rewrite never maps it
 * to public/<id>/ and the image answers 400. deploy/NEW-BRAND.md "Images"
 * says what to do instead. `imports` is SourceFacts.defaultImageLoader.
 */
export function checkImages(brand: string, imports: readonly string[]): Finding[] {
  const { out, fail } = findings(brand);
  for (const where of imports) {
    fail(`${where} uses next/image with its default loader, which cannot fetch the brand's images (/_next/image answers 400): give it a loader over widths made ahead, or unoptimized (deploy/NEW-BRAND.md "Images")`);
  }
  return out;
}

// ── Reading a brand's files ─────────────────────────────────────────

/** JSX attributes that hold code, never words a customer reads. */
const NOT_COPY_ATTRIBUTES = new Set(["className", "key", "id", "htmlFor", "rel", "target", "type", "role", "name", "method", "dateTime"]);
/** A site path to a file the browser fetches: served from public/<id>/ through the host rewrite. */
const SITE_FILE = /^\/[A-Za-z0-9._/-]+\.(?:svg|png|jpe?g|webp|avif|gif|ico|pdf|txt|xml|json|webmanifest|woff2?|mp4|webm)$/;
const ASSET_IMPORT = /\.(?:svg|png|jpe?g|webp|avif|gif|ico|css|woff2?)$/;
const NOTE = /TODO\((launch|confirm)\):?\s*(.*)/;
const NEXT_IMAGE = /^next\/(?:legacy\/)?image$/;
/** A prop or option that takes next/image off its default loader. */
const OWN_LOADER = /^(?:loader|unoptimized)$/;

function cssFacts(file: string, text: string): SourceFacts {
  const strings: CopyString[] = [];
  const notes: LaunchNote[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const m = NOTE.exec(line);
    if (m) notes.push({ where: `${file}:${i + 1}`, text: `TODO(${m[1]}): ${m[2]!.replace(/\*\/\s*$/, "").trim()}` });
  });
  // Comments blanked, not removed, so the line numbers still hold.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  for (const m of code.matchAll(/\bcontent\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const line = code.slice(0, m.index).split("\n").length;
    if (m[2]!.trim()) strings.push({ where: `${file}:${line}`, text: m[2]!, kind: "source" });
  }
  return { strings, assets: [], notes };
}

/**
 * The customer-facing strings of one TypeScript or TSX file, read with the
 * compiler rather than by pattern, so a comment is never mistaken for copy
 * and copy is never missed for sitting in a template or in JSX. Left out as
 * code, not words: module specifiers, type positions, directives ("use
 * client"), object keys, element-access keys, and the JSX attributes in
 * NOT_COPY_ATTRIBUTES. Also the files it imports, the site paths it names,
 * its TODO(launch) and TODO(confirm) notes, for site.ts its LIVE flag, and
 * its next/image imports when nothing in the file (a `loader` or
 * `unoptimized` prop or option, comments aside) takes it off the default
 * loader.
 */
export function sourceFacts(file: string, text: string): SourceFacts {
  if (file.endsWith(".css")) return cssFacts(file, text);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const strings: CopyString[] = [];
  const assets: AssetRef[] = [];
  const at = (node: ts.Node) => `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
  const push = (node: ts.Node, raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t) return;
    strings.push({ where: at(node), text: t, kind: "source" });
    if (SITE_FILE.test(t)) assets.push({ where: at(node), site: t });
  };
  const resolveImport = (spec: string): string | null => {
    if (spec.startsWith("@/")) return spec.slice(2);
    if (spec.startsWith(".")) return path.posix.join(path.posix.dirname(file), spec);
    return null;
  };

  let live: boolean | null = null;
  const liveCommentLines = new Set<number>();
  const imageImports: string[] = [];
  let ownLoader = false;

  const visit = (node: ts.Node): void => {
    if ((ts.isJsxAttribute(node) || ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && OWN_LOADER.test(node.name.getText(sf))) ownLoader = true;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier;
      if (spec && ts.isStringLiteral(spec) && ASSET_IMPORT.test(spec.text)) {
        const resolved = resolveImport(spec.text);
        if (resolved) assets.push({ where: at(node), file: resolved });
      }
      if (spec && ts.isStringLiteral(spec) && NEXT_IMAGE.test(spec.text)) imageImports.push(at(node));
      if (ts.isExportDeclaration(node) && node.exportClause) visit(node.exportClause);
      return;
    }
    if (ts.isImportEqualsDeclaration(node) || ts.isTypeNode(node)) return;
    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression)) return;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) return;
    if (ts.isVariableStatement(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === "LIVE" && d.initializer) {
          live = d.initializer.kind === ts.SyntaxKind.TrueKeyword ? true : d.initializer.kind === ts.SyntaxKind.FalseKeyword ? false : null;
          // The LIVE flag's own TODO is the step this check gates, not a note left behind.
          for (const r of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
            const [from, to] = [sf.getLineAndCharacterOfPosition(r.pos).line, sf.getLineAndCharacterOfPosition(r.end).line];
            for (let l = from; l <= to; l++) liveCommentLines.add(l);
          }
        }
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
      if (key !== "className") visit(node.initializer);
      return;
    }
    if (ts.isElementAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (!NOT_COPY_ATTRIBUTES.has(name) && node.initializer) visit(node.initializer);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) push(node, node.text);
    else if (ts.isTemplateExpression(node)) {
      push(node.head, node.head.text);
      for (const span of node.templateSpans) {
        visit(span.expression);
        push(span.literal, span.literal.text);
      }
      return;
    } else if (ts.isJsxText(node)) push(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const notes: LaunchNote[] = [];
  text.split("\n").forEach((line, i) => {
    const m = NOTE.exec(line);
    if (m && !liveCommentLines.has(i)) notes.push({ where: `${file}:${i + 1}`, text: `TODO(${m[1]}): ${m[2]!.trim()}` });
  });
  const defaultImageLoader = ownLoader ? [] : imageImports;
  return path.posix.basename(file) === "site.ts" ? { strings, assets, notes, live, defaultImageLoader } : { strings, assets, notes, defaultImageLoader };
}

/** Every string in a profile, catalogue included: names, mailboxes, legal and payment words, pack labels. */
export function profileStrings(b: BrandProfile): CopyString[] {
  const out: CopyString[] = [];
  const walk = (v: unknown, at: string): void => {
    if (typeof v === "string") {
      if (v.trim()) out.push({ where: `profile ${at}`, text: v, kind: "profile" });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, at ? `${at}.${k}` : k);
  };
  walk(b, "");
  return out;
}

/** The warehouse SKUs seeded for a brand. Kit names reach carrier labels and customs forms. */
export function seedStrings(spec: BrandSkuSpec): CopyString[] {
  const s = (where: string, text: string): CopyString => ({ where: `seed ${where}`, text, kind: "seed" });
  return [
    s(`${spec.box.code} code`, spec.box.code),
    s(`${spec.box.code} name`, spec.box.name),
    s(`${spec.box.code} description`, spec.box.description),
    ...spec.kits.flatMap((k) => [s(`${k.code} code`, k.code), s(`${k.code} name`, k.name), s(`${k.code} description`, k.description)]),
    ...spec.needs.map((n) => s("needs", n)),
  ];
}

// ── Copy and leaks ──────────────────────────────────────────────────

/** Every string against one brand's copy rules. */
export function checkCopy(brand: string, rulesFor: BrandId, strings: readonly CopyString[]): Finding[] {
  const { out, fail } = findings(brand);
  for (const s of strings) {
    for (const v of checkBrandCopy(rulesFor, s.text, s.where)) {
      fail(`${v.field}: "${v.match}" breaks ${rulesFor}'s copy rules (${v.why}) in ${JSON.stringify(s.text.length > 90 ? `${s.text.slice(0, 87)}...` : s.text)}`);
    }
  }
  return out;
}

/** Something that must not appear in a brand's strings, and whose it is. */
export interface LeakMarker {
  re: RegExp;
  what: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every other brand's public name, hosts, mailbox domains and SKU stems, and
 * anything of BacLab's. A brand's id is not a marker: the ids are ordinary
 * words ("beauty", "wholesale"), never shown as a brand.
 */
export function leakMarkers(self: string, brands: readonly BrandProfile[]): LeakMarker[] {
  const BACLAB = /baclab/i;
  const out: LeakMarker[] = [{ re: BACLAB, what: "BacLab" }];
  for (const o of brands) {
    if (o.id === self) continue;
    // BacLab's name and domains are caught by the one marker above already.
    const caught = (s: string) => o.id === DEFAULT_BRAND && BACLAB.test(s);
    if (o.name.trim() && !caught(o.name)) {
      out.push({ re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(o.name)}(?![\\p{L}\\p{N}])`, "iu"), what: `${o.name}'s name` });
    }
    for (const h of hostsOf(o)) {
      if (!caught(h)) out.push({ re: new RegExp(`(?<![a-z0-9-])${escapeRegex(h)}(?![a-z0-9-])`, "i"), what: `${o.name}'s host ${h}` });
    }
    if (o.catalogue) {
      for (const code of [o.catalogue.parentSku, o.catalogue.boxSku]) out.push({ re: new RegExp(escapeRegex(code), "i"), what: `${o.name}'s SKU ${code}` });
    }
  }
  return out;
}

/**
 * Internal identifiers that may appear where a marker would otherwise
 * catch them, each with the only kind of string it may appear in and why it
 * never reaches a customer there.
 */
export const LEAK_ALLOW: readonly { token: string; in: CopyString["kind"]; reason: string }[] = [
  {
    token: VIAL_SKU_CODE,
    in: "seed",
    reason: "the shared vial's warehouse code, named in each kit's description for staff (pick list, /admin/inventory); never on a page, email or label",
  },
  {
    token: LAB_KIT_SKU_CODE,
    in: "seed",
    reason: "the Lab Kit's warehouse code, which a brand's Lab Kit add-on ships as; staff only",
  },
];

/** No string names another brand or BacLab, bar LEAK_ALLOW's tokens where they are allowed. */
export function checkLeaks(brand: string, strings: readonly CopyString[], markers: readonly LeakMarker[]): Finding[] {
  const { out, fail } = findings(brand);
  for (const s of strings) {
    let text = s.text;
    for (const a of LEAK_ALLOW) if (a.in === s.kind) text = text.split(a.token).join("·");
    const named = markers.filter((m) => m.re.test(text)).map((m) => m.what);
    if (named.length > 0) fail(`${s.where}: names ${named.join(", ")} in ${JSON.stringify(s.text.length > 90 ? `${s.text.slice(0, 87)}...` : s.text)}`);
  }
  return out;
}

/** TODO notes, as launch warnings. */
export function checkNotes(brand: string, notes: readonly LaunchNote[]): Finding[] {
  return notes.map((n) => ({ brand, level: "warn" as const, message: `${n.where}: ${n.text}` }));
}

// ── The whole tree ──────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");

/** Every file under a repo-relative folder, as repo-relative paths with "/". */
function filesUnder(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const child = `${rel}/${name}`;
    return statSync(path.join(ROOT, child)).isDirectory() ? filesUnder(child) : [child];
  });
}

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const existsInRepo = (rel: string) => existsSync(path.join(ROOT, rel));

/**
 * The registry as it is on disk: the registered brands (BRAND_IDS), never a
 * fixture a test script has registered beside them.
 */
export function diskRegistry(): Registry {
  const brands = BRAND_IDS.map((id) => brandFor(id));
  return {
    hosts: hostsJson as Record<string, readonly string[]>,
    brands,
    seeded: brandSkuSpecs(brands),
    hasAdapter: (p) => paymentAdapter(p) !== null,
    stripePrefix: STRIPE_STATEMENT_PREFIX,
  };
}

/**
 * Everything a brand's files say, read from its folders. `siteFile` is its
 * site.ts, which holds the LIVE flag.
 */
export function readBrandFiles(
  folders: readonly string[],
  siteFile: string
): SourceFacts & { live: boolean | null; siteFound: boolean; defaultImageLoader: string[] } {
  const facts = {
    strings: [] as CopyString[],
    assets: [] as AssetRef[],
    notes: [] as LaunchNote[],
    live: null as boolean | null,
    siteFound: false,
    defaultImageLoader: [] as string[],
  };
  for (const folder of folders) {
    for (const file of filesUnder(folder)) {
      if (/\.(?:tsx?|css)$/.test(file)) {
        const f = sourceFacts(file, read(file));
        facts.strings.push(...f.strings);
        facts.assets.push(...f.assets);
        facts.notes.push(...f.notes);
        facts.defaultImageLoader.push(...(f.defaultImageLoader ?? []));
        if (file === siteFile) {
          facts.siteFound = true;
          facts.live = f.live ?? null;
        }
      } else if (file.endsWith(".svg")) {
        facts.strings.push({ where: file, text: read(file), kind: "asset" });
      }
    }
  }
  return facts;
}

export interface BrandReport {
  id: string;
  name: string;
  live: boolean;
  findings: Finding[];
}

/** Every check for every registered brand but BacLab. */
export function runChecks(reg: Registry = diskRegistry()): { registry: Finding[]; brands: BrandReport[]; template: Finding[] } {
  const reports: BrandReport[] = [];
  for (const b of reg.brands) {
    if (b.id === DEFAULT_BRAND) continue;
    const files = readBrandFiles([`brands/${b.id}`, `app/${b.id}`, `public/${b.id}`], `app/${b.id}/site.ts`);
    const strings = [...files.strings, ...profileStrings(b)];
    const spec = reg.seeded.find((s) => s.brand === b.id);
    const out: Finding[] = [
      ...checkIdentity(b, reg),
      ...checkPayments(b, reg),
      ...checkCatalogue(b, reg),
      ...checkAssets(b, files.assets, { app: `app/${b.id}`, public: `public/${b.id}` }, existsInRepo),
      ...checkImages(b.id, files.defaultImageLoader),
      ...checkCopy(b.id, b.id, strings.filter((s) => s.kind !== "asset")),
      ...checkLeaks(b.id, [...strings, ...(spec ? seedStrings(spec) : [])], leakMarkers(b.id, reg.brands)),
      ...checkNotes(b.id, files.notes),
    ];
    if (!files.siteFound) out.push({ brand: b.id, level: "fail", message: `app/${b.id}/site.ts is missing or has no exported LIVE flag` });
    else if (files.live === null) out.push({ brand: b.id, level: "fail", message: `app/${b.id}/site.ts: LIVE must be the literal true or false` });
    reports.push({ id: b.id, name: b.name, live: files.live === true, findings: out });
  }
  return { registry: checkRegistry(reg), brands: reports, template: checkTemplate(reg) };
}

// ── The template ────────────────────────────────────────────────────

/** brands/_template/, which scripts/new-brand.ts copies: profile and catalogue at the top, app/ and public/ inside. */
export const TEMPLATE = {
  // A string, not a literal: it is never a BrandId, which is what the checks below make sure of.
  id: "_template" as string,
  dir: "brands/_template",
  app: "brands/_template/app",
  public: "brands/_template/public",
  site: "brands/_template/app/site.ts",
} as const;

/**
 * The template is never a brand (not registered, routed or scanned by
 * BacLab's Tailwind), starts with LIVE = false and no payment provider, and
 * its placeholder copy passes EVERY brand's rules and names no brand at all,
 * so whatever brand is made from it starts clean. Its TODO notes are not
 * reported: they are there to be copied.
 */
export function checkTemplate(reg: Registry): Finding[] {
  const { out, fail } = findings(TEMPLATE.id);
  if (TEMPLATE.id in reg.hosts) fail("brands/hosts.json lists the template: it must never be routed");
  if (reg.brands.some((b) => b.id === TEMPLATE.id)) fail("the template is registered: it must never be a brand");
  for (const p of [`app/${TEMPLATE.id}`, `public/${TEMPLATE.id}`]) if (existsInRepo(p)) fail(`${p} exists: the template is never routed or served`);
  if (!/^@source not "\.\.\/brands";$/m.test(read("app/globals.css"))) {
    fail(`app/globals.css has lost @source not "../brands": BacLab's stylesheet would scan the brands and the template`);
  }

  const t = templateProfile();
  if (t.id !== TEMPLATE.id) fail(`the template's profile id is "${t.id}", not "${TEMPLATE.id}" (scripts/new-brand.ts replaces exactly that)`);
  if ((t.paymentProviders ?? []).length > 0) fail("the template must take no payment: its paymentProviders stays []");
  const files = readBrandFiles([TEMPLATE.dir], TEMPLATE.site);
  if (!files.siteFound || files.live !== false) fail(`${TEMPLATE.site} must start with LIVE = false`);

  const strings = [...files.strings, ...profileStrings(t)];
  for (const id of BRAND_IDS) out.push(...checkCopy(TEMPLATE.id, id, strings.filter((s) => s.kind !== "asset")));
  const seeded = brandSkuSpecs([t]);
  out.push(...checkLeaks(TEMPLATE.id, [...strings, ...seeded.flatMap(seedStrings)], leakMarkers(TEMPLATE.id, reg.brands)));
  out.push(...checkCatalogue(t, { ...reg, brands: [...reg.brands, t], seeded }));
  out.push(...checkPayments(t, reg).filter((f) => f.level === "fail"));
  out.push(...checkAssets(t, files.assets, { app: TEMPLATE.app, public: TEMPLATE.public }, existsInRepo));
  out.push(...checkImages(TEMPLATE.id, files.defaultImageLoader));
  return out;
}

/** A brand's warnings count as failures once it launches: on --launch, or when its LIVE flag is on. */
export function failuresOf(report: BrandReport, launching: ReadonlySet<string>): Finding[] {
  const strict = report.live || launching.has(report.id);
  return report.findings.filter((f) => f.level === "fail" || strict);
}

function main() {
  const args = process.argv.slice(2);
  const launching = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--launch" && args[i + 1]) launching.add(args[++i]!);
    else if (arg.startsWith("--launch=")) launching.add(arg.slice("--launch=".length));
    else {
      console.error(`Unknown argument "${arg}". Usage: npm run check:brands [-- --launch <id>]`);
      process.exit(2);
    }
  }
  const reg = diskRegistry();
  const ids = reg.brands.filter((b) => b.id !== DEFAULT_BRAND).map((b) => b.id);
  for (const id of launching) {
    if (!ids.includes(id as BrandId)) {
      console.error(`--launch ${id}: not a registered brand. Registered: ${ids.join(", ")}.`);
      process.exit(2);
    }
  }

  const { registry, brands, template } = runChecks(reg);
  const failed: Finding[] = [...registry, ...template];
  for (const r of brands) failed.push(...failuresOf(r, launching));
  for (const f of failed) console.error(`  ✗ ${f.brand}: ${f.message}`);

  const pending = brands.filter((r) => !r.live && !launching.has(r.id) && r.findings.some((f) => f.level === "warn"));
  if (pending.length > 0) {
    console.log("Not ready for launch (warnings; `npm run check:brands -- --launch <id>` makes them failures):");
    for (const r of pending) {
      const warns = r.findings.filter((f) => f.level === "warn");
      console.log(`  ${r.id} (${r.name}), ${warns.length}:`);
      for (const w of warns) console.log(`    - ${w.message}`);
    }
  }
  for (const r of brands.filter((r) => r.live || launching.has(r.id))) {
    const n = failuresOf(r, launching).length;
    console.log(`${n === 0 ? "✓" : "✗"} ${r.id}: ${n === 0 ? "ready for launch" : `${n} problem(s) before launch`}${r.live ? " (LIVE is on)" : ""}`);
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} brand check(s) failed.`);
    process.exit(1);
  }
  console.log(`✓ brands: ${brands.length} brand(s) and the template checked, BacLab apart (its own scripts check it)`);
}

if (require.main === module) main();
