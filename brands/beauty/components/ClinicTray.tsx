/**
 * A clinic pack, drawn from above: a porcelain tray holding one plum vial
 * top in a rose-gold crimp for every vial in the pack, 5 by 5, 10 by 5 or
 * 10 by 10, so the sizes compare at a glance. Re-keyed on the count; with
 * `animate`, choosing another size settles its vials into the tray
 * (.au-settle; still under reduced motion).
 *
 * Presentational only, so a client component can render it.
 *
 * TODO(launch): photography. A photograph of an opened clinic pack, seen
 * from above, can take this drawing's place.
 */

const CELL = 28;
const PAD = 14;

function gridFor(count: number): { cols: number; rows: number } {
  const cols = count <= 25 ? 5 : 10;
  return { cols, rows: Math.ceil(count / cols) };
}

export function ClinicTray({
  count,
  idPrefix,
  label,
  animate = false,
}: {
  count: number;
  idPrefix: string;
  label: string;
  /** Settle the vials in: only once the visitor has chosen another size, never on first paint. */
  animate?: boolean;
}) {
  const p = idPrefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const { cols, rows } = gridFor(count);
  const w = cols * CELL + PAD * 2;
  const h = rows * CELL + PAD * 2;
  const x0 = (320 - w) / 2;
  const y0 = (320 - h) / 2;
  const cells = Array.from({ length: count }, (_, i) => ({
    cx: x0 + PAD + (i % cols) * CELL + CELL / 2,
    cy: y0 + PAD + Math.floor(i / cols) * CELL + CELL / 2,
  }));

  return (
    <svg viewBox="0 0 320 320" role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <radialGradient id={`${p}-crimp`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#F3D8CD" />
          <stop offset="0.55" stopColor="#C49383" />
          <stop offset="1" stopColor="#8F5C4F" />
        </radialGradient>
        <radialGradient id={`${p}-top`} cx="0.38" cy="0.34" r="0.75">
          <stop offset="0" stopColor="#6B3459" />
          <stop offset="0.6" stopColor="#3B1730" />
          <stop offset="1" stopColor="#260C1F" />
        </radialGradient>
        <linearGradient id={`${p}-tray`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EFE5E8" />
        </linearGradient>
        <filter id={`${p}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <g key={count}>
        <rect x={x0 + 6} y={y0 + 14} width={w - 12} height={h - 6} rx="22" fill="#3B1730" opacity="0.16" filter={`url(#${p}-blur)`} />
        <rect x={x0} y={y0} width={w} height={h} rx="22" fill={`url(#${p}-tray)`} stroke="#E6D0CC" />
        {cells.map((c, i) => (
          <g key={i} transform={`translate(${c.cx} ${c.cy})`}>
            <g className={animate ? "au-settle" : undefined} style={animate ? { ["--i" as string]: i } : undefined}>
              <circle r="11.5" fill={`url(#${p}-crimp)`} />
              <circle r="7.6" fill={`url(#${p}-top)`} />
              <ellipse cx="-2.6" cy="-3" rx="2.6" ry="1.6" fill="#FFFFFF" opacity="0.3" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
