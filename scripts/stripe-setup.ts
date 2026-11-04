/**
 * Create (or reconcile) the Stripe Products and Prices for every bundle tier
 * and every Lab Kit tier, and make sure the local inventory rows exist (the
 * vial, and the Lab Kit with its own stock count).
 *
 * Usage:
 *   npx tsx scripts/stripe-setup.ts            # dry run — shows what it would do
 *   npx tsx scripts/stripe-setup.ts --apply    # actually write
 *
 * Idempotent. Run it as often as you like; run it once against your test key
 * and again against your live key. It prints the STRIPE_PRICE_* lines to paste
 * into .env.local at the end.
 *
 * Reads STRIPE_SECRET_KEY and DATABASE_URL from .env.local (then .env).
 * Whether you are touching test or live data is decided ENTIRELY by which
 * secret key is loaded — the script says which one it found before doing
 * anything.
 *
 * Prices in Stripe are immutable. Changing a price in config/funnel.ts and
 * re-running therefore creates a NEW Price and archives the old one, which is
 * correct: existing sessions keep working, new ones use the new figure.
 *
 * Another brand (brands/<id>/catalogue.ts):
 *   npx tsx scripts/stripe-setup.ts --brand luxury            # dry run
 *   npx tsx scripts/stripe-setup.ts --brand luxury --apply    # write
 *
 * Creates or finds that brand's persistent Products, one per pack and
 * add-on, neutrally named, with the brand in their metadata, and prints the
 * STRIPE_PRODUCT__<ID> line to set. No Prices: the brand checkout prices
 * each line from the catalogue (price_data), so a price change needs no
 * re-run; a new pack does. Uses STRIPE_SECRET_KEY__<ID> when the brand has
 * a Stripe account of its own, else STRIPE_SECRET_KEY. Touches nothing of
 * BacLab's and no database row.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import {
  BUNDLES,
  KIT_PRICES,
  KIT_PRICE_ENV,
  LAB_KIT,
  PRODUCT,
  STARTER_KIT,
  STARTER_KIT_PRICE_ENV,
  VIAL_ML,
  formatMinor,
  CURRENCY,
  labKitContents,
  type KitTier,
} from "../config/funnel";
import { allBrands, brandFor } from "../brands/registry";
import { brandLineName, brandStripeProductId, defaultBrandProductStem } from "../lib/commerce/catalogue";

// ── env ───────────────────────────────────────────────────────────
// tsx does not load .env files the way `next` does, so do it here.
function loadEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue; // real env wins
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");

const APPLY = process.argv.includes("--apply");
// `--brand <id>`: that brand's Products instead of BacLab's (brandSetup).
const brandArg = process.argv.indexOf("--brand");
const BRAND = brandArg === -1 ? null : (process.argv[brandArg + 1] ?? "");
// A brand on a Stripe account of its own is set up in that account
// (lib/payments/stripe.ts stripeKeyFor); BacLab always uses the shared key.
const SECRET = (BRAND ? process.env[`STRIPE_SECRET_KEY__${BRAND.toUpperCase()}`] : undefined) || process.env.STRIPE_SECRET_KEY;

if (!SECRET) {
  console.error(
    "STRIPE_SECRET_KEY is not set.\n" +
      "Put a test key (sk_test_…) in .env.local, or pass it inline:\n" +
      "  STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/stripe-setup.ts --apply"
  );
  process.exit(1);
}

const IS_LIVE = !/^(sk|rk)_test_/.test(SECRET);
const stripe = new Stripe(SECRET, { apiVersion: "2026-07-29.dahlia" });
const prisma = new PrismaClient();

/** Deterministic Stripe product ids make this idempotent with no searching. */
const productIdFor = (bundleId: string) => `baclab_${bundleId}`;
const VIAL_SLUG = "baclab-10ml";

function banner() {
  const mode = IS_LIVE ? "LIVE — REAL MONEY" : "TEST";
  console.log("─".repeat(64));
  console.log(`  Stripe mode : ${mode}`);
  console.log(`  Key         : ${SECRET!.slice(0, 12)}…`);
  console.log(`  Action      : ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}`);
  if (BRAND !== null) console.log(`  Brand       : ${BRAND}`);
  console.log("─".repeat(64));
}

/**
 * Create a brand Product, or bring an existing one back in line with its
 * name, description and brand. "ok" when nothing needed changing.
 */
async function ensureBrandProduct(
  id: string,
  name: string,
  description: string,
  metadata: Record<string, string>
): Promise<"CREATE" | "UPDATE" | "ok"> {
  try {
    const existing = await stripe.products.retrieve(id);
    const current =
      existing.active &&
      existing.name === name &&
      (existing.description ?? "") === description &&
      Object.entries(metadata).every(([k, v]) => existing.metadata?.[k] === v);
    if (current) return "ok";
    if (APPLY) await stripe.products.update(id, { active: true, name, description, metadata });
    return "UPDATE";
  } catch (err) {
    if ((err as Stripe.errors.StripeError).code !== "resource_missing") throw err;
    if (APPLY) await stripe.products.create({ id, name, description, metadata });
    return "CREATE";
  }
}

/**
 * One brand's persistent Products: one per pack and add-on in its
 * catalogue, at `<stem>_<catalogue id>` (lib/commerce/catalogue.ts
 * brandStripeProductId), named exactly as the checkout names its lines.
 * Quote-only packs get theirs too, so making one available needs no re-run.
 */
async function brandSetup(id: string) {
  const b = brandFor(id);
  const catalogue = b.catalogue;
  if (b.id !== id || !catalogue) {
    const known = allBrands()
      .filter((x) => x.catalogue)
      .map((x) => x.id)
      .join(", ");
    console.error(`"${id}" is not a brand with a catalogue. Brands with one: ${known}.`);
    process.exitCode = 1;
    return;
  }

  const stem = defaultBrandProductStem(b.id);
  const kitDescription = LAB_KIT.parts.map((p) => `${p.perKit} × ${p.name}`).join(", ");
  const items = [
    ...catalogue.packs.map((p) => ({
      id: p.id,
      sku: p.sku,
      priceMinor: p.priceMinor,
      available: p.available,
      name: brandLineName({ kind: "pack", vials: p.vials }),
      description: `${p.vials} × ${PRODUCT.size}. ${PRODUCT.composition}`,
    })),
    ...catalogue.addOns.map((a) => ({
      id: a.id,
      sku: a.sku,
      priceMinor: a.priceMinor,
      available: a.available,
      name: brandLineName({ kind: "addOn", name: a.name }),
      description: a.ships === "lab-kit" ? kitDescription : "",
    })),
  ];

  for (const item of items) {
    const productId = brandStripeProductId(stem, item.id);
    const action = await ensureBrandProduct(productId, item.name, item.description, {
      brand: b.id,
      sku: item.sku,
      source: "scripts/stripe-setup.ts",
    });
    console.log(
      `${item.id.padEnd(9)} ${item.sku.padEnd(16)} ${formatMinor(item.priceMinor).padStart(9)}  ` +
        `product ${action.padEnd(6)}  ${productId}${item.available ? "" : "  (not available yet)"}`
    );
  }

  const envLine = `${catalogue.stripeProductEnv}=${stem}`;
  console.log("\n" + "─".repeat(64));
  if (APPLY) {
    console.log(`Set in the container's env (${IS_LIVE ? "LIVE" : "TEST"} account):\n`);
    console.log(envLine);
  } else {
    console.log(`Dry run complete. Re-run with --apply to write, then set:\n\n${envLine}`);
  }
  console.log("─".repeat(64));
}

async function ensureProduct(bundleId: string, name: string, description: string) {
  const id = productIdFor(bundleId);
  try {
    const existing = await stripe.products.retrieve(id);
    if (existing.active) return { product: existing, created: false };
    if (!APPLY) return { product: existing, created: false };
    const revived = await stripe.products.update(id, { active: true, name, description });
    return { product: revived, created: false };
  } catch (err) {
    if ((err as Stripe.errors.StripeError).code !== "resource_missing") throw err;
    if (!APPLY) return { product: null, created: true };
    const product = await stripe.products.create({
      id,
      name,
      description,
      metadata: { bundle_id: bundleId, source: "scripts/stripe-setup.ts" },
    });
    return { product, created: true };
  }
}

async function ensurePrice(productId: string, unitAmount: number, bundleId: string) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = prices.data.find(
    (p) => p.unit_amount === unitAmount && p.currency === CURRENCY.toLowerCase() && !p.recurring
  );
  if (match) return { price: match, created: false, archived: [] as string[] };

  if (!APPLY) return { price: null, created: true, archived: prices.data.map((p) => p.id) };

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: CURRENCY.toLowerCase(),
    metadata: { bundle_id: bundleId },
  });

  // Anything else still active for this product would be ambiguous. Archive it
  // so exactly one active Price exists per bundle.
  const archived: string[] = [];
  for (const stale of prices.data) {
    await stripe.prices.update(stale.id, { active: false });
    archived.push(stale.id);
  }
  return { price, created: true, archived };
}

async function main() {
  banner();

  if (IS_LIVE && !APPLY) {
    console.log("Live key detected. Nothing will be written without --apply.\n");
  }

  // Another brand: its Products only. Nothing of BacLab's below runs.
  if (BRAND !== null) return brandSetup(BRAND);

  const envLines: string[] = [];

  for (const b of BUNDLES) {
    const name = `${PRODUCT.name} — ${b.vials} × ${PRODUCT.size}`;
    const description = `${b.vials} × ${PRODUCT.size}. ${PRODUCT.composition}`;

    const { product, created: productCreated } = await ensureProduct(b.id, name, description);
    const productId = product?.id ?? productIdFor(b.id);

    let priceId = "(dry-run)";
    let priceCreated = false;
    let archived: string[] = [];
    if (product) {
      const r = await ensurePrice(productId, b.priceMinor, b.id);
      priceId = r.price?.id ?? "(dry-run)";
      priceCreated = r.created;
      archived = r.archived;
    } else {
      priceCreated = true;
    }

    console.log(
      `${b.id.padEnd(9)} ${String(b.vials).padStart(3)} vial(s)  ${formatMinor(b.priceMinor).padStart(8)}  ` +
        `product ${productCreated ? "CREATE" : "ok    "}  price ${priceCreated ? "CREATE" : "ok    "}  ${priceId}`
    );
    for (const a of archived) console.log(`${"".padEnd(8)}   archived stale price ${a}`);

    envLines.push(`STRIPE_PRICE_${b.id.toUpperCase()}=${priceId}`);
  }

  // ── Lab Kit: one Stripe Product per tier, since ensurePrice keeps exactly
  // one active Price per Product. All are named "Lab Kit" on Stripe's page.
  const kitDescription = LAB_KIT.parts.map((p) => `${p.perKit} × ${p.name}`).join(", ");
  for (const tier of Object.keys(KIT_PRICES) as KitTier[]) {
    const key = `lab_kit_${tier}`;
    const { product, created: productCreated } = await ensureProduct(key, LAB_KIT.name, kitDescription);
    let priceId = "(dry-run)";
    let priceCreated = true;
    let archived: string[] = [];
    if (product) {
      const r = await ensurePrice(product.id, KIT_PRICES[tier], key);
      priceId = r.price?.id ?? "(dry-run)";
      priceCreated = r.created;
      archived = r.archived;
    }
    console.log(
      `${`kit/${tier}`.padEnd(9)}   1 kit     ${formatMinor(KIT_PRICES[tier]).padStart(8)}  ` +
        `product ${productCreated ? "CREATE" : "ok    "}  price ${priceCreated ? "CREATE" : "ok    "}  ${priceId}`
    );
    for (const a of archived) console.log(`${"".padEnd(8)}   archived stale price ${a}`);
    envLines.push(`${KIT_PRICE_ENV[tier]}=${priceId}`);
  }

  // ── The Starter Kit: one vial and one Lab Kit, one Price for the pair.
  {
    const key = "starter_kit";
    const { product, created: productCreated } = await ensureProduct(
      key,
      STARTER_KIT.name,
      `1 × ${VIAL_ML}ml ${PRODUCT.name} and a ${LAB_KIT.name}: ${labKitContents()}.`
    );
    let priceId = "(dry-run)";
    let priceCreated = true;
    let archived: string[] = [];
    if (product) {
      const r = await ensurePrice(product.id, STARTER_KIT.priceMinor, key);
      priceId = r.price?.id ?? "(dry-run)";
      priceCreated = r.created;
      archived = r.archived;
    }
    console.log(
      `${"starter".padEnd(9)}   1 + kit   ${formatMinor(STARTER_KIT.priceMinor).padStart(8)}  ` +
        `product ${productCreated ? "CREATE" : "ok    "}  price ${priceCreated ? "CREATE" : "ok    "}  ${priceId}`
    );
    for (const a of archived) console.log(`${"".padEnd(8)}   archived stale price ${a}`);
    envLines.push(`${STARTER_KIT_PRICE_ENV}=${priceId}`);
  }

  // ── Local inventory row. Stock counts VIALS, not bundles.
  const existing = await prisma.product.findUnique({ where: { slug: VIAL_SLUG } });
  if (!APPLY) {
    console.log(
      `\nLocal product row "${VIAL_SLUG}": ${existing ? "exists — price would be synced" : "would be CREATED with stock 0"}`
    );
  } else {
    await prisma.product.upsert({
      where: { slug: VIAL_SLUG },
      // Never reset stock on a re-run — that is a number you manage in /admin.
      update: {
        name: `${PRODUCT.name} ${PRODUCT.size}`,
        description: `${PRODUCT.composition} ${PRODUCT.use}`,
        priceGbp: PRODUCT.unitPriceMinor / 100,
        active: true,
      },
      create: {
        slug: VIAL_SLUG,
        name: `${PRODUCT.name} ${PRODUCT.size}`,
        description: `${PRODUCT.composition} ${PRODUCT.use}`,
        priceGbp: PRODUCT.unitPriceMinor / 100,
        stock: 0, // set real stock in /admin
        weightGrams: 0, // weigh one vial, for postage
        active: true,
      },
    });
    console.log(
      `\nLocal product row "${VIAL_SLUG}": ${existing ? "updated" : "created"}` +
        (existing ? "" : " — stock is 0, set it in /admin before launch")
    );
  }

  // ── The Lab Kit's row. Stock counts KITS. supplyDays 0: the restock nudge
  // goes by the vials, never the kits.
  const kitExisting = await prisma.product.findUnique({ where: { slug: LAB_KIT.sku } });
  if (!APPLY) {
    console.log(`Local product row "${LAB_KIT.sku}": ${kitExisting ? "exists" : "would be CREATED with stock 0"}`);
  } else {
    const kitRow = {
      name: LAB_KIT.name,
      description: LAB_KIT.parts.map((p) => `${p.perKit} × ${p.name}`).join(", "),
      priceGbp: KIT_PRICES.single / 100,
      active: true,
    };
    await prisma.product.upsert({
      where: { slug: LAB_KIT.sku },
      update: kitRow,
      create: { ...kitRow, slug: LAB_KIT.sku, stock: 0, weightGrams: 0, supplyDays: 0 },
    });
    console.log(
      `Local product row "${LAB_KIT.sku}": ${kitExisting ? "updated" : "created — stock is 0 kits, set it in /admin/products when they arrive"}`
    );
  }

  console.log("\n" + "─".repeat(64));
  if (APPLY) {
    console.log(`Paste into .env.local (${IS_LIVE ? "LIVE" : "TEST"} values):\n`);
    console.log(envLines.join("\n"));
  } else {
    console.log("Dry run complete. Re-run with --apply to write.");
  }
  console.log("─".repeat(64));
}

main()
  .catch((err) => {
    console.error("\nstripe-setup failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
