/**
 * Validates every guide in content/guides against content/guides/AUTHORING.md.
 * Run with `npm run check:guides`. Exits non-zero on any violation.
 *
 * The rules themselves live in lib/content-rules.ts, because the admin
 * publish action enforces the same ones. This script is now just the
 * TypeScript-baseline caller.
 */
import { GUIDES } from "@/content/guides";
import { checkCompliance, checkGuideStructure, guideProse } from "@/lib/content-rules";

const SLUGS = new Set(GUIDES.map((g) => g.slug));
let failures = 0;

for (const g of GUIDES) {
  const violations = [...checkCompliance(guideProse(g)), ...checkGuideStructure(g, SLUGS)];
  for (const v of violations) {
    console.error(`  ✗ ${g.slug}: ${JSON.stringify(v.match)} — ${v.why}`);
    failures++;
  }
}

const dupes = GUIDES.map((g) => g.slug).filter((s, i, a) => a.indexOf(s) !== i);
if (dupes.length) {
  console.error(`  ✗ index: duplicate slugs: ${dupes.join(", ")}`);
  failures++;
}

if (failures) {
  console.error(`\n${failures} violation(s) across ${GUIDES.length} guides.`);
  process.exit(1);
}
console.log(`✓ ${GUIDES.length} guides pass every rule in AUTHORING.md`);
