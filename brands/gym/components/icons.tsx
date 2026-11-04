/**
 * The brand's icons, drawn for it on a 24-unit grid: one 2px stroke, square
 * ends and mitred corners, and the 45-degree cut of the hazard band wherever
 * a corner is not square. Decorative everywhere (the control or the text
 * beside each one carries its meaning), so every one is hidden from
 * assistive technology. Pure SVG, so server and client components share them.
 */
import type { ReactNode } from "react";

function Icon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** The cart: the product's own box, lid line and the hazard band across its corner. */
export function CartIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3 8h18v13H3z" />
      <path d="M2 4h20v4H2z" />
      <path d="M14 21l7-7M18 21l3-3" />
    </Icon>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M5 5l14 14M19 5L5 19" />
    </Icon>
  );
}

/** The FAQ's open-and-close sign: the vertical bar turns away when it opens (CSS). */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 12h16" />
      <path className="gym-plus-v" d="M12 4v16" />
    </Icon>
  );
}

/** Sent from the UK: a parcel leaving at speed. */
export function DispatchIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M9 6h12v12H9z" />
      <path d="M9 10h12" />
      <path d="M2 9h4M1 13h5M3 17h3" />
    </Icon>
  );
}

/** Tracked: a route with its stops, ending at the door. */
export function TrackedIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3 20h5V12h8V4h5" />
      <path d="M2 18h2v4H2zM15 11h2v2h-2z" />
      <path d="M18 2l3 2-3 2" />
    </Icon>
  );
}

/** Sealed: the vial, its cap and crimp, with the seal line. */
export function SealedIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M8 2h8v3H8z" />
      <path d="M9 5h6v2H9z" />
      <path d="M8 7h8v15H8z" />
      <path d="M8 12h8" />
      <path d="M11 16l1 1 2-2" />
    </Icon>
  );
}

/** Returns: the parcel going back the way it came. */
export function ReturnsIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M8 4L4 8l4 4" />
      <path d="M4 8h11a5 5 0 0 1 0 10H9" />
      <path d="M6 18h3" />
    </Icon>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icon>
  );
}
