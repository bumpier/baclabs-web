import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession, requireAdmin } from "@/lib/adminAuth";
import { setOrderStatusAction } from "@/app/admin/actions";
import { PrintButton } from "@/components/PrintButton";
import { PackingSlip } from "@/components/admin/PackingSlip";
import { OrderFulfilment } from "@/components/admin/OrderFulfilment";
import { SubmitButton } from "@/components/forms";
import { SHOP_TIME_ZONE, formatSaleDateTime } from "@/lib/saleTime";

export const dynamic = "force-dynamic";

const NEXT_ACTIONS: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: "cancelled", label: "Cancel order" }],
  paid: [
    { status: "shipped", label: "Mark as shipped" },
    { status: "cancelled", label: "Cancel order" },
  ],
  shipped: [{ status: "delivered", label: "Mark as delivered" }],
  delivered: [],
  cancelled: [],
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { emailLogs: { orderBy: { sentAt: "asc" } } },
  });
  if (!order) notFound();

  const session = await getAdminSession();
  const actions = NEXT_ACTIONS[order.status] ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Admin controls — hidden when printing */}
      <div className="no-print">
        <p className="eyebrow">Order detail</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-medium tracking-tight text-brand-deep">
            Order <span className="font-mono text-lg">{order.id.slice(0, 8)}</span>
          </h1>
          <div className="flex flex-wrap gap-3">
            {actions.map((a) => (
              <form key={a.status} action={setOrderStatusAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="status" value={a.status} />
                {/* Disables while pending, so a double click cannot send it twice. */}
                <SubmitButton className={a.status === "cancelled" ? "btn-secondary" : "btn-primary"}>
                  {a.label}
                </SubmitButton>
              </form>
            ))}
            <PrintButton />
            <Link href={`/admin/orders/${order.id}/label`} className="btn-secondary">
              Print postage label
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {order.paidAt ? (
            <>
              Sold <span className="font-semibold text-ink">{formatSaleDateTime(order.paidAt)}</span>{" "}
              UK time
            </>
          ) : (
            <>Not paid · checkout started {formatSaleDateTime(order.createdAt)} UK time</>
          )}
        </p>

        <dl className="card mt-6 grid gap-4 p-6 text-sm sm:grid-cols-4">
          <div>
            <dt className="label">Status</dt>
            <dd className="font-semibold capitalize">{order.status}</dd>
          </div>
          <div>
            <dt className="label">Payment</dt>
            <dd className="capitalize">{order.paymentMethod}</dd>
          </div>
          <div>
            <dt className="label">Gateway ref</dt>
            <dd className="font-mono text-xs">{order.paymentRef ?? "—"}</dd>
          </div>
          <div>
            <dt className="label">Provider</dt>
            <dd className="capitalize">{order.paymentProvider ?? "—"}</dd>
          </div>
        </dl>

        <div className="card mt-4 p-6 text-sm">
          <p className="label">Emails sent</p>
          {order.emailLogs.length === 0 ? (
            <p className="mt-1 text-ink-soft">None yet</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {order.emailLogs.map((e) => (
                <li key={e.id}>
                  <span className="font-medium capitalize">{e.type}</span>{" "}
                  <span className="text-ink-soft">
                    → {e.recipient} ·{" "}
                    {e.sentAt.toLocaleString("en-GB", {
                      timeZone: SHOP_TIME_ZONE,
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <OrderFulfilment order={order} isPacker={session?.role === "PACKER"} />
      </div>

      {/* Packing slip — the only thing that prints */}
      <div className="mt-8">
        <PackingSlip order={order} />
      </div>
    </div>
  );
}
