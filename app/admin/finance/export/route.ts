import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { packName } from "@/lib/finance/ledger";
import { loadFinance } from "@/lib/finance/query";
import { resolveRange } from "@/lib/finance/range";
import { formatSaleDateTime, shopDayKey } from "@/lib/saleTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Quote a CSV cell, and defuse spreadsheet formulas (=, +, -, @ at the start).
 * A plain number is left alone, so a negative amount stays a number.
 */
function cell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) && !/^-\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}

/** Pounds with two decimals, the way a spreadsheet reads money: "12.34", "-3.10". */
const money = (minor: number) => (minor / 100).toFixed(2);

/**
 * The finance figures as a spreadsheet: one row per day/week/month
 * (level=period, as on /admin/finance) or one row per order (level=order).
 * Same range rules as the page; admins only.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const url = new URL(req.url);
  const range = resolveRange(
    {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      range: url.searchParams.get("range") ?? undefined,
    },
    shopDayKey(new Date())
  );
  const level = url.searchParams.get("level") === "order" ? "order" : "period";
  const f = await loadFinance(range.from, range.to, { compare: false });

  let header: string[];
  let lines: string[][];
  if (level === "period") {
    header = ["period", "from", "to", "orders", "vials", "welcome_vials", "order_value", "delivery", "taken", "discounts", "vat", "postage", "postage_cancelled_orders", "packages", "fulfilment", "after_shipping_costs", "cancelled_orders", "cancelled_value"];
    lines = f.buckets.map((b) => {
      const t = b.totals;
      return [
        b.label,
        b.from,
        b.to,
        String(t.orders),
        String(t.vials),
        String(t.welcomeVials),
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
      ];
    });
  } else {
    header = ["order_id", "kind", "paid_at", "day", "status", "customer_name", "customer_email", "customer", "pack", "vials", "welcome_vials", "delivery_option", "order_value", "delivery", "taken", "discount", "vat", "postage", "postage_status", "packages", "fulfilment", "after_shipping_costs"];
    lines = f.rows.map((r) => [
      r.id,
      r.kind,
      formatSaleDateTime(r.saleTime),
      r.day,
      r.status,
      r.customerName,
      r.customerEmail,
      r.customer,
      packName(r.pack),
      String(r.vials),
      String(r.welcomeVials),
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
    ]);
  }

  const body = [header.join(","), ...lines.map((l) => l.map(cell).join(","))].join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-${level}s-${f.from}-to-${f.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
