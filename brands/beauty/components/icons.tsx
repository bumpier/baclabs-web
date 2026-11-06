/**
 * BeautyBac's few icons, drawn here in one 1.5px stroke on a 24px grid, so
 * they share a hand: the basket is the box a set arrives in (a lid on a
 * plain body, nothing on its face), the rest are as plain as they can be.
 * Always decorative: the control that holds one names itself.
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

/** The box: the basket's icon. */
export function BoxIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <rect x="3.25" y="5.75" width="17.5" height="4.5" rx="1.25" />
      <path d="M4.75 10.25v7.5a1.5 1.5 0 0 0 1.5 1.5h11.5a1.5 1.5 0 0 0 1.5-1.5v-7.5" />
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

/** A fold's sign: a plus that turns to a cross when open (styles.css .bb-fold). */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg {...base} width={18} height={18} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
