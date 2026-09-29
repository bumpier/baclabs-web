"use client";

import { useId, useState } from "react";
import { MAILING_LIST } from "@/config/funnel";
import { markSubscribed } from "@/components/mailing-list/status";

const OFFER_ON = MAILING_LIST.enabled && MAILING_LIST.welcomeVial.enabled;

/**
 * The email field, the consent line and the button. Used by the popup, the
 * footer and the panel beside the buy blocks; `tone` matches the ground it
 * sits on. The consent line is shown with the form, not behind a link,
 * because it is the record of what the subscriber agreed to.
 */
export function SignupForm({
  source,
  tone = "light",
  autoFocus = false,
  onDone,
}: {
  source: "popup" | "footer" | "inline";
  tone?: "light" | "dark";
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!MAILING_LIST.enabled) return null;
  const dark = tone === "dark";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, ...(website ? { website } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      markSubscribed(OFFER_ON);
      onDone?.();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p role="status" className={dark ? "text-sm text-white" : "alert-note"}>
        {OFFER_ON
          ? "You're on the list. Your free vial is added automatically when you order from this browser, or with this email. Check your inbox for the details."
          : "You're on the list. Check your inbox."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={
            dark
              ? "w-full rounded-control border border-white/25 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/45 focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/20"
              : "field"
          }
        />
        {/* Honeypot: off screen and out of the tab order, so only a bot fills it. */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor={`${id}-website`}>Website</label>
          <input
            id={`${id}-website`}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={
            dark
              ? "btn-onDark shrink-0 !bg-white !text-abyss hover:!bg-white/90"
              : "btn-cta shrink-0 sm:!w-auto"
          }
        >
          {pending ? "Signing up…" : OFFER_ON ? "Get my free vial" : "Sign up"}
        </button>
      </div>
      {error ? (
        <p role="alert" className={dark ? "text-sm text-white" : "alert-error"}>
          {error}
        </p>
      ) : null}
      <p className={`text-xs ${dark ? "text-white/55" : "text-ink-soft"}`}>
        {MAILING_LIST.consentText}{" "}
        <a href="/privacy#mailing-list" className="underline underline-offset-4">
          Privacy
        </a>
      </p>
    </form>
  );
}
