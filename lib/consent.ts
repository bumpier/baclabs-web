/**
 * Tracking consent — the pure half. No DOM, no React, so it can be tested
 * with a tsx script (scripts/test-consent.ts) like the rest of lib/.
 *
 * WHY THIS EXISTS. The Meta Pixel and GA4 both set their own cookies on the
 * visitor's device. PECR regulation 6 requires consent BEFORE a non-essential
 * cookie is set, and disclosure in the privacy policy is not consent. So
 * nothing that sets a tracking cookie may load until the visitor says yes,
 * and "has not answered yet" must behave exactly like "said no".
 *
 * The decision itself is kept in localStorage, not a cookie. Remembering a
 * refusal is strictly necessary to honour it, and it never leaves the device.
 */

/** Bump the suffix to re-ask everyone, e.g. when a new KIND of tracking is added. */
export const CONSENT_STORAGE_KEY = "tracking_consent_v1";

export type ConsentChoice = "granted" | "denied";

/** Read a stored decision. Anything unrecognised counts as no decision. */
export function parseConsent(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const choice = (value as { choice?: unknown }).choice;
    return choice === "granted" || choice === "denied" ? choice : null;
  } catch {
    return null;
  }
}

/** The stored form: the choice plus when it was made, for the record. */
export function serializeConsent(choice: ConsentChoice, now: Date = new Date()): string {
  return JSON.stringify({ choice, at: now.toISOString() });
}

/**
 * Ask only when there is something to ask about. With no tracker configured
 * the site sets no non-essential cookie, and an empty config renders nothing.
 */
export function shouldShowBanner(state: {
  choice: ConsentChoice | null;
  trackersConfigured: boolean;
}): boolean {
  return state.trackersConfigured && state.choice === null;
}

/** Undecided is not consent. */
export function mayLoadTrackers(choice: ConsentChoice | null): boolean {
  return choice === "granted";
}

/**
 * First-party cookies the trackers leave on our own domain, cleared when a
 * visitor withdraws consent. Meta's _fbp/_fbc and GA4's _ga, _ga_<id> and
 * _gid. Anything on facebook.com or google.com is out of our reach and is
 * governed by those companies' own notices.
 */
const TRACKING_COOKIE = /^(_fbp|_fbc|_ga|_ga_[A-Za-z0-9]+|_gid)$/;

export function isTrackingCookieName(name: string): boolean {
  return TRACKING_COOKIE.test(name);
}
