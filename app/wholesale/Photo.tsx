"use client";

import Image, { type ImageLoaderProps } from "next/image";
import type { Photo as PhotoData } from "@/brands/wholesale/copy/images";

/**
 * next/image for this brand's photographs. Its own optimiser cannot be used:
 * it fetches a local image internally, without the brand's Host, so the
 * host rewrite that maps /images/… to public/wholesale/images/… never runs
 * and it would find nothing. Each photo is on disk at three widths instead
 * (brands/wholesale/copy/images.ts), and this loader hands next/image the
 * narrowest copy at least as wide as it asks for, so the srcset, the sizes,
 * the lazy loading and the reserved space all still work.
 */
function loaderFor(photo: PhotoData) {
  return ({ width }: ImageLoaderProps) => {
    const w = photo.widths.find((x) => x >= width) ?? photo.width;
    return photo.src.replace(new RegExp(`-${photo.width}\\.webp$`), `-${w}.webp`);
  };
}

export function Photo({
  photo,
  sizes,
  priority = false,
  className,
  alt,
}: {
  photo: PhotoData;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** "" for a decorative copy (a thumbnail whose button carries the name). */
  alt?: string;
}) {
  return (
    <Image
      src={photo.src}
      loader={loaderFor(photo)}
      width={photo.width}
      height={photo.height}
      sizes={sizes}
      alt={alt ?? photo.alt}
      priority={priority}
      className={className}
    />
  );
}
