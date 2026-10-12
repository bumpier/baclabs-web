import Link from "next/link";
import { LOW_STOCK_VIALS, loadVialStock, type VialStock } from "@/lib/vial-stock";

/**
 * Shown once the vial count (lib/vial-stock.ts) is down to LOW_STOCK_VIALS
 * or fewer, red once it has run out. Renders nothing above that, or before
 * any stock is booked in. On the dashboard, the orders page (admins only)
 * and /admin/stock, not the layout, for the reason LabelWarning gives.
 */
export async function LowStockWarning({
  stock,
  showLink = true,
}: {
  /** Pass it when the page has already loaded it. */
  stock?: VialStock;
  showLink?: boolean;
}) {
  const s =
    stock ??
    (await loadVialStock().catch((err: unknown) => {
      console.error("[internal] working out the vial count failed", err);
      return null;
    }));
  if (!s || s.since === null || !s.low) return null;

  const out = s.left <= 0;
  return (
    <div
      role="alert"
      className={`card mt-6 p-5 text-sm ${out ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
    >
      <p className="font-semibold">
        {out
          ? `The vial count has run out (${s.left.toLocaleString("en-GB")})`
          : `You have ${s.left.toLocaleString("en-GB")} vial${s.left === 1 ? "" : "s"} left`}
      </p>
      <p className="mt-1 opacity-80">
        {out
          ? "Orders since the count started have taken every vial booked in. Book in the delivery that arrived, or correct the count."
          : `That's at or under ${LOW_STOCK_VIALS}.${s.daysLeft !== null ? ` At the last two weeks' rate (about ${Math.round(s.perDay)} a day) that's roughly ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} of orders.` : ""} Time to order more.`}
        {showLink && (
          <>
            {" "}
            <Link href="/admin/stock" className="font-semibold underline">
              Vial stock →
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
