/**
 * Create the warehouse SKUs the new brands' packs ship as: each brand's box,
 * and one kit per pack of N × the shared vial + 1 × that box
 * (lib/inventory/brand-skus.ts). Run once in the container before a brand
 * sells in warehouse mode, and again after a pack is added to a catalogue.
 *
 * Usage:
 *   npm run db:seed:brand-skus             # dry run: shows what it would create
 *   npm run db:seed:brand-skus -- --apply  # actually write
 *
 * Idempotent: it creates only what is missing and never changes a SKU that
 * exists. Reads DATABASE_URL from the environment, then .env.local, then
 * .env, and says which database it is about to touch before doing anything.
 * Boxes and packs start unmeasured: weigh them on /admin/inventory.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// tsx does not load .env files the way `next` does, so do it here, as
// scripts/stripe-setup.ts does. Real env wins.
function loadEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key!] !== undefined) continue;
    process.env[key!] = rawValue!.trim().replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Point it at the database to seed.");
    process.exit(1);
  }
  // Imported after the env is loaded: lib/db reads DATABASE_URL on import.
  const { prisma } = await import("@/lib/db");
  const { brandSkuSpecs, seedBrandSkus } = await import("@/lib/inventory/brand-skus");

  console.log("─".repeat(64));
  console.log(`  Database : ${process.env.DATABASE_URL}`);
  console.log(`  Action   : ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}`);
  console.log("─".repeat(64));
  for (const spec of brandSkuSpecs()) {
    console.log(`${spec.brand}: box ${spec.box.code}; packs ${spec.kits.map((k) => k.code).join(", ")}`);
  }

  try {
    const report = await seedBrandSkus(prisma, { apply: APPLY });
    console.log(`\n${APPLY ? "Created" : "Would create"}: ${report.created.length ? report.created.join(", ") : "nothing"}`);
    console.log(`Already there: ${report.existing.length ? report.existing.join(", ") : "nothing"}`);
    for (const w of report.warnings) console.log(`WARNING ${w}`);
    if (!APPLY) console.log("\nDry run complete. Re-run with --apply to write.");
    else if (report.created.length > 0) console.log("\nNew SKUs are unmeasured: weigh each box and pack on /admin/inventory.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nseed-brand-skus failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
