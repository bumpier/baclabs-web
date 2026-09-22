import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { SkuForm } from "@/app/admin/inventory/skus/SkuForm";
import { kitsAvailable } from "@/lib/inventory/allocation";
import { onHandBySku } from "@/lib/inventory/store";
import { formatDimensions, formatWeight } from "@/lib/shipping/parcel";
import { skuParcel } from "@/lib/shipping/order-parcel";
import { selectService, toServiceRule } from "@/lib/shipping/select-service";

export const dynamic = "force-dynamic";

export default async function SkuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminRole("ADMIN");
  const { id } = await params;
  const { saved } = await searchParams;

  const sku = await prisma.sku.findUnique({
    where: { id },
    include: {
      components: { include: { component: true } },
      usedIn: { include: { kit: true } },
      stock: { where: { quantity: { not: 0 } }, include: { location: { include: { warehouse: true } } } },
      movements: { orderBy: { createdAt: "desc" }, take: 25, include: { location: true } },
    },
  });
  if (!sku) notFound();

  const [services, stocked, onHand] = await Promise.all([
    prisma.postalService.findMany({ orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    prisma.sku.findMany({ where: { components: { none: {} }, id: { not: sku.id } }, orderBy: { code: "asc" } }),
    onHandBySku(),
  ]);

  const isKit = sku.components.length > 0;
  const parcel = skuParcel(sku);
  const check = selectService(services.map(toServiceRule), parcel, "GB", sku.serviceCode);
  const kitMakes = isKit
    ? kitsAvailable(sku.components.map((c) => ({ quantity: c.quantity, available: onHand.get(c.componentId) ?? 0 })))
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link href="/admin/inventory" className="text-sm text-ink-soft hover:text-brand-deep">← Inventory</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-brand-deep">{sku.code}</h1>
          <p className="text-ink-soft">{sku.name}</p>
        </div>
        {!isKit && (
          <Link href={`/admin/inventory/stock?sku=${sku.id}`} className="btn-secondary">Book in / adjust this SKU</Link>
        )}
      </div>
      {saved && <p role="status" className="alert-note mt-4">Saved.</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="card p-6">
          <SkuForm
            values={{
              id: sku.id,
              code: sku.code,
              name: sku.name,
              description: sku.description,
              barcode: sku.barcode ?? "",
              weightGrams: sku.weightGrams,
              lengthMm: sku.lengthMm,
              widthMm: sku.widthMm,
              heightMm: sku.heightMm,
              hsCode: sku.hsCode ?? "",
              originCountryIso: sku.originCountryIso ?? "",
              serviceCode: sku.serviceCode ?? "",
              active: sku.active,
              components: sku.components.map((c) => ({ componentSkuId: c.componentId, quantity: c.quantity })),
            }}
            services={services
              .filter((s) => s.active || s.code === sku.serviceCode)
              .map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))}
            componentOptions={stocked.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
          />
        </div>

        <aside className="space-y-6">
          <section className="card p-5 text-sm">
            <p className="label">{isKit ? "Can be made up" : "On hand"}</p>
            {isKit ? (
              <>
                <p className="text-2xl font-semibold tabular text-brand-deep">{kitMakes}</p>
                <p className="mt-1 text-ink-soft">
                  A kit holds no stock; this is how many its components make.
                </p>
              </>
            ) : sku.stock.length === 0 ? (
              <p className="text-ink-soft">None booked in.</p>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular text-brand-deep">{onHand.get(sku.id) ?? 0}</p>
                <ul className="mt-2 divide-y divide-line">
                  {sku.stock
                    .sort((a, b) => a.location.pickSequence - b.location.pickSequence || a.location.code.localeCompare(b.location.code))
                    .map((l) => (
                      <li key={l.id} className="flex justify-between py-1.5">
                        <span className={`font-mono text-xs ${l.location.active ? "" : "line-through opacity-60"}`}>
                          {l.location.warehouse.code} / {l.location.code}
                        </span>
                        <span className="tabular">{l.quantity}</span>
                      </li>
                    ))}
                </ul>
              </>
            )}
            {sku.usedIn.length > 0 && (
              <p className="mt-3 text-ink-soft">
                Component of {sku.usedIn.map((u) => `${u.kit.code} (×${u.quantity})`).join(", ")}.
              </p>
            )}
          </section>

          <section className="card p-5 text-sm">
            <p className="label">Postage for one, to the UK</p>
            <p className="text-ink-soft">
              {sku.weightGrams > 0 ? formatWeight(sku.weightGrams) : "Weight not set"} · {formatDimensions(parcel)}
            </p>
            <p className="mt-2 font-semibold text-brand-deep">{check.service?.name ?? "No service"}</p>
            <p className="mt-1 text-ink-soft">{check.note}</p>
            {check.checks.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                {check.checks.map((c) => (
                  <li key={c.service.code}>
                    <span className={c.fits ? "text-brand-deep" : "text-ink-soft"}>
                      {c.fits ? "✓" : "✗"} {c.service.name}
                    </span>
                    {!c.fits && <span className="block pl-4 text-xs text-ink-soft/80">{c.reasons.join("; ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {!isKit && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-medium text-brand-deep">Recent movements</h2>
          {sku.movements.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">None yet.</p>
          ) : (
            <div className="card mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                    <th className="px-5 py-3 font-semibold">When</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Location</th>
                    <th className="px-5 py-3 text-right font-semibold">Change</th>
                    <th className="px-5 py-3 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sku.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-5 py-2 text-ink-soft">
                        {m.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-2 text-xs font-semibold uppercase tracking-wider">{m.type}</td>
                      <td className="px-5 py-2 font-mono text-xs">{m.location.code}</td>
                      <td className={`px-5 py-2 text-right tabular ${m.quantity < 0 ? "text-red-700" : "text-brand-deep"}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="px-5 py-2 text-ink-soft">
                        {[m.reason, m.reference].filter(Boolean).join(" · ")}
                        {m.orderId && (
                          <Link href={`/admin/orders/${m.orderId}`} className="ml-1 text-brand hover:text-brand-deep">
                            order
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
