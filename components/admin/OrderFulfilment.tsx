import Link from "next/link";
import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/admin/ActionForm";
import { getInventoryMode } from "@/lib/inventory/mode";
import { planOrderShipment } from "@/lib/shipping/order-parcel";
import { formatDimensions, formatWeight } from "@/lib/shipping/parcel";
import { getDeliveryInstructions, parseTrackingNumbers } from "@/lib/shipping/shipments";
import { LIMITS } from "@/lib/smarttrack/payload";
import { smartTrackConfig } from "@/lib/smarttrack/config";
import { deliveryChoiceEnabled, deliveryOptionById, formatMinor } from "@/config/funnel";
import { allocateOrderAction } from "@/app/admin/inventory/actions";
import { createLabelAction, reconcileShipmentAction, voidShipmentAction } from "@/app/admin/shipping/actions";

const SHIPMENT_STYLES: Record<string, string> = {
  CREATED: "bg-brand-tint text-brand-deep",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-600",
  VOIDED: "bg-line text-ink-soft",
};

/**
 * The warehouse half of the order page: where to pick it from, and the
 * carrier label. Never printed — the packing slip below it is.
 */
export async function OrderFulfilment({ order, isPacker }: { order: Order; isPacker: boolean }) {
  const [mode, pickLines, shipments] = await Promise.all([
    getInventoryMode(),
    prisma.pickLine.findMany({
      where: { orderId: order.id },
      include: { sku: true, location: { include: { warehouse: true } } },
    }),
    prisma.shipment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const cfg = smartTrackConfig();

  // Until the warehouse system is in use, the order page stays exactly as it
  // was for manual fulfilment: no pick list saying "not allocated", no "create
  // a SKU" warning on every order. It appears once stock is switched to the
  // warehouse, SmartTrack is connected, or this order has a pick list or label.
  if (mode === "legacy" && !cfg && pickLines.length === 0 && shipments.length === 0) return null;

  const [plan, defaultInstructions] = await Promise.all([planOrderShipment(order), getDeliveryInstructions()]);
  const open = ["paid", "packed"].includes(order.status);
  const shortfall = pickLines.filter((l) => !l.locationId).reduce((n, l) => n + l.quantity, 0);
  const picks = pickLines
    .filter((l) => l.location)
    .sort(
      (a, b) =>
        a.location!.pickSequence - b.location!.pickSequence || a.location!.code.localeCompare(b.location!.code)
    );
  const activeShipment = shipments.find((s) => s.status === "CREATED" || s.status === "PENDING");
  const suggested = plan.selection.service;
  const paidFor = deliveryOptionById(order.deliveryOption);

  return (
    <div className="no-print mt-4 grid gap-4 lg:grid-cols-2">
      {/* ── Pick list ── */}
      <section className="card p-6 text-sm">
        <div className="flex items-start justify-between gap-4">
          <p className="label">Pick list</p>
          {picks.length > 0 && (
            <div className="flex gap-4">
              <Link href={`/admin/orders/${order.id}/pick`} target="_blank" rel="noopener" className="text-sm font-semibold text-brand hover:text-brand-deep">
                Print pick label
              </Link>
              <Link href="/admin/orders/scan" className="text-sm font-semibold text-brand hover:text-brand-deep">
                Scan station
              </Link>
            </div>
          )}
        </div>

        {pickLines.length === 0 ? (
          mode === "legacy" ? (
            <p className="text-ink-soft">
              The shop sells against the old stock counter, so this order was not allocated to locations.
            </p>
          ) : open ? (
            <p className="text-amber-700">Not allocated to any location yet.</p>
          ) : (
            <p className="text-ink-soft">Nothing to pick.</p>
          )
        ) : (
          <table className="mt-1 w-full">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="py-1.5 font-semibold">Location</th>
                <th className="py-1.5 font-semibold">SKU</th>
                <th className="py-1.5 text-right font-semibold">Qty</th>
                <th className="py-1.5 text-right font-semibold">Scanned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {picks.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 font-mono text-xs">{l.location!.code}</td>
                  <td className="py-1.5">
                    <span className="font-mono text-xs">{l.sku.code}</span>
                    <span className="block text-xs text-ink-soft">{l.sku.name}</span>
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular">{l.quantity}</td>
                  <td className={`py-1.5 text-right tabular ${l.pickedQuantity >= l.quantity ? "font-semibold text-brand-deep" : "text-ink-soft"}`}>
                    {l.pickedQuantity >= l.quantity ? "✓" : l.pickedQuantity}
                  </td>
                </tr>
              ))}
              {pickLines
                .filter((l) => !l.locationId)
                .map((l) => (
                  <tr key={l.id} className="text-red-700">
                    <td className="py-1.5 text-xs font-semibold uppercase">Short</td>
                    <td className="py-1.5 font-mono text-xs">{l.sku.code}</td>
                    <td className="py-1.5 text-right font-semibold tabular">{l.quantity}</td>
                    <td />
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {!isPacker && open && mode === "warehouse" && (pickLines.length === 0 || shortfall > 0) && (
          <div className="mt-4">
            <ActionForm action={allocateOrderAction} submitLabel={shortfall > 0 ? "Allocate the shortfall" : "Allocate stock"} submitClassName="btn-secondary">
              <input type="hidden" name="orderId" value={order.id} />
              {shortfall > 0 && (
                <p className="text-ink-soft">
                  {shortfall} unit(s) were not on the shelves when the order was paid. Book stock in, then allocate.
                </p>
              )}
            </ActionForm>
          </div>
        )}
      </section>

      {/* ── Postage ── */}
      <section className="card p-6 text-sm">
        <p className="label">Postage</p>
        {plan.missingSkus.length > 0 ? (
          <p className="text-amber-700">
            No SKU for {plan.missingSkus.join(", ")} —{" "}
            {isPacker ? (
              "ask an admin to create it."
            ) : (
              <>
                create it on the <Link href="/admin/inventory" className="underline">Inventory page</Link>.
              </>
            )}
          </p>
        ) : (
          <>
            {(paidFor || deliveryChoiceEnabled()) && (
              <p className="mb-1 font-medium text-ink">
                Customer chose:{" "}
                {paidFor
                  ? `${paidFor.label} (${order.deliveryMinor ? formatMinor(order.deliveryMinor) : "free"})`
                  : "no delivery option recorded"}
              </p>
            )}
            <p className="text-ink-soft">
              Parcel: {plan.parcel.weightGrams > 0 ? formatWeight(plan.parcel.weightGrams) : "weight not set"} ·{" "}
              {formatDimensions(plan.parcel)} · to {plan.countryIso}
            </p>
            <p className="mt-2 font-semibold text-brand-deep">{suggested ? suggested.name : "No service fits"}</p>
            <p className="text-ink-soft">{plan.selection.note}</p>
          </>
        )}

        {shipments.length > 0 && (
          <ul className="mt-4 space-y-3 border-t border-line pt-4">
            {shipments.map((s) => {
              const tracking = parseTrackingNumbers(s.trackingNumbers);
              return (
                <li key={s.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SHIPMENT_STYLES[s.status] ?? ""}`}>
                      {s.status.toLowerCase()}
                    </span>
                    {s.environment !== "live" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">TEST (UAT)</span>
                    )}
                    <span className="font-medium">{s.serviceName || s.serviceCode}</span>
                    <span className="text-xs text-ink-soft">({s.serviceChoice})</span>
                  </div>
                  {tracking.length > 0 && <p className="mt-1 font-mono text-xs">{tracking.join(", ")}</p>}
                  {s.error && s.status !== "CREATED" && <p className="mt-1 text-xs text-red-700">{s.error}</p>}
                  <div className="mt-2 flex flex-wrap items-start gap-4">
                    {s.status === "CREATED" && (
                      <>
                        <a
                          href={`/admin/orders/${order.id}/shipments/${s.id}/label`}
                          target="_blank"
                          rel="noopener"
                          className="text-sm font-semibold text-brand hover:text-brand-deep"
                        >
                          Carrier label (PDF)
                        </a>
                        <ActionForm
                          action={voidShipmentAction}
                          submitLabel="Void label"
                          submitClassName="text-sm text-ink-soft hover:text-red-700"
                          className="space-y-1"
                          confirm="Void this label with SmartTrack? It cannot be used afterwards."
                        >
                          <input type="hidden" name="shipmentId" value={s.id} />
                          <input type="hidden" name="orderId" value={order.id} />
                        </ActionForm>
                      </>
                    )}
                    {s.status === "PENDING" && (
                      <ActionForm action={reconcileShipmentAction} submitLabel="Check with SmartTrack" submitClassName="btn-secondary" className="space-y-1">
                        <input type="hidden" name="shipmentId" value={s.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                      </ActionForm>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {open && !activeShipment && plan.missingSkus.length === 0 && (
          <div className="mt-4 border-t border-line pt-4">
            {!cfg ? (
              <p className="text-ink-soft">
                SmartTrack is not connected yet, so labels cannot be bought.
                {!isPacker && (
                  <> See <Link href="/admin/shipping" className="underline">Shipping</Link>.</>
                )}
              </p>
            ) : (
              <ActionForm
                action={createLabelAction}
                submitLabel={cfg.env === "live" ? "Buy label" : "Buy test label (UAT)"}
                confirm={cfg.env === "live" ? "Buy this label? SmartTrack charges for it." : undefined}
              >
                <input type="hidden" name="orderId" value={order.id} />
                <div>
                  <label className="label" htmlFor="deliveryInstructions">Delivery instructions</label>
                  <input
                    id="deliveryInstructions"
                    name="deliveryInstructions"
                    maxLength={LIMITS.description}
                    defaultValue={order.deliveryInstructions ?? defaultInstructions}
                    className="field"
                  />
                  <p className="mt-1 text-xs text-ink-soft">
                    {order.deliveryInstructions
                      ? "From the customer. Change it if they have asked you to."
                      : "The shop default. Change it if the customer has asked for something else."}
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="serviceCode">Service</label>
                  <select id="serviceCode" name="serviceCode" defaultValue="" className="field">
                    <option value="">{suggested ? `Suggested: ${suggested.name}` : "No service fits — pick one"}</option>
                    {plan.selection.checks
                      .filter((c) => c.service.active)
                      .map((c) => (
                        <option key={c.service.code} value={c.service.code}>
                          {c.service.name}
                          {c.fits ? "" : ` — does not fit: ${c.reasons[0]}`}
                        </option>
                      ))}
                  </select>
                </div>
              </ActionForm>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
