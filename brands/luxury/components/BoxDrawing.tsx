/**
 * The Reserve No.10 box, drawn: a black box in a three-quarter view with
 * champagne hairlines, the brand's mark split across lid and base, and,
 * once the lid is lifted, the vial's cap and the sealed batch card inside.
 * TODO(launch): photography. This drawing stands in until the box is made
 * and photographed; it claims no material or finish.
 *
 * `animate` gives the hero its one moment: the lid lifts once, slowly, from
 * closed to the resting state (brands/luxury/styles.css .rx-box--animate).
 * The resting state is the lifted lid, so a visitor who prefers reduced
 * motion, and every screenshot taken after the moment, sees the same box.
 * `open={false}` draws it closed and still (the 404 page).
 *
 * Decorative: it is aria-hidden, and the page says in words what it shows.
 * A server component with no imports, so any page may use it; `idPrefix`
 * keeps its gradient ids unique when two are on one page.
 */
export function BoxDrawing({
  open = true,
  animate = false,
  card = true,
  idPrefix = "rx-box",
  className = "",
}: {
  open?: boolean;
  animate?: boolean;
  /** Draw the batch card inside (copy/home.ts BATCH_CARD decides). */
  card?: boolean;
  idPrefix?: string;
  className?: string;
}) {
  const front = `${idPrefix}-front`;
  const lidFront = `${idPrefix}-lid-front`;
  const shade = `${idPrefix}-shade`;
  const classes = ["rx-box", open && animate ? "rx-box--animate" : "", open ? "rx-box--open" : "", className].filter(Boolean).join(" ");

  return (
    <svg viewBox="0 0 440 420" className={classes} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={front} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1b18" />
          <stop offset="1" stopColor="#0d0d0d" />
        </linearGradient>
        <linearGradient id={lidFront} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f1e1b" />
          <stop offset="0.55" stopColor="#141412" />
          <stop offset="1" stopColor="#0d0d0d" />
        </linearGradient>
        <filter id={shade} x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* The shadow falls to the right: the light comes from the upper left. */}
      <ellipse cx="246" cy="386" rx="170" ry="11" fill="#0d0d0d" opacity="0.22" filter={`url(#${shade})`} />

      {/* Base */}
      <polygon points="338,210 382,180 382,350 338,380" fill="#070707" />
      <rect x="78" y="210" width="260" height="170" fill={`url(#${front})`} />
      <rect x="88" y="246" width="240" height="124" fill="none" className="rx-box__line" strokeWidth="0.6" />
      <text x="208" y="318" textAnchor="middle" className="rx-box__mark rx-box__mark--base">
        No.10
      </text>

      {/* The opening, and what sits in it: seen only while the lid is up. */}
      <polygon points="78,210 338,210 382,180 122,180" fill="#050505" />
      <polygon points="86,206 332,206 368,184 124,184" fill="none" className="rx-box__line" strokeWidth="0.5" opacity="0.45" />
      {card ? (
        <g>
          <polygon points="134,203 244,203 268,187 158,187" fill="#f4ebd7" />
          <ellipse cx="201" cy="195" rx="7.5" ry="4.6" fill="#c8ae78" />
        </g>
      ) : null}
      <g>
        <ellipse cx="296" cy="197" rx="18" ry="6.8" fill="#26241f" className="rx-box__line" strokeWidth="0.8" />
        <ellipse cx="296" cy="196.2" rx="8.5" ry="3.2" fill="#3a3630" />
      </g>

      {/* Lid, drawn closed; the resting state lifts it (see the CSS). */}
      <g className="rx-lid" transform={open ? "translate(0 -76)" : undefined}>
        <polygon points="72,178 344,178 388,148 116,148" fill="#25231f" />
        <polygon points="80,174 338,174 374,151 118,151" fill="none" className="rx-box__line" strokeWidth="0.5" opacity="0.5" />
        <polygon points="344,178 388,148 388,202 344,232" fill="#080808" />
        <rect x="72" y="178" width="272" height="54" fill={`url(#${lidFront})`} />
        <line x1="72" y1="178.4" x2="344" y2="178.4" className="rx-box__line" strokeWidth="0.8" />
        <rect x="80" y="186" width="256" height="38" fill="none" className="rx-box__line" strokeWidth="0.6" />
        <text x="208" y="211" textAnchor="middle" className="rx-box__mark rx-box__mark--lid">
          Reserve
        </text>
      </g>
    </svg>
  );
}
