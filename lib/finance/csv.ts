import type { BrandScope } from "@/lib/admin/brand-scope";
import { packName, type Bucket, type LedgerRow } from "@/lib/finance/ledger";
import { formatSaleDateTime } from "@/lib/saleTime";

/**
 * The finance CSVs behind /admin/finance/export: one row per day/week/month
 * (period) or one row per order (order). Columns are only ever added at the
 * end, so a spreadsheet built on an older export keeps its columns: `brand`
 * came last when brands arrived.
 */

/**
 * Quote a CSV cell, and defuse spreadsheet formulas (=, +, -, @ at the start).
 * A plain number is left alone, so a negative amount stays a number.
 */
export function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) && !/^-\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}

/** Pounds with two decimals, the way a spreadsheet reads money: "12.34", "-3.10". */
const money = (minor: number) => (minor / 100).toFixed(2);

export const PERIOD_CSV_HEADER = [
  "period",
  "from",
  "to",
  "orders",
  "vials",
  "welcome_vials",
  "gift_vials",
  "order_value",
  "delivery",
  "taken",
  "discounts",
  "vat",
  "postage",
  "postage_cancelled_orders",
  "packages",
  "fulfilment",
  "after_shipping_costs",
  "cancelled_orders",
  "cancelled_value",
  // The brand scope the totals cover: "all" or one brand id.
  "brand",
] as const;

export function periodCsvLine(b: Bucket, brand: BrandScope): string[] {
  const t = b.totals;
  return [
    b.label,
    b.from,
    b.to,
    String(t.orders),
    String(t.vials),
    String(t.welcomeVials),
    String(t.giftVials),
    money(t.goodsMinor),
    money(t.deliveryMinor),
    money(t.takenMinor),
    money(t.discountMinor),
    money(t.vatMinor),
    money(t.postageMinor),
    money(t.cancelledLabelMinor),
    String(t.packages),
    money(t.fulfilmentMinor),
    money(t.afterCostsMinor),
    String(t.cancelledOrders),
    money(t.cancelledMinor),
    brand,
  ];
}

export const ORDER_CSV_HEADER = [
  "order_id",
  "kind",
  "paid_at",
  "day",
  "status",
  "customer_name",
  "customer_email",
  "customer",
  "pack",
  "vials",
  "welcome_vials",
  "gift_vials",
  "delivery_option",
  "order_value",
  "delivery",
  "taken",
  "discount",
  "vat",
  "postage",
  "postage_status",
  "packages",
  "fulfilment",
  "after_shipping_costs",
  // The order's brand id.
  "brand",
] as const;

export function orderCsvLine(r: LedgerRow): string[] {
  return [
    r.id,
    r.kind,
    formatSaleDateTime(r.saleTime),
    r.day,
    r.status,
    r.customerName,
    r.customerEmail,
    r.customer,
    // Read against the order's own brand's catalogue (lib/finance/ledger.ts).
    packName(r.pack, r.brand),
    String(r.vials),
    String(r.welcomeVials),
    String(r.giftVials),
    r.deliveryOption ?? "",
    money(r.goodsMinor),
    money(r.deliveryMinor),
    money(r.takenMinor),
    r.discountMinor === null ? "" : money(r.discountMinor),
    money(r.vatMinor),
    money(r.postageMinor),
    r.postageStatus,
    String(r.packages),
    money(r.fulfilmentMinor),
    money(r.afterCostsMinor),
    r.brand,
  ];
}

/** Header row unquoted, as before; every data cell quoted; CRLF line ends. */
export function toCsv(header: readonly string[], lines: readonly string[][]): string {
  return [header.join(","), ...lines.map((l) => l.map(csvCell).join(","))].join("\r\n") + "\r\n";
}
