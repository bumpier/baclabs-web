import { getImageProps, type ImageLoaderProps } from "next/image";
import type { Photo } from "../copy/images";

/**
 * A photograph's <img> attributes, from next/image (getImageProps), with a
 * loader that picks the ready-made WebP copy for each width instead of
 * Next's optimiser.
 *
 * Why not the optimiser: /_next/image fetches the source by its path on
 * this server without the host rewrite, so a brand's /images/... (served
 * from public/luxury/ only on the brand's own host) never reaches it. The
 * copies are made once, with sharp, when the photographs change
 * (copy/images.ts), and every one is a static file the host rewrite serves.
 *
 * Server-only by use: it returns plain attributes (src, srcSet, sizes,
 * width, height, loading...), which a client component may take as a prop.
 */
export function photoProps(
  photo: Photo,
  opts: { sizes: string; priority?: boolean; className?: string }
): React.ImgHTMLAttributes<HTMLImageElement> {
  const loader = ({ src, width }: ImageLoaderProps) => {
    const copy = photo.widths.find((w) => w >= width);
    return copy && copy < photo.width ? src.replace(/\.webp$/, `-${copy}.webp`) : src;
  };
  const { props } = getImageProps({
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    sizes: opts.sizes,
    loader,
    className: opts.className,
    ...(opts.priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {}),
  });
  return props;
}

/**
 * The hero's art direction: the wide photograph from 700px up, the tall one
 * below, as one <picture>. Returns the <source>'s srcSet and the <img>'s
 * attributes (the tall photograph's, which phones load first).
 */
export function artDirected(wide: Photo, tall: Photo, sizes: string) {
  const desktop = photoProps(wide, { sizes, priority: true });
  const phone = photoProps(tall, { sizes, priority: true });
  return { media: "(min-width: 700px)", srcSet: desktop.srcSet ?? "", img: phone };
}
