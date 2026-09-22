import type { Order } from "@prisma/client";
import { brand, formatPrice, type Currency } from "@/config/brand";
import { parseAddress, type Address } from "@/lib/orderAddress";

interface OrderItem {
  name: string;
  qty: number;
  unitPrice: string;
  /** Exact line total. Falls back to unitPrice × qty for orders placed before this field existed. */
  lineTotal?: string;
}

/** The A4 sheet that goes in the box. Shared by the order page and the batch print. */
export function PackingSlip({ order }: { order: Order }) {
  const items = JSON.parse(order.items) as OrderItem[];
  const address: Address = parseAddress(order) ?? {
    line1: "",
    line2: null,
    city: "",
    country: "",
    postalCode: "",
  };
  const currency = order.currency as Currency;

  return (
    <div className="card print-area p-10">
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
                {formatPrice(
                  item.lineTotal ? parseFloat(item.lineTotal) : parseFloat(item.unitPrice) * item.qty,
                  currency
                )}
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
  );
}
