/**
 * The box open, from above: the sealed batch card on top and three vials'
 * caps beneath it. It fills the home page's photograph frame until there is
 * a photograph. TODO(launch): photography. Replace this with the open box,
 * shot from above on black, at 4:5.
 *
 * Decorative (the figure's caption says what it shows). `card` false draws
 * the vials alone, for as long as the batch card is unconfirmed.
 */
export function OpenBox({ card = true, className = "" }: { card?: boolean; className?: string }) {
  const capsY = card ? 258 : 196;
  return (
    <svg viewBox="0 0 320 400" className={className} aria-hidden="true" focusable="false">
      <defs>
        <filter id="rx-open-shade" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <rect x="54" y="52" width="228" height="300" fill="#000" opacity="0.55" filter="url(#rx-open-shade)" />
      <rect x="46" y="40" width="228" height="300" fill="#1d1c19" />
      <rect x="46.5" y="40.5" width="227" height="299" fill="none" stroke="#c8ae78" strokeWidth="0.75" />
      <rect x="58" y="52" width="204" height="276" fill="#090909" />
      <rect x="58.5" y="52.5" width="203" height="275" fill="none" stroke="#c8ae78" strokeWidth="0.5" opacity="0.45" />

      {card ? (
        <g transform="rotate(-2.5 160 122)">
          <rect x="74" y="70" width="172" height="104" fill="#f4ebd7" />
          <rect x="81" y="77" width="158" height="90" fill="none" stroke="#8c6d2f" strokeWidth="0.6" />
          <circle cx="160" cy="122" r="14" fill="#c8ae78" />
          <circle cx="160" cy="122" r="9.5" fill="none" stroke="#8c6d2f" strokeWidth="0.7" />
        </g>
      ) : null}

      {[104, 160, 216].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={capsY} r="24" fill="#26241f" stroke="#c8ae78" strokeWidth="0.8" />
          <circle cx={cx} cy={capsY} r="13" fill="#3a3630" />
          <path d={`M ${cx - 15} ${capsY - 12} A 19 19 0 0 1 ${cx + 6} ${capsY - 18}`} fill="none" stroke="#f4ebd7" strokeWidth="0.8" opacity="0.35" />
        </g>
      ))}
    </svg>
  );
}
