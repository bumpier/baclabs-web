import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { PrintButton } from "@/components/PrintButton";
import { LABEL_HEIGHT, LABEL_WIDTH, PostageLabel } from "@/components/PostageLabel";

export const dynamic = "force-dynamic";

interface Address {
  line1: string;
  line2: string | null;
  city: string;
  country: string;
  postalCode: string | null;
}

/**
 * The sticker is the only thing on the sheet, so this page carries its own
 * @page rule rather than the A4 default the rest of the site prints at. The
 * rules live here — not in globals.css — so they apply only while this route
 * is mounted.
 *
 * The admin shell stretches to the viewport height; on a 1in page that would
 * spill a second, blank sticker out of the printer, hence the min-height reset.
 */
const LABEL_PRINT_CSS = `
@media print {
  @page { size: ${LABEL_WIDTH} ${LABEL_HEIGHT}; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  body :where(div, main) { min-height: 0 !important; }
  /* The page wrapper's own padding would push the sticker off the stock. */
  .label-page { margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .postage-label {
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    break-inside: avoid;
  }
}
`;

/** Same shape the packing slip uses: street, then town with postcode, then country. */
function addressLines(address: Address): string[] {
  return [
    address.line1,
    address.line2 ?? "",
    address.postalCode ? `${address.city}, ${address.postalCode}` : address.city,
    address.country,
  ].filter((line) => line.trim().length > 0);
}

export default async function AdminOrderLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  // Card orders carry no address until the Stripe webhook backfills it, so a
  // pending card order legitimately has nothing to put on a label yet.
  const address: Address | null = order.shippingAddress
    ? (JSON.parse(order.shippingAddress) as Address)
    : null;
  const hasAddress = !!address?.line1;

  return (
    <div className="label-page mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: LABEL_PRINT_CSS }} />

      <div className="no-print">
        <p className="eyebrow">Postage label</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-medium tracking-tight text-brand-deep">
            Order <span className="font-mono text-lg">{order.id.slice(0, 8)}</span>
          </h1>
          <div className="flex flex-wrap gap-3">
            <Link href={`/admin/orders/${order.id}`} className="btn-secondary">
              Back to order
            </Link>
            {hasAddress && <PrintButton label="Print label" />}
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Prints at {LABEL_WIDTH} × {LABEL_HEIGHT} with no page margin. Set the printer to
          that label stock and turn off &ldquo;fit to page&rdquo; so the address stays true
          to size.
        </p>
        {hasAddress ? <p className="label mt-8">Preview (actual size)</p> : null}
      </div>

      {hasAddress && address ? (
        <PostageLabel
          name={order.customerName}
          lines={addressLines(address)}
          autoPrint
        />
      ) : (
        <p className="no-print card mt-8 p-6 text-sm text-ink-soft">
          This order has no shipping address yet, so there is nothing to print.
          Card orders get one when Stripe confirms the payment.
        </p>
      )}
    </div>
  );
}
