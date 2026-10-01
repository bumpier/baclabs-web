"use client";

import { useEffect, useState } from "react";
import type { BonusOffer } from "@/lib/mailing-list";

/**
 * The browser's mailing-list state, shared by the popup, the signup forms and
 * the buy blocks so they agree. The signup cookie is httpOnly and the pages
 * are static, so the state comes from one GET /api/subscribe per page load.
 */

export interface MailingStatus {
  /** This browser signed up. */
  subscribed: boolean;
  /** Its welcome vial is still waiting for a first order. */
  welcome: boolean;
  /** The second reminder's extra vials, while that offer is open. */
  bonus: BonusOffer | null;
}

const CHANGE_EVENT = "mailing-status-change";
const UNKNOWN: MailingStatus = { subscribed: false, welcome: false, bonus: null };
let request: Promise<MailingStatus> | null = null;
let current: MailingStatus | null = null;

function fetchStatus(): Promise<MailingStatus> {
  request ??= fetch("/api/subscribe", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<MailingStatus>) : UNKNOWN))
    .catch(() => UNKNOWN)
    .then((status) => (current ??= status));
  return request;
}

/** Null until known. */
export function useMailingStatus(): MailingStatus | null {
  const [status, setStatus] = useState<MailingStatus | null>(current);
  useEffect(() => {
    let alive = true;
    fetchStatus().then((s) => {
      if (alive) setStatus(current ?? s);
    });
    const onChange = () => setStatus(current);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);
  return status;
}

/**
 * After a successful signup. The server always answers the same, so this
 * assumes the offer applies; checkout re-checks it against the database
 * before anything is added to an order.
 */
export function markSubscribed(withOffer: boolean): void {
  current = { subscribed: true, welcome: withOffer, bonus: null };
  request = Promise.resolve(current);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// ── Popup dismissal, per browser ───────────────────────────────────

const DISMISS_KEY = "mailing_popup_dismissed_at";

export function popupDismissedWithin(days: number): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < days * 86_400_000;
  } catch {
    return false;
  }
}

export function rememberPopupDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the popup may show again next visit. Harmless.
  }
}
