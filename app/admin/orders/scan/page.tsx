import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { ScanStation } from "@/app/admin/orders/scan/ScanStation";

export const dynamic = "force-dynamic";

/**
 * The packing bench. A USB or Bluetooth scanner types into the box and
 * presses Enter, exactly like a keyboard, so no driver or setup is needed:
 * plug it in, open this page, scan.
 */
export default async function ScanStationPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href="/admin/orders" className="text-sm text-ink-soft hover:text-brand-deep">← Orders</Link>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Scan station</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Scan the barcode on the pick label, then each shelf or item as it is picked. A high beep is right, a
        low buzz is wrong — nothing is counted for a wrong scan. A shelf scan counts everything the pick
        label says to take from that shelf; an item scan counts one.
      </p>
      <div className="mt-8">
        <ScanStation />
      </div>
    </div>
  );
}
