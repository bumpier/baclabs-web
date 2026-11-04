"use client";

import { useId, useState } from "react";
import { markSubscribed } from "@/components/mailing-list/status";

export interface SignupConfig {
  /**
   * The brand's consent words (storefrontView's mailingList.consentText).
   * /api/subscribe stores the brand profile's text as the record of what
   * the subscriber agreed to, so the form must show exactly that. Empty:
   * the brand runs no list and the form renders nothing.
   */
  consentText: string;
  privacyHref?: string;
  placeholder?: string;
  submitLabel?: string;
  pendingLabel?: string;
  /** Shown in place of the form once the signup is in. */
  doneMessage?: string;
}

/**
 * A brand's mailing-list signup: the email field, the consent line and the
 * button, posting to /api/subscribe, which joins the list of the Host's
 * brand. BacLab's is components/mailing-list/SignupForm.tsx, with its
 * welcome-vial offer; no other brand has one, so there is no offer here.
 *
 * The consent line sits with the form, never behind a link. Every element
 * takes a class; the defaults are the shared class contract
 * (styles/commerce-contract.css).
 */
export function SignupForm({
  config,
  source,
  autoFocus = false,
  onDone,
  classNames = {},
}: {
  config: SignupConfig;
  source: "popup" | "footer" | "inline";
  autoFocus?: boolean;
  onDone?: () => void;
  classNames?: Partial<Record<"form" | "row" | "input" | "button" | "error" | "consent" | "link" | "done", string>>;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!config.consentText) return null;

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
      markSubscribed(false);
      onDone?.();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p role="status" className={classNames.done ?? "alert-note"}>
        {config.doneMessage ?? "You're on the list. Check your inbox."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={classNames.form ?? "space-y-3"}>
      <div className={classNames.row ?? "flex flex-col gap-2 sm:flex-row"}>
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
          placeholder={config.placeholder ?? "you@example.com"}
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={classNames.input ?? "field"}
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
        <button type="submit" disabled={pending} aria-busy={pending} className={classNames.button ?? "btn-cta shrink-0"}>
          {pending ? (config.pendingLabel ?? "Signing up…") : (config.submitLabel ?? "Sign up")}
        </button>
      </div>
      {error ? (
        <p role="alert" className={classNames.error ?? "alert-error"}>
          {error}
        </p>
      ) : null}
      <p className={classNames.consent ?? "text-xs"}>
        {config.consentText}{" "}
        <a href={config.privacyHref ?? "/privacy#mailing-list"} className={classNames.link ?? "link"}>
          Privacy
        </a>
      </p>
    </form>
  );
}
