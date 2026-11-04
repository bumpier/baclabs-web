import type { CSSProperties } from "react";

/** Never more plates than this, so the biggest pack still fits its rung. */
const MAX_PLATES = 12;

/**
 * How many plates a pack is drawn with: one per smallest pack's worth of
 * vials, so the graphic is the pack's real size against the others (a 50 is
 * ten 5s) and never decoration.
 */
export function plateCount(vials: number, unit: number): number {
  if (unit <= 0) return 1;
  return Math.max(1, Math.min(MAX_PLATES, Math.round(vials / unit)));
}

/**
 * A pack drawn as plates. On a phone each rung shows them loaded on a
 * barbell sleeve, side on; from the large breakpoint up they stack flat on
 * the floor, bottom-aligned across the four rungs, so the ladder reads as a
 * staircase. Both are the same spans, laid out by CSS (.gym-plates in
 * brands/gym/styles.css).
 *
 * Decorative: the rung's text already says how many vials, so it is hidden
 * from assistive technology.
 */
export function Plates({ count, max }: { count: number; max: number }) {
  return (
    <span className="gym-plates" aria-hidden="true" style={{ "--plates-max": max } as CSSProperties}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="gym-plate" />
      ))}
    </span>
  );
}
