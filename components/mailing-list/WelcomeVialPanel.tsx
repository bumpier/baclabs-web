"use client";

import { MAILING_LIST } from "@/config/funnel";
import { SignupForm } from "@/components/mailing-list/SignupForm";
import { useMailingStatus } from "@/components/mailing-list/status";

const OFFER_ON = MAILING_LIST.enabled && MAILING_LIST.welcomeVial.enabled;

/**
 * Inside the purchase blocks, just above the checkout button: the free vial
 * already waiting for a signed-up browser, or the offer for one that is not.
 * Renders nothing until the status is known, and nothing for a subscriber
 * whose gift has been used. `vials` is how many the current selection pays
 * for: with the reminder bonus open, enough of them earn the extra vials.
 */
export function WelcomeVialPanel({ vials, compact = false }: { vials: number; compact?: boolean }) {
  const status = useMailingStatus();
  if (!OFFER_ON || !status) return null;

  if (status.welcome) {
    const bonus = status.bonus ?? null;
    const earned = bonus && vials >= bonus.minVials ? bonus : null;
    // One line in the compact buy boxes: the gift is a fact about the order,
    // not something to read, so it gets no box.
    if (compact) {
      return (
        <p aria-live="polite" className="text-sm text-ink">
          <span className="font-semibold text-brand-deep">
            {earned ? `+${earned.vials} free vials` : "+1 free vial"}
          </span>{" "}
          added at checkout.
          {bonus?.by && !earned ? ` ${bonus.minVials}+ vials by ${bonus.by} makes it ${bonus.vials}.` : null}
        </p>
      );
    }
    return (
      <p aria-live="polite" className="alert-note mt-3">
        <span className="font-semibold">
          {earned ? `+${earned.vials} free vials included.` : "+1 free vial included."}
        </span>{" "}
        Your mailing-list welcome gift is added at checkout; you will see it on the payment page.
        {bonus?.by && !earned
          ? ` Order ${bonus.minVials} vials or more by ${bonus.by} and it becomes ${bonus.vials}.`
          : null}
      </p>
    );
  }
  if (status.subscribed) return null;

  // The offer stays open: the signup is how the shop builds its list, so it
  // is never hidden behind a tap. In the compact buy boxes it sits under the
  // checkout button, the only box left in the panel, so it reads as a
  // separate offer rather than a step before paying.
  if (compact) {
    return (
      <div className="rounded-panel border border-line bg-neutral p-4 sm:p-5">
        {MAILING_LIST.headline ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <GiftMark />
            {MAILING_LIST.headline}
          </p>
        ) : null}
        {MAILING_LIST.offerLine ? <p className="mt-1 text-xs text-ink-soft">{MAILING_LIST.offerLine}</p> : null}
        <div className="mt-3">
          <SignupForm source="inline" />
        </div>
      </div>
    );
  }

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

/** A gift box, in the trust bar's hand-drawn stroke. No icon library. */
function GiftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M2.5 7h11v6.5h-11zM1.75 4.5h12.5V7H1.75zM8 4.5v9M8 4.5C6.5 4.5 4.75 3.9 4.75 2.75S6.6 1.6 8 4.5Zm0 0c1.5 0 3.25-.6 3.25-1.75S9.4 1.6 8 4.5Z"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
