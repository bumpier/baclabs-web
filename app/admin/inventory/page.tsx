import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { ActionForm } from "@/components/admin/ActionForm";
import { getInventoryMode } from "@/lib/inventory/mode";
import { inventoryReadiness, onHandBySku } from "@/lib/inventory/store";
import { kitsAvailable } from "@/lib/inventory/allocation";
import { formatDimensions, formatWeight } from "@/lib/shipping/parcel";
import { skuParcel } from "@/lib/shipping/order-parcel";
import { createStorefrontSkusAction, setInventoryModeAction } from "@/app/admin/inventory/actions";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  await requireAdminRole("ADMIN");

  const [mode, readiness, onHand, skus, services, legacyProduct] = await Promise.all([
    getInventoryMode(),
    inventoryReadiness(),
    onHandBySku(),
    prisma.sku.findMany({
      orderBy: { code: "asc" },
      include: { components: { include: { component: true } } },
    }),
    prisma.postalService.findMany({ select: { code: true, name: true } }),
    prisma.product.findUnique({ where: { slug: "baclab-10ml" }, select: { stock: true } }),
  ]);
  const serviceName = new Map(services.map((s) => [s.code, s.name]));
  const missingPacks = readiness.packs.filter((p) => !p.sku).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Warehouse</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Inventory</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/inventory/stock" className="btn-secondary">Book stock in / adjust</Link>
          <Link href="/admin/inventory/warehouses" className="btn-secondary">Warehouses &amp; locations</Link>
          <Link href="/admin/inventory/skus/new" className="btn-primary">New SKU</Link>
        </div>
      </div>

      {/* ── Which stock count the shop sells against ── */}
      <section className="card mt-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="label">Checkout sells against</p>
            <p className="text-lg font-semibold text-brand-deep">
              {mode === "warehouse" ? "The warehouse shelves" : "The old single stock counter"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {mode === "warehouse"
                ? "Each pack is sellable as far as the shelves can make it up. Paid orders are allocated to locations, which is what the pick list prints."
                : `Checkout checks, and payment decrements, the product's vial counter (${legacyProduct?.stock ?? 0} vials). Nothing here affects orders until you switch. Book the physical count into locations first — the old counter is not carried over.`}
            </p>
          </div>
          {mode === "warehouse" ? (
            <ActionForm
              action={setInventoryModeAction}
              submitLabel="Switch back to the old counter"
              submitClassName="btn-secondary"
              confirm="Switch checkout back to the old single stock counter? Orders will stop being allocated to locations."
            >
              <input type="hidden" name="mode" value="legacy" />
            </ActionForm>
          ) : (
            <ActionForm
              action={setInventoryModeAction}
              submitLabel="Switch to warehouse stock"
              submitClassName={readiness.ready ? "btn-primary" : "btn-secondary"}
              confirm="Switch checkout to warehouse stock? From now on customers can only buy what is booked into locations here."
            >
              <input type="hidden" name="mode" value="warehouse" />
            </ActionForm>
          )}
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
              <th className="py-2 font-semibold">Storefront pack</th>
              <th className="py-2 font-semibold">SKU</th>
              <th className="py-2 text-right font-semibold">Can sell</th>
              <th className="py-2 pl-6 font-semibold">Ready?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {readiness.packs.map((p) => (
              <tr key={p.code}>
                <td className="py-2">{p.vials === 1 ? "Single vial" : `${p.vials}-vial pack`}</td>
                <td className="py-2 font-mono text-xs">
                  {p.sku ? (
                    <Link href={`/admin/inventory/skus/${p.sku.id}`} className="text-brand hover:text-brand-deep">
                      {p.code}
                    </Link>
                  ) : (
                    p.code
                  )}
                  {p.sku && <span className="ml-2 font-sans text-ink-soft">{p.sku.kind === "kit" ? "kit" : "pre-packed"}</span>}
                </td>
                <td className="py-2 text-right tabular">{p.sku ? p.available : "—"}</td>
                <td className="py-2 pl-6">
                  {p.problems.length > 0 ? (
                    <span className="text-red-700">{p.problems.join("; ")}</span>
                  ) : p.warnings.length > 0 ? (
                    <span className="text-amber-700">Yes — but {p.warnings.join("; ").toLowerCase()}</span>
                  ) : (
                    <span className="text-brand-deep">Yes</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {readiness.locationCount === 0 && (
          <p className="mt-3 text-sm text-red-700">
            No locations yet. <Link href="/admin/inventory/warehouses" className="underline">Add a warehouse and its locations.</Link>
          </p>
        )}
        {missingPacks > 0 && (
          <div className="mt-4">
            <ActionForm
              action={createStorefrontSkusAction}
              submitLabel={`Create the ${missingPacks} missing SKU${missingPacks === 1 ? "" : "s"}`}
              submitClassName="btn-secondary"
            >
              <p className="text-sm text-ink-soft">
                Creates the vial as a stocked SKU and each missing pack as a kit of that many vials. Change any
                pack to pre-packed later by removing its components.
              </p>
            </ActionForm>
          </div>
        )}
      </section>

      {/* ── Every SKU ── */}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl font-medium text-brand-deep">SKUs</h2>
        {skus.length > 0 && (
          <Link href="/admin/inventory/labels?type=skus" target="_blank" rel="noopener" className="text-sm font-semibold text-brand hover:text-brand-deep">
            Print product labels
          </Link>
        )}
      </div>
      {skus.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-soft">No SKUs yet.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">SKU</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 text-right font-semibold">On hand</th>
                <th className="px-5 py-3 font-semibold">As posted</th>
                <th className="px-5 py-3 font-semibold">Postal service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {skus.map((s) => {
                const isKit = s.components.length > 0;
                const available = isKit
                  ? kitsAvailable(s.components.map((c) => ({ quantity: c.quantity, available: onHand.get(c.componentId) ?? 0 })))
                  : onHand.get(s.id) ?? 0;
                return (
                  <tr key={s.id} className={`hover:bg-brand-tint/40 ${s.active ? "" : "opacity-50"}`}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/inventory/skus/${s.id}`} className="font-mono text-xs font-semibold text-brand hover:text-brand-deep">
                        {s.code}
                      </Link>
                      <span className="block text-ink-soft">{s.name}{s.active ? "" : " (switched off)"}</span>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {isKit ? `Kit: ${s.components.map((c) => `${c.quantity} × ${c.component.code}`).join(" + ")}` : "Stocked"}
                    </td>
                    <td className="px-5 py-3 text-right tabular">
                      {isKit ? <span className="text-ink-soft">makes {available}</span> : available}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {s.weightGrams > 0 ? formatWeight(s.weightGrams) : "weight not set"} · {formatDimensions(skuParcel(s))}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {s.serviceCode ? serviceName.get(s.serviceCode) ?? s.serviceCode : "Automatic"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
