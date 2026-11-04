/**
 * A box seen from above with its vials' caps showing, one cap per vial: how
 * the buy section shows what each size holds. The same square for every
 * size, because every pack is one Reserve No.10 box (lib/inventory/
 * brand-skus.ts); only the count of caps changes, and it is drawn from the
 * pack's own count, so a new size draws itself.
 *
 * Drawn in currentColor with hairlines that stay one pixel at any size, so
 * the option around it sets its colour and its chosen state. Decorative:
 * the option's label says the count in words.
 */
export function CapsDiagram({ vials, className = "" }: { vials: number; className?: string }) {
  const n = Math.max(1, Math.floor(vials));
  const cols = n <= 3 ? n : n <= 6 ? 3 : n <= 12 ? 4 : Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  // The tray is 76 units square inside the rim; each cap gets an equal cell.
  const tray = 76;
  const cell = Math.min(tray / cols, tray / rows);
  const r = Math.min(13, cell * 0.36);
  const left = 50 - (cols * cell) / 2 + cell / 2;
  const top = 50 - (rows * cell) / 2 + cell / 2;
  const caps = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    // A short last row is centred, as vials sit in a part-filled tray.
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const offset = ((cols - inRow) * cell) / 2;
    return { cx: left + offset + (i % cols) * cell, cy: top + row * cell };
  });

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="94" height="94" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <rect x="9" y="9" width="82" height="82" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.4" />
      {caps.map((c, i) => (
        <g key={i}>
          <circle cx={c.cx} cy={c.cy} r={r} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx={c.cx} cy={c.cy} r={r * 0.52} fill="currentColor" opacity="0.28" />
        </g>
      ))}
    </svg>
  );
}
