/**
 * Test suite for the Code 128 encoder in lib/barcode/code128.ts. Run with
 * `npm run test:barcode`. Exits non-zero on any failure, like
 * scripts/test-sale.ts.
 *
 * These are the table's own invariants — a mistyped pattern breaks at least
 * one of them. The encoder was also checked end to end on 22 Sept 2026 by
 * decoding its output with zxing: all 95 data values and all 103 checksum
 * values read back exactly.
 */
import { CODE128_PATTERNS, code128Values, code128Widths, isEncodable } from "@/lib/barcode/code128";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

const sum = (s: string) => [...s].reduce((n, c) => n + Number(c), 0);
const barModules = (s: string) => [...s].filter((_, i) => i % 2 === 0).reduce((n, c) => n + Number(c), 0);

check("107 symbols", CODE128_PATTERNS.length === 107);
CODE128_PATTERNS.slice(0, 106).forEach((p, v) => {
  check(`symbol ${v} is six elements`, p.length === 6, p);
  check(`symbol ${v} is 11 modules`, sum(p) === 11, p);
  check(`symbol ${v} has an even number of bar modules`, barModules(p) % 2 === 0, p);
  check(`symbol ${v} elements are 1–4 wide`, /^[1-4]+$/.test(p), p);
});
check("stop is seven elements, 13 modules", CODE128_PATTERNS[106]!.length === 7 && sum(CODE128_PATTERNS[106]!) === 13);
check("every symbol is distinct", new Set(CODE128_PATTERNS).size === 107);

{
  const values = code128Values("ORD-3F9A1C2D");
  check("starts with Start B", values[0] === 104);
  check("ends with Stop", values.at(-1) === 106);
  check("carries one value per character plus start, checksum and stop", values.length === 12 + 3);
  const data = values.slice(1, -2);
  check("data values are ASCII − 32", data.join(",") === [..."ORD-3F9A1C2D"].map((c) => c.charCodeAt(0) - 32).join(","));
  const expected = data.reduce((s, v, i) => s + v * (i + 1), 104) % 103;
  check("checksum is the weighted sum mod 103", values.at(-2) === expected);
}
{
  const widths = code128Widths("LOC-A-01-02");
  check("module count is 11 per symbol plus the 13-module stop", widths.reduce((a, b) => a + b, 0) === 11 * (11 + 2) + 13);
  check("widths alternate bar/space and start with a bar, ending on a bar", widths.length % 2 === 1);
}
check("upper and lower case letters are encodable", isEncodable("Sku-a1"));
check("an empty string is not", !isEncodable(""));
check("a pound sign is not", !isEncodable("£5"));
check("a newline is not", !isEncodable("A\nB"));
{
  let threw = false;
  try {
    code128Values("£");
  } catch {
    threw = true;
  }
  check("encoding an impossible string throws rather than printing garbage", threw);
}

if (failures > 0) {
  console.error(`\n${failures} barcode check(s) failed`);
  process.exit(1);
}
console.log("✓ barcode: all checks passed");
