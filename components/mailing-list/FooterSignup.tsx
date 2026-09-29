"use client";

import { MAILING_LIST } from "@/config/funnel";
import { SignupForm } from "@/components/mailing-list/SignupForm";
import { useMailingStatus } from "@/components/mailing-list/status";

/** The signup band across the top of the footer. Hidden once signed up. */
export function FooterSignup() {
  const status = useMailingStatus();
  if (!MAILING_LIST.enabled || status?.subscribed) return null;

  return (
    <section
      id="signup"
      aria-labelledby="footer-signup-heading"
      className="mb-14 grid gap-6 border-b border-white/10 pb-14 lg:grid-cols-12 lg:items-center"
    >
      <div className="lg:col-span-5">
        <h2 id="footer-signup-heading" className="font-display text-2xl font-bold text-white">
          {MAILING_LIST.headline || "Join the mailing list"}
        </h2>
        {MAILING_LIST.offerLine ? <p className="mt-2 text-white/60">{MAILING_LIST.offerLine}</p> : null}
      </div>
      <div className="lg:col-span-7">
        <SignupForm source="footer" tone="dark" />
      </div>
    </section>
  );
}
