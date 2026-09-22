import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { PostageLabel } from "@/components/PostageLabel";
import { PackingSlip } from "@/components/admin/PackingSlip";
import { addressLines, parseAddress } from "@/lib/orderAddress";
import { LABEL_HEIGHT, LABEL_PRINT_CSS, LABEL_WIDTH } from "@/lib/postageLabel";

export const dynamic = "force-dynamic";

/**
 * Each order after the first starts a new page, so every slip gets its own A4
 * sheet and every address its own sticker. The screen gaps between sheets are
 * dropped in print or they would push each one down its page, and the sheets
 * are plain blocks there because Chrome ignores page breaks inside flex.
 */
const BATCH_PRINT_CSS = `
@media print {
  .batch-page { padding: 0 !important; max-width: none !important; }
  .batch-sheet { margin: 0 !important; }
  .batch-sheet + .batch-sheet { break-before: page; }
}
`;

type Kind = "slips" | "labels";

const KINDS: Record<Kind, { singular: string; plural: string; help: string }> = {
  slips: {
    singular: "packing slip",
    plural: "packing slips",
    help: "One A4 sheet per order, oldest first. Pick your A4 printer in the print dialog.",
  },
  labels: {
    singular: "postage label",
    plural: "postage labels",
    help: `One ${LABEL_WIDTH} × ${LABEL_HEIGHT} sticker per order, in the same order as the packing slips. Pick the label printer, set it to that stock and turn off “fit to page” so the addresses stay true to size.`,
  },
};

export default async function AdminBatchPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireAdmin();
  const { type } = await searchParams;
  const kind: Kind = type === "labels" ? "labels" : "slips";
  const other: Kind = kind === "labels" ? "slips" : "labels";

  // "Unfulfilled" is what the dashboard calls awaiting fulfilment: paid, not
  // yet packed. Oldest first, and the same sort for both kinds, so the slips
  // and labels come off their printers in matching stacks.
  const orders = await prisma.order.findMany({
    where: { status: "paid" },
    orderBy: { createdAt: "asc" },
  });
  const printable = orders.flatMap((order) => {
    const address = parseAddress(order);
    return address?.line1 ? [{ order, address }] : [];
  });
  const skipped = orders.length - printable.length;
  const count = printable.length;
  const heading = `${count} ${count === 1 ? KINDS[kind].singular : KINDS[kind].plural}`;

  return (
    <div
      className={`batch-page mx-auto max-w-4xl px-4 py-12 sm:px-6 ${
        kind === "labels" ? "label-page" : ""
      }`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: kind === "labels" ? LABEL_PRINT_CSS + BATCH_PRINT_CSS : BATCH_PRINT_CSS,
        }}
      />

      <div className="no-print">
        <p className="eyebrow">Unfulfilled orders</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-medium tracking-tight text-brand-deep">
            {heading}
          </h1>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin" className="btn-secondary">
              Back to dashboard
            </Link>
            <Link href={`/admin/orders/print?type=${other}`} className="btn-secondary">
              Switch to {KINDS[other].plural}
            </Link>
            {count > 0 && <PrintButton label={`Print ${heading}`} />}
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-soft">{KINDS[kind].help}</p>
        {skipped > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            {skipped === 1
              ? "1 paid order has no shipping address yet and was left out."
              : `${skipped} paid orders have no shipping address yet and were left out.`}
          </p>
        )}
      </div>

      {count === 0 ? (
        <p className="no-print card mt-8 p-6 text-sm text-ink-soft">
          Nothing to print. No orders are waiting for fulfilment.
        </p>
      ) : kind === "slips" ? (
        <div className="mt-8 space-y-6">
          {printable.map(({ order }) => (
            <div key={order.id} className="batch-sheet">
              <PackingSlip order={order} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="no-print label mt-8">Preview (actual size)</p>
          <div className="flex flex-wrap gap-3 print:block">
            {printable.map(({ order, address }) => (
              <div key={order.id} className="batch-sheet">
                <PostageLabel name={order.customerName} lines={addressLines(address)} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* After the labels, so their font re-fit lands before the dialog opens */}
      {count > 0 && <AutoPrint />}
    </div>
  );
}
