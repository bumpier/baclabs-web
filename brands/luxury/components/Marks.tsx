import { SEAL, WORDMARK } from "./mark-paths";

/**
 * LuxeVial's two marks, drawn from path data (mark-paths.ts), so they
 * render the same before the faces load and in every place they appear.
 *
 * The wordmark is one colour, the text's (currentColor). The seal is wax
 * and impression: the disc takes --lv-wax (claret unless a parent says
 * otherwise) and the ring and the L take --lv-impression (bone). Both are
 * decorative unless given a `title`, in which case they are an image with
 * that name (a link around the wordmark names it instead).
 *
 * The seal is the site's one device, drawn on the page only (the parcel is
 * a plain box and carries none): the favicon, the bag's count, the chosen
 * size, the order card and the 404 all carry it.
 */
export function Wordmark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={`0 -4 ${WORDMARK.width} 108`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={WORDMARK.d} fill="currentColor" />
    </svg>
  );
}

export function Seal({ className, title, plain = false }: { className?: string; title?: string; plain?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={SEAL.edge} fill="var(--lv-wax, #4A1424)" />
      <path d={SEAL.ring} fill="var(--lv-impression, #F1E9E6)" />
      {plain ? null : <path d={SEAL.initial} fill="var(--lv-impression, #F1E9E6)" />}
    </svg>
  );
}
