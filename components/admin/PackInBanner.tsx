import { BrandChip } from "@/components/admin/BrandChip";
import type { BrandChipData } from "@/lib/admin/brand-chip";

/**
 * "Pack in: …" for the packer, when the order's brand ships in its own box
 * or insert (brand.shipping.packingNote). Large on purpose: the wrong box is
 * the one mistake the customer sees first. The caller renders nothing when
 * the brand has no note, so BacLab's screens are unchanged.
 */
export function PackInBanner({ chip, note, className = "" }: { chip: BrandChipData; note: string; className?: string }) {
  return (
    <div
      role="note"
      className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 border-brand-deep bg-white px-6 py-4 text-brand-deep ${className}`}
    >
      <BrandChip chip={chip} className="text-xs" />
      <p className="text-xl font-semibold leading-snug sm:text-2xl">Pack in: {note}</p>
    </div>
  );
}
