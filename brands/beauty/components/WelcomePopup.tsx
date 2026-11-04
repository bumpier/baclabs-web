"use client";

import { useId } from "react";
import { SignupPopup } from "@/components/commerce/SignupPopup";
import { SignupForm } from "@/components/commerce/SignupForm";
import { LETTERS } from "@/brands/beauty/copy/home";

/**
 * The list's welcome, as the kit's SignupPopup with this brand's manners: a
 * few seconds after landing or on leaving through the top of the window,
 * never on paying, receipt, legal or contact pages, and never on /clinics,
 * whose visitors come to order for a business. What it offers is what the
 * consent line says the list sends, and nothing more: the profile's words,
 * shown as they are, because /api/subscribe stores them as the record.
 *
 * Client-side because the popup takes a render function for its content,
 * which cannot cross from the server layout.
 */
const QUIET_PATHS = ["/checkout", "/order-confirmation", "/privacy", "/terms", "/returns", "/disclaimer", "/contact", "/clinics"];

export function WelcomePopup({ consentText, ga4Id }: { consentText: string; ga4Id: string | null }) {
  const headingId = useId();
  if (!consentText) return null;

  return (
    <SignupPopup
      config={{ quietPaths: QUIET_PATHS }}
      tracking={{ ga4Id }}
      labelledBy={headingId}
      className="au-dialog au-on-plum no-print"
    >
      {(close) => (
        <div className="relative px-7 pb-8 pt-10 sm:px-9">
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full text-on-plum hover:bg-plum-raised"
            aria-label={LETTERS.close}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" className="mb-5">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#E6BCAB" strokeWidth="3" />
            <circle cx="24" cy="24" r="12" fill="#52223F" />
            <ellipse cx="20" cy="19" rx="4" ry="2.4" fill="#FFFFFF" opacity="0.25" />
          </svg>
          <h2 id={headingId} className="au-h2 pr-8">
            {LETTERS.title}
          </h2>
          <p className="mt-3 text-on-plum-soft">{LETTERS.body}</p>
          <div className="mt-6">
            <SignupForm
              config={{
                consentText,
                placeholder: LETTERS.placeholder,
                submitLabel: LETTERS.submit,
                pendingLabel: LETTERS.pending,
                doneMessage: LETTERS.done,
              }}
              source="popup"
              autoFocus
              classNames={{
                form: "space-y-4",
                row: "flex flex-col gap-3",
                input: "field",
                button: "btn-cta w-full",
                consent: "text-[0.8125rem] leading-relaxed text-on-plum-soft",
                link: "au-link text-on-plum",
                done: "rounded-[1rem] bg-plum-raised px-4 py-3",
              }}
            />
          </div>
        </div>
      )}
    </SignupPopup>
  );
}
