"use client";

import { MAILING_LIST } from "@/config/funnel";
import { SignupForm } from "@/components/mailing-list/SignupForm";
import { useMailingStatus } from "@/components/mailing-list/status";

const OFFER_ON = MAILING_LIST.enabled && MAILING_LIST.welcomeVial.enabled;

/**
 * Inside the purchase blocks, just above the checkout button: the free vial
 * already waiting for a signed-up browser, or the offer for one that is not.
 * Renders nothing until the status is known, and nothing for a subscriber
 * whose gift has been used.
 */
export function WelcomeVialPanel() {
  const status = useMailingStatus();
  if (!OFFER_ON || !status) return null;

  if (status.welcome) {
    return (
      <p aria-live="polite" className="alert-note mt-3">
        <span className="font-semibold">+1 free vial included.</span> Your mailing-list welcome gift is
        added at checkout; you will see it on the payment page.
      </p>
    );
  }
  if (status.subscribed) return null;

  return (
    <div className="mt-4 rounded-control border border-dashed border-line-strong/60 p-4">
      {MAILING_LIST.headline ? (
        <p className="text-sm font-semibold text-ink">{MAILING_LIST.headline}</p>
      ) : null}
      {MAILING_LIST.offerLine ? <p className="mt-1 text-xs text-ink-soft">{MAILING_LIST.offerLine}</p> : null}
      <div className="mt-3">
        <SignupForm source="inline" />
      </div>
    </div>
  );
}
