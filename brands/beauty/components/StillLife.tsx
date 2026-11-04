/**
 * The hero's still life, drawn: a sealed vial with a plum flip-off top and a
 * rose-gold crimp, standing on a marble plinth, blush silk falling over the
 * plinth's edge, three pearls on the floor. A server component: plain SVG,
 * no script.
 *
 * TODO(launch): photography. This is the slot for the brand's hero
 * photograph (the vial and its pouch on marble and silk); the drawing keeps
 * the composition until one exists.
 *
 * The one moment of motion: light crosses the vial's glass once after load
 * (.au-sheen), and not at all under prefers-reduced-motion. Gradient ids are
 * prefixed, so nothing else on the page can collide with them.
 */
export function StillLife({ label, className = "" }: { label: string; className?: string }) {
  return (
    <svg viewBox="0 0 600 640" role="img" aria-label={label} className={className}>
      <defs>
        <radialGradient id="al-oval" cx="0.42" cy="0.34" r="0.75">
          <stop offset="0" stopColor="#F9ECE9" />
          <stop offset="0.6" stopColor="#F1DAD6" />
          <stop offset="1" stopColor="#E8C9C4" />
        </radialGradient>
        <linearGradient id="al-marble" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor="#F8F4F5" />
          <stop offset="0.78" stopColor="#E9E0E3" />
          <stop offset="1" stopColor="#D9CCD2" />
        </linearGradient>
        <radialGradient id="al-marble-top" cx="0.38" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EEE6E9" />
        </radialGradient>
        <linearGradient id="al-silk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E3B9B2" />
          <stop offset="0.14" stopColor="#F6E0DB" />
          <stop offset="0.3" stopColor="#DDAEA6" />
          <stop offset="0.46" stopColor="#F8E7E3" />
          <stop offset="0.62" stopColor="#E2B5AE" />
          <stop offset="0.8" stopColor="#F3D9D4" />
          <stop offset="1" stopColor="#D7A69F" />
        </linearGradient>
        <linearGradient id="al-silk-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F9E9E5" />
          <stop offset="1" stopColor="#E9C3BD" />
        </linearGradient>
        <linearGradient id="al-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="0.45" stopColor="#F1E6EA" stopOpacity="0.22" />
          <stop offset="1" stopColor="#C9AEBA" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="al-crimp" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9C675B" />
          <stop offset="0.22" stopColor="#E9C5B7" />
          <stop offset="0.5" stopColor="#C2907F" />
          <stop offset="0.72" stopColor="#F0D2C6" />
          <stop offset="1" stopColor="#93604F" />
        </linearGradient>
        <linearGradient id="al-flip" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2C1025" />
          <stop offset="0.35" stopColor="#5A2A4A" />
          <stop offset="1" stopColor="#2A0F23" />
        </linearGradient>
        <radialGradient id="al-pearl" cx="0.36" cy="0.32" r="0.72">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#F7EEF0" />
          <stop offset="0.85" stopColor="#DCC7CD" />
          <stop offset="1" stopColor="#C6AAB3" />
        </radialGradient>
        <filter id="al-soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="al-softer" x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <clipPath id="al-glass-clip">
          <path d="M272 290C272 276 280 268 291 262V248H345V262C356 268 364 276 364 290V426C364 433 358 438 351 438H285C278 438 272 433 272 426Z" />
        </clipPath>
      </defs>

      {/* The blush oval the scene sits in. */}
      <ellipse cx="300" cy="300" rx="272" ry="300" fill="url(#al-oval)" />

      {/* Floor shadow of the plinth. */}
      <ellipse cx="300" cy="566" rx="196" ry="20" fill="#3B1730" opacity="0.12" filter="url(#al-soft)" />

      {/* The marble plinth: body, then top. */}
      <path d="M130 430V560A170 36 0 0 0 470 560V430Z" fill="url(#al-marble)" />
      <g fill="none" stroke="#8F7685" strokeLinecap="round">
        <path d="M150 474C196 458 230 504 282 490S362 522 420 500S452 488 470 494" strokeWidth="4" opacity="0.08" filter="url(#al-softer)" />
        <path d="M150 474C196 458 230 504 282 490S362 522 420 500S452 488 470 494" strokeWidth="1.1" opacity="0.3" />
        <path d="M176 548C222 526 258 552 310 534S398 552 452 528" strokeWidth="0.9" opacity="0.22" />
        <path d="M282 490C292 512 286 530 300 552" strokeWidth="0.8" opacity="0.2" />
        <path d="M388 512C380 530 392 546 384 568" strokeWidth="0.7" opacity="0.18" />
      </g>
      <ellipse cx="300" cy="430" rx="170" ry="36" fill="url(#al-marble-top)" />
      <path d="M196 418C236 410 262 436 304 428S372 440 414 424" fill="none" stroke="#8F7685" strokeWidth="0.9" opacity="0.22" />

      {/* Silk, lying on the plinth and falling over its front edge. */}
      <path
        d="M168 453C200 440 262 428 300 427C332 426 354 442 360 464C330 470 280 470 240 466C210 463 184 459 168 453Z"
        fill="url(#al-silk-top)"
      />
      <path
        d="M168 453Q300 482 360 464C372 510 392 560 420 602C392 614 362 596 332 608C302 620 272 600 242 612C212 622 182 604 150 613C160 560 158 500 168 453Z"
        fill="url(#al-silk)"
      />
      <g fill="none" stroke="#C9928A" strokeLinecap="round" opacity="0.45">
        <path d="M214 470C212 520 220 570 226 612" strokeWidth="2.5" filter="url(#al-softer)" />
        <path d="M290 474C292 524 300 570 304 614" strokeWidth="2.5" filter="url(#al-softer)" />
        <path d="M344 470C352 520 364 566 380 604" strokeWidth="2" filter="url(#al-softer)" />
      </g>

      {/* The vial's contact shadow on the marble. */}
      <ellipse cx="318" cy="439" rx="54" ry="6" fill="#3B1730" opacity="0.2" filter="url(#al-softer)" />

      {/* The vial: glass, water, label, crimp, flip-off top. */}
      <path
        d="M272 290C272 276 280 268 291 262V248H345V262C356 268 364 276 364 290V426C364 433 358 438 351 438H285C278 438 272 433 272 426Z"
        fill="url(#al-glass)"
        stroke="#7A5A6E"
        strokeOpacity="0.35"
        strokeWidth="1.2"
      />
      <path d="M276 302H360V426C360 431 356 434 351 434H285C280 434 276 431 276 426Z" fill="#E7CDD6" opacity="0.32" />
      <ellipse cx="318" cy="302" rx="42" ry="3.5" fill="#FFFFFF" opacity="0.75" />
      <rect x="276" y="330" width="84" height="74" fill="#FFFCFB" />
      <text x="318" y="362" textAnchor="middle" fontSize="18" fill="#3B1730" style={{ fontFamily: "var(--font-display)" }}>
        Aurelle
      </text>
      <rect x="302" y="372" width="32" height="1.2" fill="#B9877A" />
      <text x="318" y="390" textAnchor="middle" fontSize="9.5" fill="#6A4660" style={{ fontFamily: "var(--font-sans)", letterSpacing: "0.06em" }}>
        10 ml
      </text>
      <rect x="280" y="296" width="6" height="128" rx="3" fill="#FFFFFF" opacity="0.7" />
      <rect x="354" y="300" width="2" height="120" rx="1" fill="#FFFFFF" opacity="0.45" />
      <g clipPath="url(#al-glass-clip)">
        <rect x="200" y="230" width="34" height="230" fill="#FFFFFF" opacity="0.55" className="au-sheen" />
      </g>
      <rect x="286" y="214" width="64" height="36" rx="4" fill="url(#al-crimp)" />
      <rect x="286" y="240" width="64" height="3" fill="#8C5A4E" opacity="0.35" />
      <rect x="281" y="199" width="74" height="18" rx="7" fill="url(#al-flip)" />
      <rect x="290" y="202" width="40" height="3" rx="1.5" fill="#FFFFFF" opacity="0.18" />

      {/* Pearls on the floor, in front of the plinth. */}
      <ellipse cx="458" cy="603" rx="16" ry="4" fill="#3B1730" opacity="0.14" filter="url(#al-softer)" />
      <circle cx="456" cy="589" r="13" fill="url(#al-pearl)" />
      <circle cx="486" cy="598" r="8.5" fill="url(#al-pearl)" />
      <circle cx="436" cy="605" r="6.5" fill="url(#al-pearl)" />
    </svg>
  );
}
