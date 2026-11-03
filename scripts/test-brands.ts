/**
 * Test suite for brands/registry.ts. Run with `npm run test:brands`.
 * Exits non-zero on any failure, like the other tsx test scripts.
 */
import { __registerTestBrand, allBrands, brandFor, brandFromHost, BRAND_IDS, DEFAULT_BRAND, isBrandId } from "@/brands/registry";
import { brand } from "@/config/brand";
import { LITERAL } from "@/lib/theme";
import { LIMITS } from "@/lib/smarttrack/payload";
import { registerTestBrand, TEST_BRAND_ID } from "./fixtures/test-brand";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

// BacLab is the default and wraps its existing config, so nothing moves.
const baclab = brandFor("baclab");
check("default brand is baclab", DEFAULT_BRAND === "baclab");
check("baclab is registered first", BRAND_IDS[0] === "baclab");
check("baclab name comes from config/brand.ts", baclab.name === brand.name);
check("baclab colours come from lib/theme.ts", baclab.colours.primary === LITERAL.primary);
check("baclab thank-you comes from config/brand.ts", baclab.packingSlipThankYou === brand.packingSlipThankYou);
check("baclab email header is the dark band", baclab.colours.header === LITERAL.abyss);
check("baclab contact inbox is the published address", baclab.email.inbox === brand.contact.published);
check("baclab review link comes from config/brand.ts", baclab.reviews.url === brand.reviews.url);
check("baclab sets no label sender of its own", !baclab.shipping?.senderCompany);
check("baclab sets no pixel of its own", !baclab.analytics?.metaPixelId);

// Rows written before the brand column, and junk values, read as BacLab.
check("null id is baclab", brandFor(null).id === "baclab");
check("undefined id is baclab", brandFor(undefined).id === "baclab");
check("unknown id is baclab", brandFor("nope").id === "baclab");
check("isBrandId rejects unknown", !isBrandId("nope") && !isBrandId(42));
check("isBrandId accepts baclab", isBrandId("baclab"));

// Hosts: port and case ignored; unknown hosts and mirrors stay BacLab.
check("baclab host", brandFromHost("baclab.co.uk").id === "baclab");
check("host with port and case", brandFromHost("WWW.BacLab.co.uk:443").id === "baclab");
check("unknown host is baclab", brandFromHost("mirror.example.com").id === "baclab");
check("empty host is baclab", brandFromHost("").id === "baclab" && brandFromHost(null).id === "baclab");

// A second brand, through the test-only hook: known to brandFor, the host
// map and allBrands, never to BRAND_IDS.
const fixture = registerTestBrand();
check("fixture resolves by id", brandFor(TEST_BRAND_ID) === fixture);
check("fixture resolves by its domain", brandFromHost("fixture.example").id === TEST_BRAND_ID);
check("fixture resolves by www, port and case", brandFromHost("WWW.Fixture.Example:8443").id === TEST_BRAND_ID);
check("fixture is not a real brand id", !isBrandId(TEST_BRAND_ID) && !(BRAND_IDS as readonly string[]).includes(TEST_BRAND_ID));
check("fixture is listed after BacLab", allBrands()[0]?.id === "baclab" && allBrands().some((b) => b.id === TEST_BRAND_ID));
check("baclab still resolves alongside it", brandFor("baclab").id === "baclab" && brandFromHost("baclab.co.uk").id === "baclab");
check("unknown ids still read as baclab", brandFor("nope").id === "baclab");
let refusedReal = false;
try {
  __registerTestBrand({ ...fixture, id: "baclab" });
} catch {
  refusedReal = true;
}
check("a real brand id cannot be registered as a fixture", refusedReal && brandFor("baclab").name === brand.name);
const env = process.env as Record<string, string | undefined>;
const nodeEnv = env.NODE_ENV;
env.NODE_ENV = "production";
let refusedProd = false;
try {
  __registerTestBrand({ ...fixture, id: "prodfixture" });
} catch {
  refusedProd = true;
}
env.NODE_ENV = nodeEnv;
check("fixtures are refused in production", refusedProd && brandFor("prodfixture").id === "baclab");

// Registry integrity, for every brand registered now or later.
const brands = allBrands();
const seenHosts = new Map<string, string>();
const seenCodes = new Map<string, string>();
for (const b of brands) {
  check(`${b.id}: id matches its registry key`, brandFor(b.id).id === b.id);
  check(`${b.id}: short code is two letters`, /^[A-Z]{2}$/.test(b.shortCode), b.shortCode);
  check(`${b.id}: origin has no trailing slash`, !b.origin.endsWith("/"), b.origin);
  check(`${b.id}: has a domain`, b.domains.length > 0);
  for (const d of b.domains) {
    check(`${b.id}: domain ${d} is lower-case with no port or scheme`, /^[a-z0-9.-]+$/.test(d), d);
    const owner = seenHosts.get(d);
    check(`domain ${d} belongs to one brand`, !owner || owner === b.id, `${owner} and ${b.id}`);
    seenHosts.set(d, b.id);
  }
  const codeOwner = seenCodes.get(b.shortCode);
  check(`short code ${b.shortCode} is unique`, !codeOwner, `${codeOwner} and ${b.id}`);
  seenCodes.set(b.shortCode, b.id);
  // SmartTrack refuses a longer sender company, and the label would not be bought.
  const sender = b.shipping?.senderCompany ?? "";
  check(`${b.id}: label sender fits SmartTrack`, sender.length <= LIMITS.senderCompany, sender);
  check(`${b.id}: pixel id, if set, is digits`, !b.analytics?.metaPixelId || /^[0-9]{8,20}$/.test(b.analytics.metaPixelId));
  check(`${b.id}: from-address has a mailbox`, /<[^@\s>]+@[^@\s>]+>$|^[^@\s]+@[^@\s]+$/.test(b.email.from), b.email.from);
  // Every non-default brand must resolve from its own domains.
  if (b.id !== DEFAULT_BRAND) {
    for (const d of b.domains) check(`${d} resolves to ${b.id}`, brandFromHost(d).id === b.id);
  }
}

if (failures > 0) {
  console.error(`\n${failures} brand check(s) failed.`);
  process.exit(1);
}
console.log("✓ brands: all checks passed");
