"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MAILING_LIST } from "@/config/funnel";
import { shouldShowBanner } from "@/lib/consent";
import { useConfiguredTrackers, useConsent } from "@/components/consent/consent-store";
import { SignupForm } from "@/components/mailing-list/SignupForm";
import {
  popupDismissedWithin,
  rememberPopupDismissed,
  useMailingStatus,
} from "@/components/mailing-list/status";

/**
 * The mailing-list offer as a modal: shortly after landing, and again as the
 * pointer heads for the tab bar if it was not already seen this visit.
 *
 * Stays shut for anyone already signed up, for a set time after it is closed,
 * on pages where interrupting would get in the way (paying, the receipt, the
 * legal pages), and while the cookie banner is still asking its question, so
 * the two never stack.
 *
 * A native <dialog> opened with showModal(): focus is trapped inside it, Esc
 * closes it and the page behind is inert, without any of that written here.
 */

const QUIET_PATHS = ["/checkout", "/order-confirmation", "/dev", "/privacy", "/terms", "/returns", "/disclaimer", "/contact"];

export function SignupPopup() {
  const pathname = usePathname() ?? "/";
  const status = useMailingStatus();
  const choice = useConsent();
  const trackers = useConfiguredTrackers();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shownThisVisit = useRef(false);
  const [open, setOpen] = useState(false);

  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const bannerSettled =
    trackers !== null &&
    !shouldShowBanner({ choice, trackersConfigured: trackers.metaPixel || trackers.ga4 });
  const allowed =
    MAILING_LIST.enabled &&
    !quiet &&
    status !== null &&
    !status.subscribed &&
    bannerSettled;

  const show = useCallback(() => {
    if (shownThisVisit.current || popupDismissedWithin(MAILING_LIST.popup.dismissDays)) return;
    shownThisVisit.current = true;
    setOpen(true);
  }, []);

  // On entry.
  useEffect(() => {
    if (!allowed || MAILING_LIST.popup.entryDelayMs <= 0) return;
    const t = window.setTimeout(show, MAILING_LIST.popup.entryDelayMs);
    return () => window.clearTimeout(t);
  }, [allowed, show]);

  // On exit intent: the pointer leaving through the top of the window, which
  // only a mouse can do. Touch screens get the entry popup alone.
  useEffect(() => {
    if (!allowed || !MAILING_LIST.popup.exitIntent) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) show();
    };
    document.addEventListener("mouseout", onOut);
    return () => document.removeEventListener("mouseout", onOut);
  }, [allowed, show]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!MAILING_LIST.enabled) return null;

  function close() {
    rememberPopupDismissed();
    setOpen(false);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="mailing-popup-heading"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
      className="no-print m-auto w-[calc(100%-2rem)] max-w-md rounded-panel border border-line bg-surface p-0 text-ink shadow-panel backdrop:bg-abyss/60"
    >
      {open ? (
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-brand-tint hover:text-ink"
          >
            &times;
          </button>
          {MAILING_LIST.headline ? (
            <h2 id="mailing-popup-heading" className="pr-8 font-display text-2xl font-bold text-ink">
              {MAILING_LIST.headline}
            </h2>
          ) : (
            <h2 id="mailing-popup-heading" className="sr-only">
              Join the mailing list
            </h2>
          )}
          {MAILING_LIST.offerLine ? <p className="mt-3 text-ink-soft">{MAILING_LIST.offerLine}</p> : null}
          <div className="mt-5">
            <SignupForm source="popup" autoFocus onDone={rememberPopupDismissed} />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
