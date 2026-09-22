import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { PrintButton } from "@/components/PrintButton";
import { PostageLabel } from "@/components/PostageLabel";
import { LABEL_HEIGHT, LABEL_PRINT_CSS, LABEL_WIDTH } from "@/lib/postageLabel";
import { addressLines, parseAddress } from "@/lib/orderAddress";

export const dynamic = "force-dynamic";

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

  const address = parseAddress(order);
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
