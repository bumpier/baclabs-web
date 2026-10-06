import Link from "next/link";
import { labelProblems } from "@/lib/shipping/shipments";

const SHOWN = 8;

/**
 * Paid orders whose label could not be bought automatically, each linking
 * straight to the order, where the label can be bought by hand once the
 * problem is fixed. Renders nothing when there are none. On the dashboard
 * and the orders page, not the admin layout: a layout is not re-rendered
 * when moving between pages, so it would keep showing fixed orders.
 */
export async function LabelWarning() {
  const orders = await labelProblems().catch((err: unknown) => {
    console.error("[internal] listing orders without a label failed", err);
    return [];
  });
  if (orders.length === 0) return null;

  return (
    <div role="alert" className="card mt-6 border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <p className="font-semibold">
        {orders.length === 1
          ? "1 paid order has no postage label"
          : `${orders.length} paid orders have no postage label`}
      </p>
      <p className="mt-1 opacity-80">
        The label could not be bought automatically. Open the order, sort out what it says, then
        buy the label there.
      </p>
      <ul className="mt-3 divide-y divide-red-200">
        {orders.slice(0, SHOWN).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <span className="min-w-0">
              <span className="font-mono">{o.id.slice(0, 8)}</span>
              {o.customerName ? ` · ${o.customerName}` : ""}
              <span className="block text-xs opacity-80">{o.labelError}</span>
            </span>
            <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-red-900">
              Open order →
            </Link>
          </li>
        ))}
      </ul>
      {orders.length > SHOWN && (
        <Link href="/admin/orders?status=paid" className="mt-2 inline-block font-semibold hover:text-red-900">
          See all {orders.length} →
        </Link>
      )}
    </div>
  );
}
