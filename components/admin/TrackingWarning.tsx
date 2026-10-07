import Link from "next/link";
import { NO_SCAN_WARNING_DAYS, trackingProblems } from "@/lib/shipping/tracking-sync";
import { formatSaleDate } from "@/lib/saleTime";

const SHOWN = 8;

/**
 * Parcels that need a look, from tracking (lib/shipping/tracking-sync.ts):
 * a delivery problem the carrier reported, or a label made days ago that
 * the carrier has never scanned. Renders nothing when there are none. On
 * the dashboard and the orders page, beside LabelWarning, for the same
 * reason it is not in the layout.
 */
export async function TrackingWarning({ showCatchUpLink = true }: { showCatchUpLink?: boolean }) {
  const { problems, notScanned } = await trackingProblems().catch((err: unknown) => {
    console.error("[internal] listing tracking problems failed", err);
    return { problems: [], notScanned: [] };
  });
  if (problems.length === 0 && notScanned.length === 0) return null;

  return (
    <div role="alert" className="card mt-6 border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
      {problems.length > 0 && (
        <>
          <p className="font-semibold">
            {problems.length === 1 ? "1 parcel has a delivery problem" : `${problems.length} parcels have a delivery problem`}
          </p>
          <ul className="mt-2 divide-y divide-amber-200">
            {problems.slice(0, SHOWN).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="font-mono">{s.order.id.slice(0, 8)}</span>
                  {s.order.customerName ? ` · ${s.order.customerName}` : ""}
                  {s.trackingEvent && <span className="block text-xs opacity-80">{s.trackingEvent}</span>}
                </span>
                <Link href={`/admin/orders/${s.order.id}`} className="font-semibold hover:text-amber-950">
                  Open order →
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {notScanned.length > 0 && (
        <>
          <p className={`font-semibold ${problems.length > 0 ? "mt-4" : ""}`}>
            {notScanned.length === 1
              ? `1 label made over ${NO_SCAN_WARNING_DAYS} days ago has not been scanned by the carrier`
              : `${notScanned.length} labels made over ${NO_SCAN_WARNING_DAYS} days ago have not been scanned by the carrier`}
          </p>
          <p className="mt-1 opacity-80">
            Either the parcel has not gone out, or tracking has not caught up with it yet.
            {showCatchUpLink && (
              <>
                {" "}
                Old orders can be cleared on the{" "}
                <Link href="/admin/shipping/catch-up" className="font-semibold underline hover:text-amber-950">
                  catch-up page
                </Link>
                .
              </>
            )}
          </p>
          <ul className="mt-2 divide-y divide-amber-200">
            {notScanned.slice(0, SHOWN).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="font-mono">{s.order.id.slice(0, 8)}</span>
                  {s.order.customerName ? ` · ${s.order.customerName}` : ""}
                  <span className="block text-xs opacity-80">Label made {formatSaleDate(s.createdAt)}</span>
                </span>
                <Link href={`/admin/orders/${s.order.id}`} className="font-semibold hover:text-amber-950">
                  Open order →
                </Link>
              </li>
            ))}
          </ul>
          {notScanned.length > SHOWN && <p className="mt-2 font-semibold">…and {notScanned.length - SHOWN} more.</p>}
        </>
      )}
    </div>
  );
}
