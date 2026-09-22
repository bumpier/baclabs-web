import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { Barcode } from "@/components/admin/Barcode";
import { PrintButton } from "@/components/PrintButton";
import { locationScanCode, productScanCode } from "@/lib/inventory/scan";

export const dynamic = "force-dynamic";

/**
 * Shelf and product barcode labels, on A4 sheets of 21 (63.5 × 38.1 mm,
 * three across, seven down — the common L7160 layout), so any office
 * printer can make them. The scan station reads these: a shelf label says
 * "picked from here", a product label says "this item".
 */
const PER_SHEET = 21;

const SHEET_CSS = `
.label-sheet {
  width: 210mm;
  height: 297mm;
  box-sizing: border-box;
  padding: 15.1mm 7.2mm 0;
  display: grid;
  grid-template-columns: repeat(3, 63.5mm);
  grid-auto-rows: 38.1mm;
  column-gap: 2.5mm;
  background: #fff;
}
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body :where(div, main) { min-height: 0 !important; }
  .labels-page { margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .label-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; }
}
`;

interface LabelData {
  key: string;
  title: string;
  subtitle: string;
  scan: string;
}

export default async function BarcodeLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; warehouse?: string }>;
}) {
  await requireAdminRole("ADMIN");
  const { type, warehouse } = await searchParams;
  const kind = type === "skus" ? "skus" : "locations";

  let labels: LabelData[];
  if (kind === "locations") {
    const locations = await prisma.location.findMany({
      where: { active: true, ...(warehouse ? { warehouseId: warehouse } : {}) },
      include: { warehouse: true },
      orderBy: [{ warehouse: { code: "asc" } }, { pickSequence: "asc" }, { code: "asc" }],
    });
    labels = locations.map((l) => ({
      key: l.id,
      title: l.code,
      subtitle: `${l.warehouse.name} · shelf`,
      scan: locationScanCode(l.code),
    }));
  } else {
    // Kits are not objects on a shelf, so they get no label.
    const skus = await prisma.sku.findMany({
      where: { active: true, components: { none: {} } },
      orderBy: { code: "asc" },
    });
    labels = skus.map((s) => ({ key: s.id, title: s.code, subtitle: s.name, scan: productScanCode(s) }));
  }

  const sheets: LabelData[][] = [];
  for (let i = 0; i < labels.length; i += PER_SHEET) sheets.push(labels.slice(i, i + PER_SHEET));

  return (
    <div className="labels-page mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: SHEET_CSS }} />
      <div className="no-print mb-8">
        <Link href="/admin/inventory" className="text-sm text-ink-soft hover:text-brand-deep">← Inventory</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-medium tracking-tight text-brand-deep">
            {kind === "locations" ? "Shelf labels" : "Product labels"}
          </h1>
          <div className="flex gap-3">
            <Link href={`/admin/inventory/labels?type=${kind === "locations" ? "skus" : "locations"}`} className="btn-secondary">
              {kind === "locations" ? "Product labels instead" : "Shelf labels instead"}
            </Link>
            {labels.length > 0 && <PrintButton label={`Print ${labels.length} label${labels.length === 1 ? "" : "s"}`} />}
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          A4 label sheets, 21 per sheet (63.5 × 38.1 mm). In the print dialog set margins to none and scale to
          100%. {kind === "skus" && "A SKU with the maker's barcode on file prints that barcode; the rest print their SKU code."}
        </p>
      </div>

      {labels.length === 0 ? (
        <p className="no-print card p-6 text-sm text-ink-soft">Nothing to print.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {sheets.map((sheet, i) => (
            <div key={i} className="label-sheet mx-auto shadow-lift">
              {sheet.map((l) => (
                <div key={l.key} className="flex flex-col items-center justify-center overflow-hidden px-[3mm] text-black">
                  <p className="font-mono text-[13pt] font-black leading-none">{l.title}</p>
                  <p className="mt-[0.8mm] max-w-full truncate text-[6.5pt] leading-tight">{l.subtitle}</p>
                  <div className="mt-[1.5mm]">
                    <Barcode value={l.scan} width="56mm" height="13mm" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
