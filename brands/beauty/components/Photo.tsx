"use client";

import Image, { type ImageLoaderProps } from "next/image";
import type { BrandImage } from "@/brands/beauty/copy/images";

/**
 * The widths each photograph is stored at, beside its original in
 * public/beauty/images/: <name>-480.webp and <name>-960.webp. The loader
 * hands next/image the smallest that covers the width it asks for, so a
 * phone never fetches the full file, and the srcset is real.
 *
 * Why not the built-in optimiser: it fetches a local image from inside the
 * server, without the host rewrite in middleware.ts, so it cannot see a
 * brand's public/<id>/ files at their site paths (/_next/image answers 400).
 * These are already WebP, sized and compressed.
 */
function variant({ src, width }: ImageLoaderProps): string {
  if (width <= 480) return src.replace(/\.webp$/, "-480.webp");
  if (width <= 960) return src.replace(/\.webp$/, "-960.webp");
  return src;
}

/**
 * One of the brand's photographs (copy/images.ts) through next/image: its
 * intrinsic size reserves the space, `sizes` picks the width to fetch, and
 * only a page's first photograph is fetched eagerly (`priority`). `fill`
 * covers a frame whose shape the page decides (the frame must be
 * positioned); `className` sets the crop's focus (object-position).
 *
 * A client component only because the loader is a function, which cannot
 * cross from a server component to next/image.
 */
export function Photo({
  image,
  sizes,
  className = "",
  fill = false,
  priority = false,
  alt,
}: {
  image: BrandImage;
  sizes: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  /** "" for a picture that repeats what the text beside it says. */
  alt?: string;
}) {
  const common = {
    src: image.src,
    alt: alt ?? image.alt,
    sizes,
    priority,
    loader: variant,
    className: `${fill ? "object-cover" : "h-auto w-full"} ${className}`,
  };
  return fill ? <Image {...common} fill /> : <Image {...common} width={image.width} height={image.height} />;
}
