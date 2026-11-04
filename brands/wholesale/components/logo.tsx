/**
 * Vialhouse's identity, hand-built as SVG: a server-safe module (no hooks),
 * so the header, footer, 404 and order acknowledgement render it as markup.
 *
 *  - The mark: a vial rack seen from above, five by three, with the V
 *    picked out. Filled cells take `on`, the empty ones are rings in `off`.
 *  - The wordmark: Overpass ExtraBold (Delve Fonts, SIL OFL 1.1) outlined,
 *    the V and i spaced by hand, and the i's dot a vial's flip-off cap seen
 *    from above. Outlines, not live text, so it is the same everywhere,
 *    the OG image included (app/wholesale/og/route.tsx).
 *
 * public/wholesale/icon.svg is the mark on a spruce tile, the V in signal
 * yellow; the Stripe PNGs beside it are rendered from these same shapes.
 */

/** The wordmark's outline, in its own units: 449.6 wide, cap height 70. */
export const WORDMARK_D = "M27.9 88.3 2.8 18.3H18.3L33.7 63.2Q34 64.1 34.3 65Q34.6 65.9 34.7 66.6Q34.8 66.1 35.1 65.2Q35.4 64.3 35.7 63.2L51 18.3H66.4L41.4 88.3Z M73 88.3V37.2H86.7V88.3Z M116.2 89.5Q107.8 89.5 102.9 85Q98 80.5 98 72.9Q98 67.9 100.6 64.1Q103.2 60.3 107.7 58.3Q112.3 56.2 118.5 56.2Q121.7 56.2 124.8 56.7Q127.9 57.3 130 58.3V55.3Q130 51.5 127.7 49.5Q125.4 47.5 121 47.5Q117.2 47.5 113.2 48.9Q109.3 50.2 105 52.9L100.9 42.3Q105.4 39.2 111 37.6Q116.5 36 122.3 36Q133 36 138.3 40.9Q143.5 45.9 143.5 55.8V88.3H130V84.4Q127.6 86.9 124 88.2Q120.5 89.5 116.2 89.5ZM119.6 78Q122.5 78 125.2 76.9Q127.9 75.9 130 73.9V68.8Q128 67.9 125.6 67.5Q123.2 67 120.7 67Q116.3 67 113.9 68.5Q111.4 70 111.4 72.8Q111.4 75.2 113.5 76.6Q115.7 78 119.6 78Z M157.3 88.3V22.3L171 16.1V88.3Z M185.8 88.3V22.4L199.5 16.1V42Q202 39 205.5 37.5Q208.9 36 213.4 36Q219 36 223 38.4Q227 40.7 229 45.1Q231.1 49.6 231.1 55.6V88.3H217.4V61.2Q217.4 54.9 215.4 52Q213.5 49.2 208.9 49.2Q204.1 49.2 201.8 52.1Q199.5 54.9 199.5 61V88.3Z M266 89.5Q255.1 89.5 248.8 82.4Q242.5 75.2 242.5 62.8Q242.5 54.6 245.4 48.6Q248.3 42.6 253.5 39.3Q258.8 36 266 36Q273.1 36 278.4 39.3Q283.6 42.5 286.5 48.5Q289.3 54.5 289.3 62.8Q289.3 71.1 286.5 77.1Q283.7 83 278.5 86.3Q273.2 89.5 266 89.5ZM266 76.3Q270.6 76.3 273.1 72.7Q275.6 69.2 275.6 62.8Q275.6 56.3 273.1 52.8Q270.5 49.2 266 49.2Q261.4 49.2 258.9 52.8Q256.3 56.4 256.3 62.8Q256.3 69.1 258.9 72.7Q261.4 76.3 266 76.3Z M318.2 89.5Q310 89.5 305.2 84.3Q300.5 79.1 300.5 69.9V37.2H314.2V64.2Q314.2 70.7 316.2 73.5Q318.2 76.3 322.8 76.3Q327.6 76.3 329.9 73.4Q332.1 70.5 332.1 64.4V37.2H345.8V88.3H332.1V83.6Q329.8 86.5 326.2 88Q322.7 89.5 318.2 89.5Z M377.3 89.5Q371.2 89.5 365.5 86.9Q359.9 84.3 356.7 79.9L365.5 72.4Q368.1 75 371.4 76.6Q374.7 78.2 377.8 78.2Q381.3 78.2 383.2 77.1Q385.1 75.9 385.1 73.8Q385.1 72.6 384.2 71.5Q383.3 70.5 380.9 69.3Q378.5 68.2 374 66.5Q365.3 63.4 361.7 59.7Q358.2 56.1 358.2 50.4Q358.2 43.9 363.4 40Q368.6 36 377 36Q382.7 36 387.5 38.2Q392.3 40.3 395.9 44.4L387 51.7Q382.5 47.3 376.7 47.3Q374 47.3 372.3 48.3Q370.5 49.3 370.5 50.9Q370.5 52.6 372.6 53.9Q374.6 55.2 380.4 57Q386.3 58.8 390.1 61.1Q393.9 63.5 395.7 66.6Q397.5 69.7 397.5 73.8Q397.5 81.2 392.1 85.3Q386.7 89.5 377.3 89.5Z M429.7 89.5Q422.2 89.5 416.8 86.2Q411.4 83 408.6 77Q405.7 71 405.7 62.7Q405.7 54.5 408.6 48.5Q411.6 42.5 417 39.2Q422.4 36 429.7 36Q436.1 36 441.2 38.6Q446.3 41.2 449.4 46.6Q452.4 52 452.4 60.2Q452.4 61.6 452.4 63.6Q452.3 65.5 452 67.5H419.1Q419.2 70.6 420.5 73Q421.9 75.3 424.2 76.5Q426.6 77.8 429.8 77.8Q433.5 77.8 436.2 76.6Q438.8 75.4 441.3 72.6L449.2 80.6Q445.7 84.6 440.9 87.1Q436.1 89.5 429.7 89.5ZM419.3 57H439.2Q438.9 54 437.7 51.9Q436.5 49.9 434.4 48.8Q432.4 47.7 429.4 47.7Q425.4 47.7 422.6 50.1Q419.8 52.5 419.3 57Z";
export const WORDMARK_VIEWBOX = "2.8 16.1 449.6 73.4";
/** The i's dot: a cap seen from above. */
export const WORDMARK_DOT = { cx: 79.83, cy: 23.4, r: 7.1 };

/** The rack's cells, row by row: true is a filled cell (the V). */
export const RACK: readonly (readonly boolean[])[] = [
  [true, false, false, false, true],
  [false, true, false, true, false],
  [false, false, true, false, false],
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

export function Wordmark({ fill, dot, className }: { fill: string; dot: string; className?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      <path fill={fill} d={WORDMARK_D} />
      <circle cx={WORDMARK_DOT.cx} cy={WORDMARK_DOT.cy} r={WORDMARK_DOT.r} fill={dot} />
    </svg>
  );
}

/**
 * The lockup: mark and wordmark side by side, the mark as tall as the
 * capitals. Colours are CSS custom properties, so one lockup serves the
 * light header and the spruce footer: --vh-logo-ink, --vh-logo-dot,
 * --vh-logo-on, --vh-logo-off.
 */
export function Lockup({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={`vh-lockup ${className ?? ""}`} role={label ? "img" : undefined} aria-label={label}>
      <Mark on="var(--vh-logo-on)" off="var(--vh-logo-off)" offOpacity={0.34} className="vh-lockup-mark" />
      <Wordmark fill="var(--vh-logo-ink)" dot="var(--vh-logo-dot)" className="vh-lockup-word" />
    </span>
  );
}
