/**
 * Aurelle's few icons, drawn here in one 1.5px stroke on a 24px grid, so
 * they share a hand: the basket is the Aurelle pouch itself (its rounded
 * flap and its stud), the rest are as plain as they can be. Always
 * decorative: the control that holds one names itself.
 */
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: "false" as const,
};

/** The pouch: the basket's icon. */
export function PouchIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <rect x="3.25" y="6.25" width="17.5" height="12.5" rx="2.25" />
      <path d="M3.6 7.6c2.4 4.1 5.2 5.9 8.4 5.9s6-1.8 8.4-5.9" />
      <circle cx="12" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9h16M4 15h16" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** A fold's sign: a plus that turns to a cross when open (styles.css .au-fold). */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg {...base} width={18} height={18} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
