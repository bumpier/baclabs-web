"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  CONSENT_STORAGE_KEY,
  isTrackingCookieName,
  mayLoadTrackers,
  parseConsent,
  serializeConsent,
  type ConsentChoice,
} from "@/lib/consent";

/**
 * Tracking consent, the browser half, for every site: the visitor's choice,
 * the "Cookie settings" reopen and the trackers this host runs.
 *
 * Moved out of consent-store.ts unchanged, so a brand's storefront can use
 * the same store without importing BacLab's build-time GA4 id: that id, and
 * the hook that reads it, stay in consent-store.ts, which re-exports all of
 * this. BacLab's components keep importing consent-store.ts and behave as
 * before. A brand passes its own GA4 id to useTrackersFor().
 */

const CHANGE_EVENT = "tracking-consent-change";

function emit() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  // `storage` keeps other open tabs in step with a decision made in this one.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readChoice(): ConsentChoice | null {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    // Storage blocked (some private modes). No stored decision means no
    // trackers, which is the safe side to fail on.
    return null;
  }
}

/**
 * Consent at this moment, outside React. Checkout sends it with the order so
 * the server knows whether it may report the purchase to Meta.
 */
export function hasTrackingConsent(): boolean {
  return mayLoadTrackers(readChoice());
}

/** The visitor's decision. Null on the server and before they have answered. */
export function useConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribe, readChoice, () => null);
}

// ── Reopening the banner ───────────────────────────────────────────

let settingsOpen = false;

export function openConsentSettings(): void {
  settingsOpen = true;
  emit();
}

export function useConsentSettingsOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => settingsOpen,
    () => false
  );
}

// ── Recording a decision ───────────────────────────────────────────

/** Expire a cookie on every domain it could have been set on. */
function expireCookie(name: string) {
  const labels = window.location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < labels.length - 1; i++) {
    domains.push(`; domain=.${labels.slice(i).join(".")}`);
  }
  for (const domain of domains) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
  }
}

export function setConsent(choice: ConsentChoice): void {
  const previous = readChoice();
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, serializeConsent(choice));
  } catch {
    // Cannot persist. The decision still applies to this page view.
  }
  settingsOpen = false;

  if (previous === "granted" && choice === "denied") {
    // Withdrawal. The tags are already running in this page and cannot be
    // unloaded, so tell Meta, clear what they left on our domain, and reload
    // into a page that never loads them.
    try {
      window.fbq?.("consent", "revoke");
    } catch {
      /* no-op */
    }
    for (const part of document.cookie.split(";")) {
      const name = part.split("=")[0]?.trim() ?? "";
      if (isTrackingCookieName(name)) expireCookie(name);
    }
    window.location.reload();
    return;
  }

  emit();
}

// ── What is there to consent to? ───────────────────────────────────

export interface ConfiguredTrackers {
  metaPixel: boolean;
  ga4: boolean;
}

let metaPixelRequest: Promise<boolean> | null = null;

function fetchMetaPixelConfigured(): Promise<boolean> {
  // /api/tracking answers for the Host's own brand, so on a brand's site this
  // is that brand's pixel, never BacLab's.
  metaPixelRequest ??= fetch("/api/tracking", { credentials: "omit" })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: unknown) => Boolean((body as { metaPixel?: unknown } | null)?.metaPixel))
    // Unreachable endpoint: report nothing configured. No banner, and no
    // pixel either, because the tag is gated on consent regardless.
    .catch(() => false);
  return metaPixelRequest;
}

/**
 * Null until known. The Meta Pixel is a runtime setting, so it takes one
 * request to find out; GA4 is known immediately, from the caller: BacLab's
 * build-time id (consent-store.ts useConfiguredTrackers) or a brand's own.
 */
export function useTrackersFor(ga4: boolean): ConfiguredTrackers | null {
  const [metaPixel, setMetaPixel] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMetaPixelConfigured().then((value) => {
      if (alive) setMetaPixel(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (metaPixel === null) return null;
  return { metaPixel, ga4 };
}
