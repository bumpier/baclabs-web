import Link from "next/link";
import type { Warehouse } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { ActionForm } from "@/components/admin/ActionForm";
import { saveLocationAction, saveWarehouseAction } from "@/app/admin/inventory/actions";

export const dynamic = "force-dynamic";

/** The warehouse's address is the SENDER on its labels, so its limits are SmartTrack's. */
function WarehouseFields({ w }: { w?: Warehouse }) {
  const field = (name: keyof Warehouse, label: string, max: number, extra: Record<string, unknown> = {}) => (
    <div>
      <label className="label" htmlFor={`${w?.id ?? "new"}-${name}`}>{label}</label>
      <input
        id={`${w?.id ?? "new"}-${name}`}
        name={name}
        maxLength={max}
        defaultValue={w ? String(w[name] ?? "") : name === "countryIso" ? "GB" : ""}
        className="field"
        {...extra}
      />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {!w && field("code", "Code", 12, { required: true, placeholder: "MAIN", className: "field font-mono uppercase" })}
      {field("name", "Name", 80, { required: true })}
      {field("contactName", "Contact name (on labels)", 40)}
      {field("company", "Company", 25)}
      {field("addressLine1", "Address line 1", 60)}
      {field("addressLine2", "Address line 2", 60)}
      {field("city", "Town or city", 25)}
      {field("postcode", "Postcode", 10)}
      {field("countryIso", "Country code", 2, { className: "field uppercase" })}
      {field("phone", "Phone", 17)}
      {field("email", "Email", 45, { type: "email" })}
      <div className="flex items-end pb-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="active" defaultChecked={w ? w.active : true} className="h-4 w-4 accent-[var(--color-brand)]" />
          Active
        </label>
      </div>
    </div>
  );
}

export default async function WarehousesPage() {
  await requireAdminRole("ADMIN");
  const [warehouses, totals] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: { createdAt: "asc" },
      include: { locations: { orderBy: [{ pickSequence: "asc" }, { code: "asc" }] } },
    }),
    prisma.stockLevel.groupBy({ by: ["locationId"], _sum: { quantity: true } }),
  ]);
  const unitsIn = new Map(totals.map((t) => [t.locationId, t._sum.quantity ?? 0]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link href="/admin/inventory" className="text-sm text-ink-soft hover:text-brand-deep">← Inventory</Link>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Warehouses &amp; locations</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        A location is a place on the shelf — &ldquo;A-01-02&rdquo; for aisle A, bay 1, shelf 2, or whatever your
        racking is labelled. Orders are picked from the lowest pick order first, so give the pick face a low
        number and the overflow a high one. Keep pre-packed packs in their own locations.
      </p>

      {warehouses.map((w) => (
        <section key={w.id} className="card mt-8 p-6">
          <h2 className="font-display text-xl font-medium text-brand-deep">
            <span className="font-mono">{w.code}</span> · {w.name}
            {!w.active && <span className="ml-2 text-sm text-red-700">switched off</span>}
          </h2>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand">Address and details</summary>
            <div className="mt-4">
              <ActionForm action={saveWarehouseAction} submitLabel="Save warehouse">
                <input type="hidden" name="warehouseId" value={w.id} />
                <WarehouseFields w={w} />
              </ActionForm>
            </div>
          </details>

          <div className="mt-6 flex items-center justify-between gap-4">
            <h3 className="label">Locations</h3>
            {w.locations.length > 0 && (
              <Link
                href={`/admin/inventory/labels?type=locations&warehouse=${w.id}`}
                target="_blank"
                rel="noopener"
                className="text-sm font-semibold text-brand hover:text-brand-deep"
              >
                Print shelf labels
              </Link>
            )}
          </div>
          {w.locations.length === 0 ? (
            <p className="text-sm text-ink-soft">None yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {w.locations.map((l) => (
                <ActionForm
                  key={l.id}
                  action={saveLocationAction}
                  submitLabel="Save"
                  submitClassName="text-sm font-semibold text-brand hover:text-brand-deep"
                  className="flex flex-wrap items-center gap-4 py-2"
                >
                  <input type="hidden" name="locationId" value={l.id} />
                  <span className={`w-32 font-mono text-sm ${l.active ? "" : "line-through opacity-60"}`}>{l.code}</span>
                  <span className="w-28 text-sm text-ink-soft tabular">{unitsIn.get(l.id) ?? 0} units</span>
                  <label className="flex items-center gap-2 text-sm">
                    Pick order
                    <input name="pickSequence" type="number" min="0" max="9999" defaultValue={l.pickSequence} className="field w-24 tabular" />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={l.active} className="h-4 w-4 accent-[var(--color-brand)]" />
                    Active
                  </label>
                </ActionForm>
              ))}
            </div>
          )}

          <ActionForm
            action={saveLocationAction}
            submitLabel="Add location"
            submitClassName="btn-secondary"
            className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4"
          >
            <input type="hidden" name="warehouseId" value={w.id} />
            <div>
              <label className="label" htmlFor={`${w.id}-loc-code`}>New location code</label>
              <input id={`${w.id}-loc-code`} name="code" required maxLength={30} placeholder="A-01-02" className="field font-mono uppercase" />
            </div>
            <div>
              <label className="label" htmlFor={`${w.id}-loc-seq`}>Pick order</label>
              <input id={`${w.id}-loc-seq`} name="pickSequence" type="number" min="0" max="9999" defaultValue={100} className="field w-28 tabular" />
            </div>
          </ActionForm>
        </section>
      ))}

      <section className="card mt-8 p-6">
        <h2 className="font-display text-xl font-medium text-brand-deep">
          {warehouses.length === 0 ? "Add your warehouse" : "Add another warehouse"}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Its address is printed as the sender on every label shipped from it.
        </p>
        <div className="mt-4">
          <ActionForm action={saveWarehouseAction} submitLabel="Add warehouse">
            <WarehouseFields />
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
