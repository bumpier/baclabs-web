/**
 * Verifies the pack-page registry against the bundle list.
 *
 * The failure this guards against is SILENT. Add a tier to BUNDLES without a
 * matching entry in config/products.ts and nothing breaks: the tier simply has
 * no page, never enters the sitemap, and is unreachable and unindexed. Give
 * two entries the same `query` and nothing breaks either — you have just built
 * two pages that compete for one search instead of one that wins it.
 *
 * Run: npx tsx scripts/check-packs.ts
 */

import { BUNDLES, formatMinor, perVialMinor } from "../config/funnel";
import { fillTokens, metricsFor } from "../lib/pack-metrics";
import { PACK_PAGES, bundleForPack, packPath, packRegistryProblems } from "../config/products";

const problems = packRegistryProblems();

console.log(`Pack pages: ${PACK_PAGES.length} · bundles: ${BUNDLES.length}\n`);

for (const p of PACK_PAGES) {
  const b = bundleForPack(p);
  console.log(
    `  ${packPath(p).padEnd(52)} ${formatMinor(b.priceMinor).padStart(8)}  ` +
      `${formatMinor(perVialMinor(b)).padStart(7)}/vial  [${p.variant}]`
  );
}

/**
 * Render every FAQ with its tokens filled and flag anything that survived.
 *
 * A token the filler does not know is left in place on purpose, so it shows
 * up here as text rather than silently deleting a figure from a live page.
 */
for (const p of PACK_PAGES) {
  const m = metricsFor(bundleForPack(p));
  for (const f of p.faqs) {
    for (const text of [f.q, f.a]) {
      const filled = fillTokens(text, m);
      const left = filled.match(/\{\w+\}/g);
      if (left) {
        problems.push(`${p.slug}: unknown token(s) ${left.join(", ")} in "${text.slice(0, 60)}…"`);
      }
      // The classic off-by-one-unit: a token that already carries its unit,
      // followed by the same unit in the copy.
      const doubled = filled.match(/\d(ml ?ml|p ?p)\b/);
      if (doubled) {
        problems.push(`${p.slug}: doubled unit "${doubled[0]}" — check the token value.`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const msg of problems) console.error(`  ✗ ${msg}`);
  process.exit(1);
}

console.log("\n✓ Every bundle has exactly one page, and no two pages share a slug or a query.");
