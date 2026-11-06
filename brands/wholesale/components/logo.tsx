/**
 * BulkBac's identity, hand-built as SVG: a server-safe module (no hooks),
 * so the header, footer, 404 and order acknowledgement render it as markup.
 *
 *  - The mark: a vial rack seen from above, five by three, with a rising
 *    step picked out, the way a bigger pack steps the per-vial price down.
 *    Filled cells take `on`, the empty ones are rings in `off`.
 *  - The wordmark: Overpass ExtraBold (Delve Fonts, SIL OFL 1.1) outlined,
 *    the k and B and the B and u spaced by hand. Outlines, not live text, so
 *    it is the same everywhere, the OG image included
 *    (app/wholesale/og/route.tsx).
 *
 * public/wholesale/icon.svg is the mark on a spruce tile, the step in
 * signal yellow; the Stripe PNGs beside it are rendered from these same
 * shapes.
 */

/** The wordmark's outline, in its own units: 379 wide, cap height 70. */
export const WORDMARK_D = "M7.8 88.3V18.3H39.8Q48.4 18.3 53.4 21.1Q58.4 23.8 60.6 28.1Q62.7 32.5 62.7 37.2Q62.7 41.9 60.9 45.8Q59 49.7 54.5 51.7Q58.2 53.1 60.6 55.7Q62.9 58.2 64 61.3Q65.1 64.5 65.1 67.5Q65.1 71.2 63.8 74.9Q62.5 78.7 59.7 81.7Q56.9 84.7 52.4 86.5Q47.8 88.3 41.2 88.3ZM22.2 74.8H41.9Q45.2 74.8 47.1 73.6Q49 72.4 49.8 70.7Q50.5 69 50.5 67.3Q50.5 65.2 49.6 63.3Q48.8 61.3 46.3 60.1Q43.8 58.9 39.1 58.9H22.2ZM22.2 45.9H38.3Q43.3 45.9 45.7 44Q48.1 42 48.1 38.7Q48.1 37.1 47.5 35.5Q46.9 33.8 45.2 32.8Q43.4 31.7 40 31.7H22.2Z M93.5 89.5Q85.3 89.5 80.5 84.3Q75.8 79.1 75.8 69.9V37.2H89.5V64.2Q89.5 70.7 91.5 73.5Q93.5 76.3 98.1 76.3Q102.9 76.3 105.2 73.4Q107.4 70.5 107.4 64.4V37.2H121.1V88.3H107.4V83.6Q105.1 86.5 101.5 88Q98 89.5 93.5 89.5Z M136 88.3V22.3L149.7 16.1V88.3Z M164.5 88.3V22.5L178.2 16.1V50.7L191.6 37.2H207.9L192.6 52.1L211.3 88.3H196.4L182.5 62L178.2 66V88.3Z M218.3 88.3V18.3H250.2Q258.9 18.3 263.9 21.1Q268.9 23.8 271 28.1Q273.2 32.5 273.2 37.2Q273.2 41.9 271.3 45.8Q269.5 49.7 264.9 51.7Q268.7 53.1 271 55.7Q273.3 58.2 274.4 61.3Q275.5 64.5 275.5 67.5Q275.5 71.2 274.2 74.9Q273 78.7 270.2 81.7Q267.4 84.7 262.8 86.5Q258.2 88.3 251.6 88.3ZM232.6 74.8H252.4Q255.7 74.8 257.6 73.6Q259.5 72.4 260.2 70.7Q261 69 261 67.3Q261 65.2 260.1 63.3Q259.2 61.3 256.7 60.1Q254.3 58.9 249.6 58.9H232.6ZM232.6 45.9H248.7Q253.8 45.9 256.2 44Q258.6 42 258.6 38.7Q258.6 37.1 258 35.5Q257.4 33.8 255.6 32.8Q253.9 31.7 250.4 31.7H232.6Z M303.2 89.5Q294.8 89.5 289.9 85Q285 80.5 285 72.9Q285 67.9 287.6 64.1Q290.2 60.3 294.7 58.3Q299.3 56.2 305.5 56.2Q308.7 56.2 311.8 56.7Q314.9 57.3 317 58.3V55.3Q317 51.5 314.7 49.5Q312.4 47.5 308 47.5Q304.2 47.5 300.2 48.9Q296.3 50.2 292 52.9L287.9 42.3Q292.4 39.2 298 37.6Q303.5 36 309.3 36Q320 36 325.3 40.9Q330.5 45.9 330.5 55.8V88.3H317V84.4Q314.6 86.9 311 88.2Q307.5 89.5 303.2 89.5ZM306.6 78Q309.5 78 312.2 76.9Q314.9 75.9 317 73.9V68.8Q315 67.9 312.6 67.5Q310.2 67 307.7 67Q303.3 67 300.9 68.5Q298.4 70 298.4 72.8Q298.4 75.2 300.5 76.6Q302.7 78 306.6 78Z M364.8 89.5Q357.6 89.5 352.3 86.3Q347 83 344.2 77Q341.3 71 341.3 62.8Q341.3 54.6 344.2 48.6Q347.1 42.6 352.4 39.3Q357.7 36 364.9 36Q373.3 36 378.8 39.9Q384.3 43.8 386.7 51.4L373.6 55.8Q372.4 52.6 370.2 50.9Q368 49.1 365.1 49.1Q360.7 49.1 358 52.9Q355.2 56.7 355.2 62.8Q355.2 68.9 357.9 72.6Q360.5 76.3 364.9 76.3Q368 76.3 370.3 74.5Q372.6 72.6 373.7 69L386.8 72.8Q384.4 81.1 378.9 85.3Q373.3 89.5 364.8 89.5Z";
export const WORDMARK_VIEWBOX = "7.8 16.1 379 73.4";

/** The rack's cells, row by row: true is a filled cell (the step). */
export const RACK: readonly (readonly boolean[])[] = [
  [false, false, false, false, true],
  [false, false, true, true, false],
  [true, true, false, false, false],
];

/** The mark's circles in a 50 × 30 box, pitch 10. */
export function rackCircles(): { cx: number; cy: number; filled: boolean }[] {
  return RACK.flatMap((row, r) => row.map((filled, c) => ({ cx: 5 + c * 10, cy: 5 + r * 10, filled })));
}

export function Mark({ on, off, offOpacity = 0.42, className }: { on: string; off: string; offOpacity?: number; className?: string }) {
  return (
    <svg viewBox="0 0 50 30" className={className} aria-hidden="true" focusable="false">
      {rackCircles().map(({ cx, cy, filled }) =>
        filled ? (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={on} />
        ) : (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="none" stroke={off} strokeWidth={1.3} opacity={offOpacity} />
        )
      )}
    </svg>
  );
}

export function Wordmark({ fill, className }: { fill: string; className?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      <path fill={fill} d={WORDMARK_D} />
    </svg>
  );
}

/**
 * The lockup: mark and wordmark side by side, the mark as tall as the
 * capitals. Colours are CSS custom properties, so one lockup serves the
 * light header and the spruce footer: --bk-logo-ink, --bk-logo-on,
 * --bk-logo-off.
 */
export function Lockup({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={`bk-lockup ${className ?? ""}`} role={label ? "img" : undefined} aria-label={label}>
      <Mark on="var(--bk-logo-on)" off="var(--bk-logo-off)" offOpacity={0.34} className="bk-lockup-mark" />
      <Wordmark fill="var(--bk-logo-ink)" className="bk-lockup-word" />
    </span>
  );
}
