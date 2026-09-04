import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { brand, formatPrice, type Currency } from "@/config/brand";
import { setOrderStatusAction } from "@/app/admin/actions";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface OrderItem {
  name: string;
  qty: number;
  unitPrice: string;
}

interface Address {
  line1: string;
  line2: string | null;
  city: string;
  country: string;
  postalCode: string | null;
}

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

  const items = JSON.parse(order.items) as OrderItem[];
  // Card orders carry no address until the Stripe webhook backfills it, so a
  // pending card order legitimately has an empty string here.
  const address: Address = order.shippingAddress
    ? (JSON.parse(order.shippingAddress) as Address)
    : { line1: "", line2: null, city: "", country: "", postalCode: "" };
  const currency = order.currency as Currency;
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
                <button
                  type="submit"
                  className={a.status === "cancelled" ? "btn-secondary" : "btn-primary"}
                >
                  {a.label}
                </button>
              </form>
            ))}
            <PrintButton />
          </div>
        </div>

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
      </div>

      {/* Packing slip — the only thing that prints */}
      <div className="card print-area mt-8 p-10">
        <div className="flex items-start justify-between border-b border-line pb-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logo} alt="" className="h-10 w-10" />
            <div>
              <p className="font-display text-xl font-semibold text-brand-deep">{brand.name}</p>
              <p className="text-xs text-ink-soft">{brand.contact.email}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Packing slip</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">{order.id}</p>
            <p className="text-xs text-ink-soft">
              {order.createdAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="label">Ship to</p>
            <p className="text-sm font-medium">{order.customerName}</p>
            <p className="text-sm text-ink-soft">
              {address.line1}
              {address.line2 ? <><br />{address.line2}</> : null}
              <br />
              {address.city}
              {address.postalCode ? `, ${address.postalCode}` : ""}
              <br />
              {address.country}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="label">Contact</p>
            <p className="text-sm text-ink-soft">
              {order.customerPhone}
              <br />
              {order.customerEmail}
            </p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-center font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-3">{item.name}</td>
                <td className="py-3 text-center">{item.qty}</td>
                <td className="py-3 text-right">{formatPrice(item.unitPrice, currency)}</td>
                <td className="py-3 text-right font-medium">
                  {formatPrice(parseFloat(item.unitPrice) * item.qty, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <td colSpan={3} className="py-3 text-right font-semibold">
                Order total
              </td>
              <td className="py-3 text-right font-semibold text-brand-deep">
                {formatPrice(order.totalAmount.toString(), currency)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-10 border-t border-line pt-6 text-center text-sm italic text-ink-soft">
          {brand.packingSlipThankYou}
        </p>
      </div>
    </div>
  );
}
