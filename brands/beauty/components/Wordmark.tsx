import { MARK, WORDMARK } from "./wordmark-paths";

/**
 * The wordmark: Rosarivo's outlines with the A's crossbar replaced by the
 * seal, the vial's blue cap seen from above. The letters take the text
 * colour; the seal is always the cap's blue (brands/beauty/styles.css
 * .au-seal-fill), the one cool note in the identity. `ring` adds the silver
 * crimp around it, for the sizes where it can be seen.
 *
 * Decorative unless given a `title`: the header's link names the brand
 * itself.
 */
export function Wordmark({ className, title, ring = false }: { className?: string; title?: string; ring?: boolean }) {
  const { cx, cy, r } = WORDMARK.seal;
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={WORDMARK.d} fill="currentColor" />
      {ring ? <circle className="au-crimp-fill" cx={cx} cy={cy} r={r + 18} /> : null}
      <circle className="au-seal-fill" cx={cx} cy={cy} r={r} />
    </svg>
  );
}

/** The mark: the A alone, with its seal. Always decorative. */
export function Mark({ className }: { className?: string }) {
  const { cx, cy, r } = MARK.seal;
  return (
    <svg viewBox={MARK.viewBox} className={className} aria-hidden="true" focusable="false">
      <path d={MARK.d} fill="currentColor" />
      <circle className="au-seal-fill" cx={cx} cy={cy} r={r + 6} />
    </svg>
  );
}

/** The seal on its own, as a full stop: sized by the text around it. */
export function Seal({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`au-seal ${className}`} />;
}

/**
 * A sentence whose full stop is the seal: the hero's promise, the order's
 * thank-you. The stop is dropped from the text and drawn instead, so the
 * words read the same to a screen reader.
 */
export function SealedLine({ text, sealClassName }: { text: string; sealClassName?: string }) {
  const words = text.replace(/\.$/, "");
  return (
    <>
      {words}
      <Seal className={sealClassName} />
    </>
  );
}
