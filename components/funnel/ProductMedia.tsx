import { VialImage } from "@/components/funnel/VialImage";

/**
 * The product photo, as the left-hand column of a Shopify-style buy section.
 * Edge to edge in a hairline frame: the photograph carries its own light
 * studio ground, so it needs no padding card around it. On a phone it is
 * capped well short of full width, so the price follows close behind it
 * instead of a screen later.
 */
export function ProductMedia({ priority = false }: { priority?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[15rem] overflow-hidden rounded-panel border border-line bg-neutral sm:max-w-sm lg:max-w-none">
      <VialImage priority={priority} sizes="(min-width: 1024px) 34rem, (min-width: 640px) 24rem, 15rem" />
    </div>
  );
}
