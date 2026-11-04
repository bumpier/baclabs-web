"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { shouldShowBanner } from "@/lib/consent";
import { useConsent } from "@/components/consent/consent-core";
import { anyTracker, useBrandTrackers, type TrackingConfig } from "@/components/commerce/tracking";
import { useBrandPathname } from "@/lib/brand/use-brand-pathname";
import { popupDismissedWithin, rememberPopupDismissed, useMailingStatus } from "@/components/mailing-list/status";

export interface SignupPopupConfig {
  /** Opens this long after landing. 0 turns the entry popup off. */
  entryDelayMs?: number;
  /** Opens again as the pointer leaves the top of the window (desktop only). */
  exitIntent?: boolean;
  /** How long a dismissal is remembered in this browser. */
  dismissDays?: number;
  /** Pages it never interrupts, as the visitor sees them ("/checkout" covers "/checkout/x"). */
  quietPaths?: readonly string[];
}

const QUIET_PATHS = ["/checkout", "/order-confirmation", "/privacy", "/terms", "/returns", "/disclaimer", "/contact"];

/**
 * A brand's mailing-list offer as a modal, with BacLab's manners
 * (components/mailing-list/SignupPopup.tsx): shortly after landing and on
 * exit intent, never for anyone already signed up, never for a while after
 * it is closed, never on paying, receipt or legal pages, and never while the
 * cookie banner is still asking, so the two never stack.
 *
 * A native <dialog> opened with showModal(): focus is trapped inside it, Esc
 * closes it and the page behind is inert. The content is the brand's:
 * `children` gets `close`, and usually renders a heading with the id given
 * as `labelledBy`, the offer and a <SignupForm onDone={close} />.
 */
export function SignupPopup({
  config = {},
  tracking,
  labelledBy,
  className,
  children,
}: {
  config?: SignupPopupConfig;
  tracking: TrackingConfig;
  /** The id of the heading inside `children`. */
  labelledBy: string;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const { entryDelayMs = 4000, exitIntent = true, dismissDays = 14, quietPaths = QUIET_PATHS } = config;
  const pathname = useBrandPathname();
  const status = useMailingStatus();
  const choice = useConsent();
  const trackers = useBrandTrackers(tracking);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shownThisVisit = useRef(false);
  const [open, setOpen] = useState(false);

  const quiet = quietPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const bannerSettled = trackers !== null && !shouldShowBanner({ choice, trackersConfigured: anyTracker(trackers) });
  const allowed = !quiet && status !== null && !status.subscribed && bannerSettled;

  const show = useCallback(() => {
    if (shownThisVisit.current || popupDismissedWithin(dismissDays)) return;
    shownThisVisit.current = true;
    setOpen(true);
  }, [dismissDays]);

  useEffect(() => {
    if (!allowed || entryDelayMs <= 0) return;
    const t = window.setTimeout(show, entryDelayMs);
    return () => window.clearTimeout(t);
  }, [allowed, entryDelayMs, show]);

  // The pointer leaving through the top of the window, which only a mouse
  // can do. Touch screens get the entry popup alone.
  useEffect(() => {
    if (!allowed || !exitIntent) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) show();
    };
    document.addEventListener("mouseout", onOut);
    return () => document.removeEventListener("mouseout", onOut);
  }, [allowed, exitIntent, show]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = useCallback(() => {
    rememberPopupDismissed();
    setOpen(false);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
      className={className ?? "no-print commerce-panel m-auto w-[calc(100%-2rem)] max-w-md p-0"}
    >
      {open ? children(close) : null}
    </dialog>
  );
}
