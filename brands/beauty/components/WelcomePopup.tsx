"use client";

import { useId } from "react";
import { DEFAULT_QUIET_PATHS, SignupPopup } from "@/components/commerce/SignupPopup";
import { SignupForm } from "@/components/commerce/SignupForm";
import { LETTERS } from "@/brands/beauty/copy/home";
import { IMAGES } from "@/brands/beauty/copy/images";
import { CloseIcon } from "./icons";
import { Photo } from "./Photo";

/**
 * The list's welcome, as the kit's SignupPopup with this brand's manners: a
 * few seconds after landing or on leaving through the top of the window,
 * never on the kit's quiet pages (paying, the receipt, the legal pages,
 * contact), and never on /clinics either, whose visitors come to order for
 * a business. What it offers is what the consent line says the list sends,
 * and nothing more: the profile's words, shown as they are, because
 * /api/subscribe stores them as the record.
 *
 * Client-side because the popup takes a render function for its content,
 * which cannot cross from the server layout; and because DEFAULT_QUIET_PATHS
 * is a client module's export, which only a client component reads as a list.
 */
const QUIET_PATHS = [...DEFAULT_QUIET_PATHS, "/clinics"];

export function WelcomePopup({ consentText, ga4Id }: { consentText: string; ga4Id: string | null }) {
  const headingId = useId();
  if (!consentText) return null;

  return (
    <SignupPopup
      config={{ quietPaths: QUIET_PATHS }}
      tracking={{ ga4Id }}
      labelledBy={headingId}
      className="bb-dialog bb-on-plum no-print"
    >
      {(close) => (
        <div className="relative">
          <div className="relative aspect-[16/9] bg-blush">
            <Photo image={IMAGES.setOfFive} fill sizes="27rem" alt="" className="object-[50%_52%]" />
          </div>
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-ink hover:bg-surface"
            aria-label={LETTERS.close}
          >
            <CloseIcon />
          </button>
          <div className="px-7 pb-8 pt-7 sm:px-9">
            <h2 id={headingId} className="bb-h2 text-[2.25rem]">
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
                  link: "bb-link text-on-plum",
                  done: "rounded-[1rem] bg-plum-raised px-4 py-3",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </SignupPopup>
  );
}
