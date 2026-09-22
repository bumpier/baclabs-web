import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { SkuForm } from "@/app/admin/inventory/skus/SkuForm";

export const dynamic = "force-dynamic";

export default async function NewSkuPage() {
  await requireAdminRole("ADMIN");
  const [services, stocked] = await Promise.all([
    prisma.postalService.findMany({ where: { active: true }, orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    prisma.sku.findMany({ where: { components: { none: {} } }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href="/admin/inventory" className="text-sm text-ink-soft hover:text-brand-deep">← Inventory</Link>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">New SKU</h1>
      <div className="card mt-8 p-6">
        <SkuForm
          values={{
            code: "",
            name: "",
            description: "",
            barcode: "",
            weightGrams: 0,
            lengthMm: 0,
            widthMm: 0,
            heightMm: 0,
            hsCode: "",
            originCountryIso: "",
            serviceCode: "",
            active: true,
            components: [],
          }}
          services={services.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))}
          componentOptions={stocked.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
        />
      </div>
    </div>
  );
}
