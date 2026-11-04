/**
 * Marble veining for a porcelain panel: a few long, soft plum-grey veins
 * drawn to fill whatever box holds them. Decoration only, so it is hidden
 * from assistive technology; it sits behind the panel's content.
 */
export function MarbleVeins({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <filter id="mv-soft" x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g fill="none" stroke="#8F7685" strokeLinecap="round">
        <path d="M-20 120C160 80 260 210 420 170S700 60 860 140 1080 250 1230 190" strokeWidth="10" opacity="0.05" filter="url(#mv-soft)" />
        <path d="M-20 120C160 80 260 210 420 170S700 60 860 140 1080 250 1230 190" strokeWidth="1.3" opacity="0.2" />
        <path d="M420 170C450 240 430 300 480 360S520 470 500 520" strokeWidth="1" opacity="0.14" />
        <path d="M-20 400C140 360 300 430 460 410S760 330 900 380 1100 460 1230 420" strokeWidth="8" opacity="0.04" filter="url(#mv-soft)" />
        <path d="M-20 400C140 360 300 430 460 410S760 330 900 380 1100 460 1230 420" strokeWidth="1" opacity="0.16" />
        <path d="M860 140C880 200 950 230 960 300S1010 380 1060 400" strokeWidth="0.8" opacity="0.13" />
        <path d="M620 -10C640 60 600 110 650 160" strokeWidth="0.7" opacity="0.12" />
      </g>
    </svg>
  );
}
