/**
 * Test suite for brands/registry.ts. Run with `npm run test:brands`.
 * Exits non-zero on any failure, like the other tsx test scripts.
 */
import { allBrands, brandFor, brandFromHost, BRAND_IDS, DEFAULT_BRAND, isBrandId } from "@/brands/registry";
import { brand } from "@/config/brand";
import { LITERAL } from "@/lib/theme";

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

// Registry integrity, for every brand registered now or later.
const brands = allBrands();
const seenHosts = new Map<string, string>();
const seenCodes = new Map<string, string>();
for (const b of brands) {
  check(`${b.id}: id matches its registry key`, isBrandId(b.id));
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
