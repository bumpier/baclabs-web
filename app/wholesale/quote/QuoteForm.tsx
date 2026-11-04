"use client";

import { useEffect, useId, useRef, useState } from "react";
import { QUOTE_FORM } from "@/brands/wholesale/copy/pages";

const OTHER = "other";

/**
 * The quote request: the facts a quote needs as real fields (pack size,
 * how many, the delivery postcode, one-off or recurring), composed into one
 * message for /api/contact under the trade topic, which files it as a
 * wholesale enquiry in /admin/messages and sends it to this brand's inbox.
 *
 * Brand-local rather than the kit's ContactForm, which asks for a topic and
 * one free-text message: here the topic is fixed and the message is built
 * from the fields. It keeps the kit form's contract with the route word for
 * word: the same fields, the browser's validation with ContactSchema's
 * limits first, the honeypot, the route's own error sentence, and the sent
 * panel that takes focus. A ?pack=<vials> link from the price list presets
 * the pack size.
 */
export function QuoteForm({
  packs,
  messageMax,
  privacyHref = "/privacy#contact",
}: {
  /** The packs sold by quote, from the storefront view. */
  packs: readonly { sku: string; vials: number; label: string }[];
  /** The route's limit (lib/contact.ts CONTACT_MESSAGE_MAX). */
  messageMax: number;
  privacyHref?: string;
}) {
  const id = useId();
  const [pack, setPack] = useState(packs[0] ? String(packs[0].vials) : OTHER);
  const [recurring, setRecurring] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("pack");
    if (wanted && packs.some((p) => String(p.vials) === wanted)) setPack(wanted);
  }, [packs]);

  useEffect(() => {
    if (!sent) return;
    sentHeading.current?.scrollIntoView({ block: "center" });
    sentHeading.current?.focus({ preventScroll: true });
  }, [sent]);

  const other = pack === OTHER;
  const chosen = packs.find((p) => String(p.vials) === pack);
  // The composed lines take a few hundred characters; the notes get the rest.
  const notesMax = Math.max(200, messageMax - 600);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const field = (k: string) => String(form.get(k) ?? "").trim();
    const message = QUOTE_FORM.message({
      pack: chosen ? chosen.label : QUOTE_FORM.otherSize,
      countLabel: other ? QUOTE_FORM.vialsWanted : QUOTE_FORM.packs,
      count: field("count"),
      postcode: field("postcode").toUpperCase(),
      frequency: recurring ? QUOTE_FORM.recurring : QUOTE_FORM.oneOff,
      often: recurring ? field("often") : "",
      company: field("company"),
      notes: field("notes"),
    });
    const body = {
      topic: "wholesale",
      name: field("name"),
      email: field("email"),
      orderRef: "",
      message: message.slice(0, messageMax),
      ...(field("website") ? { website: field("website") } : {}),
    };
    setPending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? QUOTE_FORM.failed);
        return;
      }
      setSent({ name: body.name.split(/\s+/)[0] ?? "", email: body.email });
    } catch {
      setError(QUOTE_FORM.offline);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="vh-sent">
        <h3 ref={sentHeading} tabIndex={-1} className="vh-sent-title">
          {QUOTE_FORM.sentHeading}
        </h3>
        <p className="text-ink">{QUOTE_FORM.sent(sent.name, sent.email)}</p>
        <button type="button" className="link text-sm" onClick={() => setSent(null)}>
          {QUOTE_FORM.again}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="vh-form grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-pack`} className="label">
            {QUOTE_FORM.pack}
          </label>
          <select id={`${id}-pack`} name="pack" className="field" value={pack} onChange={(e) => setPack(e.target.value)}>
            {packs.map((p) => (
              <option key={p.sku} value={String(p.vials)}>
                {p.label}
              </option>
            ))}
            <option value={OTHER}>{QUOTE_FORM.otherSize}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-count`} className="label">
            {other ? QUOTE_FORM.vialsWanted : QUOTE_FORM.packs}
          </label>
          <input
            id={`${id}-count`}
            name="count"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={other ? 1_000_000 : 999}
            step={1}
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-postcode`} className="label">
          {QUOTE_FORM.postcode}
        </label>
        <input
          id={`${id}-postcode`}
          name="postcode"
          required
          minLength={2}
          maxLength={10}
          autoComplete="postal-code"
          autoCapitalize="characters"
          spellCheck={false}
          className="field sm:max-w-48"
        />
      </div>

      <fieldset>
        <legend className="label">{QUOTE_FORM.frequency}</legend>
        <div className="vh-segment">
          <label>
            <input type="radio" name={`${id}-frequency`} checked={!recurring} onChange={() => setRecurring(false)} />
            <span>{QUOTE_FORM.oneOff}</span>
          </label>
          <label>
            <input type="radio" name={`${id}-frequency`} checked={recurring} onChange={() => setRecurring(true)} />
            <span>{QUOTE_FORM.recurring}</span>
          </label>
        </div>
      </fieldset>

      {recurring ? (
        <div>
          <label htmlFor={`${id}-often`} className="label">
            {QUOTE_FORM.often}
          </label>
          <input id={`${id}-often`} name="often" maxLength={100} aria-describedby={`${id}-often-hint`} className="field" />
          <p id={`${id}-often-hint`} className="vh-form-hint mt-2">
            {QUOTE_FORM.oftenHint}
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-company`} className="label">
            {QUOTE_FORM.company}
          </label>
          <input id={`${id}-company`} name="company" maxLength={100} autoComplete="organization" className="field" />
        </div>
        <div>
          <label htmlFor={`${id}-name`} className="label">
            {QUOTE_FORM.name}
          </label>
          <input id={`${id}-name`} name="name" required minLength={2} maxLength={100} autoComplete="name" className="field" />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="label">
            {QUOTE_FORM.email}
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-notes`} className="label">
          {QUOTE_FORM.notes}
        </label>
        <textarea id={`${id}-notes`} name="notes" maxLength={notesMax} rows={4} className="field" />
      </div>

      {/* Honeypot: off screen and out of the tab order, so only a bot fills it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error ? (
        <p role="alert" className="alert-error">
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} aria-busy={pending} className="btn-cta vh-btn-lg w-full sm:w-auto sm:min-w-56">
          {pending ? QUOTE_FORM.sending : QUOTE_FORM.send}
        </button>
        <p className="vh-form-note mt-3">
          {QUOTE_FORM.privacy}{" "}
          <a href={privacyHref} className="link">
            {QUOTE_FORM.privacyLink}
          </a>
        </p>
      </div>
    </form>
  );
}
