/**
 * GymWater's wordmark and mark, drawn by hand rather than set in a font, so
 * they look the same everywhere: the header, the footer, the favicon
 * (public/gym/icon.svg is the same mark) and the OG image.
 *
 * The letters are cut like a crate stencil: square stems, every corner that
 * is not square cut at 45 degrees (the angle of the hazard band), and a 6-unit
 * bridge where a stencil plate would hold its counter. The whole word leans
 * 10 degrees forward. Built on a 100-unit cap height, with 24-unit stems and
 * 24-unit counters. Set in capitals, GYMWATER, as stencil lettering is.
 *
 * Pure SVG with no state, so a server or a client component may render it.
 * Decorative where the name is also text (the link around it carries the
 * name); `title` makes it an image with that name where it stands alone.
 */

/** Each letter as one or more stencil pieces, with its advance width. */
const GLYPHS: Record<string, { w: number; d: string }> = {
  // A C with a top terminal, and the lower right with its spur (the A's crossbar depth).
  G: { w: 72, d: "M0 12L12 0H33V22H24V78H33V100H12L0 88Z M39 0H60L72 12V32H48V22H39Z M39 78H48V62H36V44H72V88L60 100H39Z" },
  // A short cup on a centred stem.
  Y: { w: 72, d: "M0 0H24V34H33V56H12L0 44Z M39 34H48V0H72V44L60 56H39Z M24 62H48V100H24Z" },
  // Two plain stems and, held off them by bridges, a chevron hanging from the top.
  M: { w: 104, d: "M0 0H24V100H0Z M30 0H40L52 12L64 0H74V40L52 62L30 40Z M80 0H104V100H80Z" },
  // A wide cup with a middle prong rising to a point.
  W: { w: 104, d: "M0 0H24V78H34V100H12L0 88Z M40 100H64V50L52 38L40 50Z M70 78H80V0H104V88L92 100H70Z" },
  A: { w: 72, d: "M0 100V12L12 0H33V22H24V46H48V22H39V0H60L72 12V100H48V64H24V100Z" },
  T: { w: 68, d: "M0 0H68V22H0Z M22 28H46V100H22Z" },
  E: { w: 60, d: "M0 0H24V100H0Z M30 0H60V22H30Z M30 40H54V60H30Z M30 78H60V100H30Z" },
  R: { w: 72, d: "M0 0H24V100H0Z M30 0H60L72 12V46L62 56H30V38H48V22H30Z M38 62H62L72 100H48Z" },
};

const TRACK = 8;
const SPACE = 40;
/** tan(10°) × the cap height: how far the foot of a leaning letter moves left. */
const LEAN = 18;

function lettering(text: string): { paths: { x: number; d: string }[]; width: number } {
  let x = 0;
  const paths: { x: number; d: string }[] = [];
  for (const ch of text) {
    if (ch === " ") {
      x += SPACE - TRACK;
      continue;
    }
    const g = GLYPHS[ch];
    if (!g) continue;
    paths.push({ x, d: g.d });
    x += g.w + TRACK;
  }
  return { paths, width: x - TRACK };
}

const WORD = lettering("GYMWATER");
const MONO = lettering("G");

/** The wordmark's width at a 100-unit height, for a fixed-size render (the OG image). */
export const WORDMARK_RATIO = (WORD.width + LEAN) / 100;

/**
 * The full wordmark, GYMWATER, in `currentColor` unless `fill` is given.
 * Size it by height or width in CSS; `height` sets it outright (the OG
 * image, which reads no CSS).
 */
export function Wordmark({ className, title, fill = "currentColor", height }: { className?: string; title?: string; fill?: string; height?: number }) {
  return (
    <svg
      viewBox={`0 0 ${WORD.width + LEAN} 100`}
      className={className}
      fill={fill}
      width={height ? height * WORDMARK_RATIO : undefined}
      height={height}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g transform={`translate(${LEAN} 0) skewX(-10)`}>
        {WORD.paths.map((p) => (
          <path key={p.x} transform={`translate(${p.x} 0)`} d={p.d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * The mark: the G on a hazard-yellow plate with two corners cut at 45
 * degrees, centred on the plate with its lean. `plate` and `ink` are the two
 * colours; the defaults are the brand's.
 */
export function Mark({
  className,
  title,
  plate = "var(--color-hazard)",
  ink = "#000",
  size,
}: {
  className?: string;
  title?: string;
  plate?: string;
  ink?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d="M0 0H76L100 24V100H24L0 76Z" fill={plate} />
      <g fill={ink} transform="translate(31.52 16) skewX(-10) scale(0.68)">
        {MONO.paths.map((p) => (
          <path key={p.x} transform={`translate(${p.x} 0)`} d={p.d} />
        ))}
      </g>
    </svg>
  );
}

/** The mark and the wordmark side by side, as the header and the footer show them. */
export function Lockup({ className }: { className?: string }) {
  return (
    <span className={className ? `gym-lockup ${className}` : "gym-lockup"}>
      <Mark className="gym-lockup-mark" />
      <Wordmark className="gym-lockup-word" />
    </span>
  );
}
