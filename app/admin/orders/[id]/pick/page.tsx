import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { parseAddress } from "@/lib/orderAddress";
import { QrCode } from "@/components/admin/QrCode";
import { orderScanCode, pickLabelPayload } from "@/lib/inventory/scan";

export const dynamic = "force-dynamic";

/**
 * The pick label: printed with the carrier label, on the same 100 × 150 mm
 * (4 × 6 in) thermal stock, so the two come off one printer together and go
 * in the tray as a pair. It lists what to take and from where, in walking
 * order.
 *
 * The 2D code at the foot carries the order and every line — shelf, item
 * and quantity — for the fulfilment team's scanners, and opens the order at
 * our own scan station too. Its format is set in lib/inventory/scan.ts.
 */
const PICK_PRINT_CSS = `
@media print {
  @page { size: 100mm 150mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body :where(div, main) { min-height: 0 !important; }
  .pick-page { margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .pick-label { margin: 0 !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
}
`;

export default async function PickLabelPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      pickLines: { include: { sku: true, location: true } },
      shipments: { where: { status: { in: ["CREATED", "PENDING"] } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) notFound();

  const picks = order.pickLines
    .filter((l) => l.location)
    .sort((a, b) => a.location!.pickSequence - b.location!.pickSequence || a.location!.code.localeCompare(b.location!.code));
  const short = order.pickLines.filter((l) => !l.location);
  const units = picks.reduce((n, l) => n + l.quantity, 0);
  const address = parseAddress(order);
  const ref = order.id.slice(0, 8).toUpperCase();
  const service = order.shipments[0]?.serviceName;

  return (
    <div className="pick-page mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: PICK_PRINT_CSS }} />

      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Pick label</p>
          <p className="mt-1 text-sm text-ink-soft">100 × 150 mm, no margin — the same stock as the carrier label.</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/admin/orders/${order.id}`} className="btn-secondary">Back to order</Link>
          <Link href="/admin/orders/scan" className="btn-secondary">Scan station</Link>
          {picks.length > 0 && <PrintButton label="Print pick label" />}
        </div>
      </div>

      {picks.length === 0 ? (
        <p className="no-print card p-6 text-sm text-ink-soft">
          This order has no pick list — it was not allocated to locations.
        </p>
      ) : (
        <>
          <div
            className="pick-label card flex flex-col bg-white p-[5mm] text-black"
            style={{ width: "100mm", height: "150mm", boxSizing: "border-box", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            <div className="flex items-baseline justify-between border-b-2 border-black pb-[2mm]">
              <span className="text-[14pt] font-black tracking-wider">PICK</span>
              <span className="font-mono text-[14pt] font-bold">{ref}</span>
            </div>
            <div className="mt-[2mm] flex justify-between text-[8pt]">
              <span>
                {order.customerName}
                {address?.postalCode ? ` · ${address.postalCode}` : ""}
              </span>
              <span>{order.createdAt.toLocaleDateString("en-GB")}</span>
            </div>
            {service && <p className="text-[8pt]">Service: {service}</p>}

            <table className="mt-[3mm] w-full text-[9pt]">
              <thead>
                <tr className="border-b border-black text-left text-[7pt] uppercase">
                  <th className="py-[1mm]">Location</th>
                  <th className="py-[1mm]">SKU</th>
                  <th className="py-[1mm] text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {picks.map((l) => (
                  <tr key={l.id} className="border-b border-black/30 align-top">
                    <td className="py-[1.5mm] font-mono text-[11pt] font-bold">{l.location!.code}</td>
                    <td className="py-[1.5mm]">
                      <span className="block font-mono font-bold">{l.sku.code}</span>
                      <span className="block text-[7pt]">{l.sku.name}</span>
                    </td>
                    <td className="py-[1.5mm] text-right text-[16pt] font-black">{l.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-[2mm] text-right text-[9pt] font-bold">{units} unit{units === 1 ? "" : "s"}</p>
            {short.length > 0 && (
              <p className="mt-[1mm] text-[8pt] font-bold">
                SHORT: {short.map((l) => `${l.quantity} × ${l.sku.code}`).join(", ")} — do not ship
              </p>
            )}

            <div className="mt-auto flex items-center justify-center gap-[4mm] border-t-2 border-black pt-[2mm]">
              <QrCode
                value={pickLabelPayload(
                  order.id,
                  picks.map((l) => ({ locationCode: l.location!.code, sku: l.sku, quantity: l.quantity }))
                )}
                size="34mm"
              />
              <div className="text-left">
                <p className="text-[6pt] uppercase tracking-widest">Scan ref</p>
                <p className="font-mono text-[12pt] font-bold">{orderScanCode(order.id)}</p>
                <p className="text-[7pt]">
                  {picks.length} line{picks.length === 1 ? "" : "s"} · {units} unit{units === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
          <AutoPrint />
        </>
      )}
    </div>
  );
}
