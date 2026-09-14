"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { shouldShowBanner } from "@/lib/consent";
import {
  setConsent,
  useConfiguredTrackers,
  useConsent,
  useConsentSettingsOpen,
} from "@/components/consent/consent-store";

/**
 * Asks before any tracking cookie is set, and lets a visitor change their
 * mind later from "Cookie settings".
 *
 * Built to the ICO's reading of PECR:
 *  - Nothing loads until Accept. Undecided is treated as a refusal.
 *  - Reject sits beside Accept with identical styling. A refusal that takes
 *    more effort than consent is not a free choice.
 *  - No cookie wall. The banner does not block the page or the basket.
 *  - It names the companies involved rather than saying "our partners".
 *
 * Renders nothing when no tracker is configured, because there is then
 * nothing to consent to.
 */
export function CookieBanner() {
  const choice = useConsent();
  const trackers = useConfiguredTrackers();
  const reopened = useConsentSettingsOpen();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const configured = Boolean(trackers && (trackers.metaPixel || trackers.ga4));
  const shown = configured && (reopened || shouldShowBanner({ choice, trackersConfigured: configured }));

  // Opened from a "Cookie settings" link: take focus there, so a keyboard or
  // screen-reader user lands on the choice they just asked for.
  useEffect(() => {
    if (shown && reopened) headingRef.current?.focus();
  }, [shown, reopened]);

  if (!shown || !trackers) return null;

  const companies = [trackers.metaPixel ? "Meta" : null, trackers.ga4 ? "Google" : null]
    .filter(Boolean)
    .join(" and ");

  return (
    <section
      aria-labelledby="cookie-banner-heading"
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 sm:px-6"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto mx-auto max-w-2xl rounded-panel border border-line bg-surface p-5 shadow-panel sm:p-6">
        <h2
          id="cookie-banner-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold text-ink"
        >
          Cookies
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          We&rsquo;d like to use cookies from {companies} to measure how the site is used and how
          our adverts perform. They stay off unless you accept, and your basket works either way.{" "}
          <Link href="/privacy#cookies-and-analytics" className="link">
            Privacy policy
          </Link>
        </p>
        {reopened && choice ? (
          <p className="mt-2 text-sm text-ink-soft">
            You have currently {choice === "granted" ? "accepted" : "rejected"} these cookies.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn-quiet flex-1" onClick={() => setConsent("denied")}>
            Reject
          </button>
          <button type="button" className="btn-quiet flex-1" onClick={() => setConsent("granted")}>
            Accept
          </button>
        </div>
      </div>
    </section>
  );
}
