"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { shouldShowBanner } from "@/lib/consent";
import { setConsent, useConsent, useConsentSettingsOpen } from "@/components/consent/consent-core";
import { anyTracker, useBrandTrackers, type TrackingConfig } from "@/components/commerce/tracking";

/**
 * Where a plain-string body names the companies: "{companies} cookies tell
 * us...". Written out in the brand's copy, not imported: a server layout
 * that imports a value from this client module gets a reference to it, not
 * the string.
 */
const COMPANIES = "{companies}";

/** The brand's body for these companies (`copy.body`, either form), or null for the kit's own words. */
export function cookieBannerBody(body: string | ((companies: string) => ReactNode) | undefined, companies: string): ReactNode {
  if (typeof body === "string") return body.replaceAll(COMPANIES, companies);
  return body ? body(companies) : null;
}

/**
 * A brand's cookie banner: the same store and the same rules as BacLab's
 * (components/consent/CookieBanner.tsx), built to the ICO's reading of PECR:
 *  - nothing loads until Accept, and undecided counts as a refusal;
 *  - Reject sits beside Accept with the same weight. Both buttons take the
 *    one `classNames.button`, so a design cannot make refusing harder;
 *  - no cookie wall: it never blocks the page or the basket;
 *  - it names the companies involved.
 * Renders nothing when the site runs no tracker, because there is then
 * nothing to ask.
 *
 * The look is the brand's: every element takes a class, and the words can be
 * replaced through `copy`. The body must still name the companies, so it is
 * given their names: as a function of them, or as a plain string with
 * {companies} where they go, which a server layout can pass (a function
 * cannot cross to the browser).
 */
export function CookieBanner({
  ga4Id,
  metaPixel,
  privacyHref = "/privacy#cookies-and-analytics",
  className = "no-print fixed inset-x-0 bottom-0 z-40 p-4",
  classNames = {},
  copy = {},
}: TrackingConfig & {
  privacyHref?: string;
  /** The outer, fixed region. */
  className?: string;
  classNames?: Partial<Record<"panel" | "heading" | "text" | "link" | "actions" | "button", string>>;
  copy?: { heading?: string; body?: string | ((companies: string) => ReactNode); reject?: string; accept?: string };
}) {
  const choice = useConsent();
  const trackers = useBrandTrackers({ ga4Id, metaPixel });
  const reopened = useConsentSettingsOpen();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const configured = anyTracker(trackers);
  const shown = configured && (reopened || shouldShowBanner({ choice, trackersConfigured: configured }));

  // Opened from a "Cookie settings" link: take focus there, so a keyboard or
  // screen-reader user lands on the choice they just asked for.
  useEffect(() => {
    if (shown && reopened) headingRef.current?.focus();
  }, [shown, reopened]);

  if (!shown || !trackers) return null;

  const companies = [trackers.metaPixel ? "Meta" : null, trackers.ga4 ? "Google" : null].filter(Boolean).join(" and ");
  const button = classNames.button ?? "btn-quiet flex-1";

  return (
    <section aria-labelledby={headingId} className={className}>
      <div className={classNames.panel ?? "commerce-panel mx-auto max-w-2xl p-5"}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={classNames.heading ?? "text-lg font-semibold"}>
          {copy.heading ?? "Cookies"}
        </h2>
        <p className={classNames.text ?? "mt-2 text-sm"}>
          {copy.body ? (
            cookieBannerBody(copy.body, companies)
          ) : (
            <>
              We&rsquo;d like to use cookies from {companies} to measure how the site is used and how our adverts
              perform. They stay off unless you accept, and your basket works either way.
            </>
          )}{" "}
          <Link href={privacyHref} className={classNames.link ?? "link"}>
            Privacy policy
          </Link>
        </p>
        {reopened && choice ? (
          <p className={classNames.text ?? "mt-2 text-sm"}>
            You have currently {choice === "granted" ? "accepted" : "rejected"} these cookies.
          </p>
        ) : null}
        <div className={classNames.actions ?? "mt-4 flex flex-col gap-3 sm:flex-row"}>
          <button type="button" className={button} onClick={() => setConsent("denied")}>
            {copy.reject ?? "Reject"}
          </button>
          <button type="button" className={button} onClick={() => setConsent("granted")}>
            {copy.accept ?? "Accept"}
          </button>
        </div>
      </div>
    </section>
  );
}
