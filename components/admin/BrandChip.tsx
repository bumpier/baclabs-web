import type { BrandChipData } from "@/lib/admin/brand-chip";

/**
 * A row's brand, as a small chip: the short code on the brand's colour, its
 * name on hover and for screen readers. Takes plain data (brandChip() in
 * lib/admin/brand-chip.ts), so server and client components can both use it.
 */
export function BrandChip({ chip, className = "" }: { chip: BrandChipData; className?: string }) {
  return (
    <span
      title={chip.name}
      style={{ backgroundColor: chip.background, color: chip.color }}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase leading-4 tracking-wider ${className}`}
    >
      <span aria-hidden="true">{chip.shortCode}</span>
      <span className="sr-only">{chip.name}</span>
    </span>
  );
}
