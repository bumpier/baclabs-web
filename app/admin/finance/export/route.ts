import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { ORDER_CSV_HEADER, orderCsvLine, PERIOD_CSV_HEADER, periodCsvLine, toCsv } from "@/lib/finance/csv";
import { firstSaleDay, loadFinance } from "@/lib/finance/query";
import { adminBrandScope, ALL_BRANDS_SCOPE } from "@/lib/admin/brand-scope";
import { exportRange, parseExportRange, resolveRange } from "@/lib/finance/range";
import { shopDayKey } from "@/lib/saleTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The finance figures as a spreadsheet: one row per day/week/month
 * (level=period, as on /admin/finance) or one row per order (level=order).
 * Same range rules as the page, and the same brand scope
 * (lib/admin/brand-scope.ts): ?brand=, else the admin's cookie. Admins only.
 * The columns are in lib/finance/csv.ts.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const url = new URL(req.url);
  const today = shopDayKey(new Date());
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  // /admin/export asks for a range by name, and "all" may run past the
  // two-year cap resolveRange applies to the finance page.
  const exportId = from || to ? null : parseExportRange(url.searchParams.get("range"));
  const brand = await adminBrandScope(url.searchParams.get("brand"));
  const range = exportId
    ? exportRange(exportId, today, exportId === "all" ? await firstSaleDay(brand) : null)
    : resolveRange({ from, to, range: url.searchParams.get("range") ?? undefined }, today);
  const level = url.searchParams.get("level") === "order" ? "order" : "period";
  const f = await loadFinance(range.from, range.to, { compare: false, brand });

  const body =
    level === "period"
      ? toCsv(PERIOD_CSV_HEADER, f.buckets.map((b) => periodCsvLine(b, brand)))
      : toCsv(ORDER_CSV_HEADER, f.rows.map(orderCsvLine));
  // One brand's file says so in its name; every brand's is named as before.
  const which = brand === ALL_BRANDS_SCOPE ? "" : `-${brand}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-${level}s${which}-${f.from}-to-${f.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
