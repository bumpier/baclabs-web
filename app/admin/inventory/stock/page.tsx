import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { StockMovementForm } from "@/app/admin/inventory/stock/StockMovementForm";

export const dynamic = "force-dynamic";

const TYPE_STYLES: Record<string, string> = {
  RECEIVE: "bg-brand-tint text-brand-deep",
  SALE: "bg-indigo-50 text-indigo-700",
  CANCEL: "bg-amber-50 text-amber-700",
  ADJUST: "bg-red-50 text-red-700",
  TRANSFER: "bg-blue-50 text-blue-700",
};

export default async function StockPage({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  await requireAdminRole("ADMIN");
  const { sku: skuFilter } = await searchParams;

  const [skus, locations, movements, actors] = await Promise.all([
    // Kits hold no stock of their own, so they are not offered.
    prisma.sku.findMany({ where: { components: { none: {} } }, orderBy: { code: "asc" } }),
    prisma.location.findMany({
      include: { warehouse: true },
      orderBy: [{ warehouse: { code: "asc" } }, { pickSequence: "asc" }, { code: "asc" }],
    }),
    prisma.stockMovement.findMany({
      where: skuFilter ? { skuId: skuFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: { sku: true, location: { include: { warehouse: true } } },
    }),
    prisma.adminUser.findMany({ select: { id: true, name: true } }),
  ]);
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const filtered = skuFilter ? skus.find((s) => s.id === skuFilter) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/admin/inventory" className="text-sm text-ink-soft hover:text-brand-deep">← Inventory</Link>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Stock movements</h1>

      <section className="card mt-8 p-6">
        {locations.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Add a <Link href="/admin/inventory/warehouses" className="text-brand underline">warehouse and locations</Link> first.
          </p>
        ) : (
          <StockMovementForm
            skus={skus.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
            locations={locations
              .filter((l) => l.active && l.warehouse.active)
              .map((l) => ({ value: l.id, label: `${l.warehouse.code} / ${l.code}` }))}
            defaultSkuId={filtered?.id}
          />
        )}
      </section>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl font-medium text-brand-deep">
          Ledger{filtered ? <> for <span className="font-mono">{filtered.code}</span></> : ""}
        </h2>
        {filtered && <Link href="/admin/inventory/stock" className="text-sm text-brand hover:text-brand-deep">Show every SKU</Link>}
      </div>
      <p className="mt-1 text-sm text-ink-soft">Every change to every shelf, newest first. Nothing here is ever edited or deleted.</p>
      {movements.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-soft">No movements yet.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 text-right font-semibold">Change</th>
                <th className="px-4 py-3 font-semibold">Why</th>
                <th className="px-4 py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-ink-soft">
                    {m.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_STYLES[m.type] ?? ""}`}>{m.type.toLowerCase()}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/admin/inventory/skus/${m.skuId}`} className="text-brand hover:text-brand-deep">{m.sku.code}</Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{m.location.warehouse.code} / {m.location.code}</td>
                  <td className={`px-4 py-2 text-right tabular ${m.quantity < 0 ? "text-red-700" : "text-brand-deep"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="px-4 py-2 text-ink-soft">
                    {[m.reason, m.reference].filter(Boolean).join(" · ")}
                    {m.orderId && (
                      <Link href={`/admin/orders/${m.orderId}`} className="ml-1 text-brand hover:text-brand-deep">order</Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-soft">{actorName.get(m.actor) ?? m.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
