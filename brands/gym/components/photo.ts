import { getImageProps } from "next/image";
import { photoAt, type Photo } from "@/brands/gym/copy/images";

/** A srcSet of a photograph's made-ahead copies and its original. */
export function photoSrcSet(photo: Photo): string {
  return [...photo.widths.map((w) => `${photoAt(photo, w)} ${w}w`), `${photo.src} ${photo.width}w`].join(", ");
}

/**
 * A photograph's <img> attributes from next/image (getImageProps: width and
 * height, so the space is held and nothing shifts, lazy loading, async
 * decoding), with the srcSet of its made-ahead WebP copies in place of Next's
 * optimiser, which cannot reach a brand's files (brands/gym/copy/images.ts
 * says why). The browser picks the copy for the slot from `sizes`.
 *
 * Server-only by use: it returns plain attributes.
 */
export function photoProps(
  photo: Photo,
  opts: { sizes: string; priority?: boolean; className?: string }
): React.ImgHTMLAttributes<HTMLImageElement> {
  const { props } = getImageProps({
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    unoptimized: true,
    className: opts.className,
    ...(opts.priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {}),
  });
  return { ...props, srcSet: photoSrcSet(photo), sizes: opts.sizes };
}
