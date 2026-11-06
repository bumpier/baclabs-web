import type { Prisma, PrismaClient } from "@prisma/client";
import { PLAIN_BOX_SKU } from "@/brands/packaging";
import { allBrands, type BrandProfile } from "@/brands/registry";
import { PRODUCT } from "@/config/funnel";
import { normaliseCode, skuCodeError } from "@/lib/inventory/codes";
import { LAB_KIT_SKU_CODE, VIAL_SKU_CODE } from "@/lib/inventory/demand";

/**
 * The warehouse SKUs another brand's packs ship as (brands/<id>/catalogue.ts):
 * the box, and one kit per pack of N × the shared vial + 1 × that box. The
 * vial is the one BacLab's packs are made up from (VIAL_SKU_CODE). The box is
 * the plain one every brand shares (brands/packaging.ts), so vial and box
 * stock are both shared; a brand with a box of its own gets that box here. scripts/seed-brand-skus.ts
 * writes them; checkout, allocation, the pick list and labels then treat a
 * brand's pack like any other kit.
 *
 * Creates only what is missing and never changes a SKU that exists, exactly
 * as createStorefrontSkus (lib/inventory/store.ts) does for BacLab's: a pack
 * someone has since weighed, or turned into a pre-packed SKU of its own,
 * stays that way. A kit whose components differ from the catalogue is
 * reported, not rewritten.
 *
 * Weights start at zero, which the service picker reads as "not measured
 * yet". A pack's weight as posted has to be read off a scale, box included.
 * TODO(confirm): weigh the plain box and every pack before launch.
 */

export interface BrandSkuSpec {
  brand: string;
  box: { code: string; name: string; description: string };
  kits: { code: string; name: string; description: string; vials: number }[];
  /** SKUs of BacLab's that this brand's add-ons ship as (the Lab Kit). Never created here. */
  needs: string[];
}

/** Every brand with a catalogue, as SKUs. Pure: the script's dry run prints it. */
export function brandSkuSpecs(brands: readonly BrandProfile[] = allBrands()): BrandSkuSpec[] {
  const base = `${PRODUCT.name} ${PRODUCT.size}`;
  return brands.flatMap((b) => {
    const cat = b.catalogue;
    if (!cat) return [];
    const box = normaliseCode(cat.boxSku);
    return [
      {
        brand: b.id,
        // Staff see these names on the pick list. The kit names below go on
        // carrier labels and customs forms, so they never name the brand.
        box:
          box === PLAIN_BOX_SKU
            ? { code: box, name: "Plain box", description: "The plain, unprinted box every brand's packs ship in." }
            : { code: box, name: `${b.name} box`, description: `The box every ${b.name} pack is packed in.` },
        kits: cat.packs.map((p) => ({
          code: normaliseCode(p.sku),
          name: p.vials === 1 ? `${base} — single` : `${base} — ${p.vials}-pack`,
          description: `${b.name} pack "${p.id}": ${p.vials} × ${VIAL_SKU_CODE} + 1 × ${box}.`,
          vials: p.vials,
        })),
        needs: cat.addOns.some((a) => a.ships === "lab-kit") ? [LAB_KIT_SKU_CODE] : [],
      },
    ];
  });
}

export interface BrandSkuReport {
  created: string[];
  /** Already there, left alone. */
  existing: string[];
  /** Problems a person must look at: drifted kits, missing shared SKUs, bad codes. */
  warnings: string[];
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Write the SKUs brandSkuSpecs describes. With `apply: false`, reads only and
 * reports what it would create. Idempotent: a second run creates nothing.
 */
export async function seedBrandSkus(db: PrismaClient, opts: { apply: boolean }): Promise<BrandSkuReport> {
  const specs = brandSkuSpecs();
  const report: BrandSkuReport = { created: [], existing: [], warnings: [] };

  for (const spec of specs) {
    for (const code of [spec.box.code, ...spec.kits.map((k) => k.code)]) {
      const problem = skuCodeError(code);
      if (problem) report.warnings.push(`${spec.brand}: ${code}: ${problem}`);
    }
  }
  if (report.warnings.length > 0) return report;

  const run = async (tx: Db) => {
    // The plain box is every brand's: created, or reported, once.
    const boxesSeen = new Set<string>();
    // The shared vial. Normally created with BacLab's packs on
    // /admin/inventory; created here the same way if it is not there yet,
    // since every brand's kit is made of it.
    let vial = await tx.sku.findUnique({ where: { code: VIAL_SKU_CODE } });
    if (vial) report.existing.push(VIAL_SKU_CODE);
    else {
      report.created.push(VIAL_SKU_CODE);
      if (opts.apply) {
        const product = await tx.product.findUnique({ where: { slug: "baclab-10ml" } });
        vial = await tx.sku.create({
          data: {
            code: VIAL_SKU_CODE,
            name: `${PRODUCT.name} ${PRODUCT.size}`,
            description: "The single vial, as it sits on the shelf.",
            weightGrams: product?.weightGrams ?? 0,
          },
        });
      }
    }

    for (const spec of specs) {
      for (const needed of spec.needs) {
        if (!(await tx.sku.findUnique({ where: { code: needed } }))) {
          report.warnings.push(
            `${spec.brand}: ${needed} is missing. Its add-on ships as it: create it with "Create storefront SKUs" on /admin/inventory before selling in warehouse mode.`
          );
        }
      }

      let box = await tx.sku.findUnique({ where: { code: spec.box.code } });
      const firstTime = !boxesSeen.has(spec.box.code);
      boxesSeen.add(spec.box.code);
      if (box) {
        if (firstTime) report.existing.push(box.code);
      } else if (firstTime) {
        report.created.push(spec.box.code);
        if (opts.apply) box = await tx.sku.create({ data: spec.box });
      }

      for (const kit of spec.kits) {
        const exists = await tx.sku.findUnique({ where: { code: kit.code }, include: { components: true } });
        if (exists) {
          report.existing.push(kit.code);
          // A pre-packed SKU (no components) is a deliberate choice; a kit
          // whose bill of materials differs from the catalogue is not.
          if (exists.components.length > 0 && vial && box) {
            const want = new Map([
              [vial.id, kit.vials],
              [box.id, 1],
            ]);
            const same =
              exists.components.length === want.size && exists.components.every((c) => want.get(c.componentId) === c.quantity);
            if (!same) report.warnings.push(`${kit.code} exists with components that differ from ${kit.vials} × ${VIAL_SKU_CODE} + 1 × ${spec.box.code}. Left as it is.`);
          }
          continue;
        }
        report.created.push(kit.code);
        if (!opts.apply || !vial || !box) continue;
        await tx.sku.create({
          data: {
            code: kit.code,
            name: kit.name,
            description: kit.description,
            // Customs data for the parcels that need it (Northern Ireland): the
            // goods are the vial's, so its codes are the pack's.
            hsCode: vial.hsCode,
            originCountryIso: vial.originCountryIso,
            components: {
              create: [
                { componentId: vial.id, quantity: kit.vials },
                { componentId: box.id, quantity: 1 },
              ],
            },
          },
        });
      }
    }
  };

  if (opts.apply) await db.$transaction(async (tx) => run(tx));
  else await run(db);
  return report;
}
