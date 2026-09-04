/* Plain <img>, with a drawn vial when no image is set.
   Product images are local files, so next/image optimisation is skipped
   deliberately to keep the stack self-contained.

   The placeholder used to be a leaf — left over from a botanical product and
   the last surviving piece of an identity this storefront explicitly rejects
   (see app/fonts.ts on why a wellness register is wrong for lab supply). It
   is now the same object the storefront sells, drawn as a simplified form of
   the mark in components/funnel/VialImage.tsx. */

export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-tint ${className ?? ""}`}
        role="img"
        aria-label={alt}
      >
        <svg width="64" height="64" viewBox="0 0 44 44" fill="none" className="opacity-30">
          {/* Crimped cap. */}
          <rect x="17" y="7" width="10" height="5" rx="1.5" fill="var(--color-brand)" />
          {/* Glass body: short neck, flared shoulder, rounded base. */}
          <path
            d="M18.5 12v3l-4 4.5V35a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V19.5l-4-4.5v-3"
            stroke="var(--color-brand)"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />
          {/* The fill line — the one thing this product is measured by. */}
          <path d="M14.5 23h15" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
