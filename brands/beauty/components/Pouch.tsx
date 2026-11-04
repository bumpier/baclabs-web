/**
 * A set of the Essentials, drawn: a blush silk drawstring pouch, frilled at
 * the opening and cinched with a rose-gold cord and bow, the plum tops of
 * its vials showing above the frill, one for each vial in the set.
 *
 * Re-keyed on the count. With `animate` (set once the visitor has chosen
 * another set, never on first paint) the new set's vials lift into the
 * pouch (.au-rise; still under reduced motion).
 *
 * Presentational only (no hooks), so a client component can render it.
 * `idPrefix` keeps its gradient ids apart from any other drawing's.
 *
 * TODO(launch): photography. A photograph of each set in its pouch can take
 * this drawing's place, one per set.
 */

type Cap = { x: number; y: number };

/** Where the vial tops sit for each set size, back row first. */
function capsFor(count: number): Cap[] {
  if (count <= 1) return [{ x: 120, y: 54 }];
  if (count === 3) {
    return [
      { x: 96, y: 62 },
      { x: 144, y: 62 },
      { x: 120, y: 52 },
    ];
  }
  return [
    { x: 94, y: 56 },
    { x: 146, y: 56 },
    { x: 120, y: 48 },
    { x: 107, y: 68 },
    { x: 133, y: 68 },
  ];
}

export function Pouch({
  count,
  idPrefix,
  label,
  animate = false,
  className = "h-auto w-full",
}: {
  count: number;
  idPrefix: string;
  label: string;
  animate?: boolean;
  className?: string;
}) {
  const p = idPrefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const caps = capsFor(count);
  return (
    <svg viewBox="0 0 240 260" role="img" aria-label={label} className={className}>
      <defs>
        <linearGradient id={`${p}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#D49D95" />
          <stop offset="0.2" stopColor="#F3D9D4" />
          <stop offset="0.4" stopColor="#E4BAB3" />
          <stop offset="0.58" stopColor="#FAEAE6" />
          <stop offset="0.8" stopColor="#E1B4AD" />
          <stop offset="1" stopColor="#CC948C" />
        </linearGradient>
        <linearGradient id={`${p}-frill`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#DFAEA7" />
          <stop offset="0.25" stopColor="#F8E5E1" />
          <stop offset="0.5" stopColor="#E8C1BA" />
          <stop offset="0.75" stopColor="#F8E5E1" />
          <stop offset="1" stopColor="#D9A69E" />
        </linearGradient>
        <linearGradient id={`${p}-rose`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9C675B" />
          <stop offset="0.3" stopColor="#E9C5B7" />
          <stop offset="0.6" stopColor="#B98576" />
          <stop offset="1" stopColor="#F0D2C6" />
        </linearGradient>
        <linearGradient id={`${p}-flip`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2C1025" />
          <stop offset="0.4" stopColor="#5A2A4A" />
          <stop offset="1" stopColor="#2A0F23" />
        </linearGradient>
        <filter id={`${p}-blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <ellipse cx="120" cy="249" rx="78" ry="7" fill="#3B1730" opacity="0.14" filter={`url(#${p}-blur)`} />
      {/* The inside of the opening, in shadow. */}
      <ellipse cx="120" cy="96" rx="58" ry="11" fill="#BF8981" />

      <g key={count}>
        {caps.map((c, i) => (
          <g key={`${c.x}-${c.y}`} transform={`translate(${c.x} ${c.y})`}>
            <g className={animate ? "au-rise" : undefined} style={animate ? { ["--i" as string]: i } : undefined}>
              <rect x="-10" y="22" width="20" height="44" fill="#FFFFFF" fillOpacity="0.6" stroke="#7A5A6E" strokeOpacity="0.3" />
              <rect x="-13" y="8" width="26" height="15" rx="2" fill={`url(#${p}-rose)`} />
              <rect x="-15" y="0" width="30" height="9" rx="3.5" fill={`url(#${p}-flip)`} />
              <rect x="-9" y="2" width="14" height="2" rx="1" fill="#FFFFFF" opacity="0.2" />
            </g>
          </g>
        ))}
      </g>

      {/* The body below the cord: full and rounded. */}
      <path
        d="M84 132C56 146 40 170 41 200C42 232 78 248 120 248C162 248 198 232 199 200C200 170 184 146 156 132C140 138 100 138 84 132Z"
        fill={`url(#${p}-body)`}
      />
      <g fill="none" stroke="#C48C84" strokeLinecap="round" opacity="0.38">
        <path d="M90 140C72 168 70 206 84 238" strokeWidth="2" />
        <path d="M150 140C168 168 170 206 156 238" strokeWidth="2" />
        <path d="M120 142C117 182 119 216 120 246" strokeWidth="1.5" />
      </g>
      {/* The frill above the cord: flared to the opening, gathered at the cord. */}
      <path
        d="M62 96C68 108 76 122 84 132C100 138 140 138 156 132C164 122 172 108 178 96C160 108 80 108 62 96Z"
        fill={`url(#${p}-frill)`}
      />
      <g fill="none" stroke="#C99189" strokeLinecap="round" opacity="0.45">
        <path d="M84 104C88 114 92 124 96 134" strokeWidth="1.4" />
        <path d="M108 107C109 117 110 126 111 136" strokeWidth="1.4" />
        <path d="M132 107C131 117 130 126 129 136" strokeWidth="1.4" />
        <path d="M156 104C152 114 148 124 144 134" strokeWidth="1.4" />
      </g>
      <path d="M62 96C80 108 160 108 178 96" fill="none" stroke="#FCEFEC" strokeWidth="3.5" strokeLinecap="round" />
      {/* The cord and its bow. */}
      <path d="M82 132C100 139 140 139 158 132" fill="none" stroke={`url(#${p}-rose)`} strokeWidth="3" strokeLinecap="round" />
      <g fill="none" stroke={`url(#${p}-rose)`} strokeWidth="2.5" strokeLinecap="round">
        <path d="M120 137C106 123 90 133 102 143C108 147 116 141 120 137" />
        <path d="M120 137C134 123 150 133 138 143C132 147 124 141 120 137" />
        <path d="M120 137C117 151 112 163 107 173" />
        <path d="M120 137C124 152 129 163 135 172" />
      </g>
      <circle cx="120" cy="137" r="3.5" fill="#B9877A" />
    </svg>
  );
}
