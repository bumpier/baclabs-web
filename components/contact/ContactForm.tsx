"use client";

import { useEffect, useId, useRef, useState } from "react";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { CONTACT_MESSAGE_MAX, CONTACT_TOPICS, contactTopic } from "@/lib/contact";

/**
 * The contact form on /contact, posting to app/api/contact. The browser's
 * own validation runs first (required, lengths, email), with the same rules
 * as ContactSchema, so the route's 400 is only for a request that skipped it.
 *
 * A topic can be preselected with ?topic=wholesale, which is how the
 * wholesale section of the page links here.
 */
export function ContactForm() {
  const id = useId();
  const [topicId, setTopicId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; email: string; topic: string } | null>(null);
  const sentPanel = useRef<HTMLDivElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("topic");
    if (wanted && contactTopic(wanted)) setTopicId(wanted);
  }, []);

  // The panel is much shorter than the form it replaces, so the page is left
  // scrolled past it: bring it below the sticky header (html's
  // scroll-padding-top), then move focus there for screen readers.
  useEffect(() => {
    if (!sent) return;
    sentPanel.current?.scrollIntoView({ block: "start" });
    sentHeading.current?.focus({ preventScroll: true });
  }, [sent]);

  const topic = contactTopic(topicId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const field = (k: string) => String(form.get(k) ?? "");
    const body = {
      topic: topicId,
      name: field("name"),
      email: field("email"),
      orderRef: topic?.asksOrder ? field("orderRef") : "",
      message: field("message"),
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
        setError(data.error ?? "Your message could not be sent. Please try again.");
        return;
      }
      setSent({ name: body.name.trim().split(/\s+/)[0] ?? "", email: body.email.trim(), topic: topicId });
    } catch {
      setError("Your message could not be sent. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div
        ref={sentPanel}
        role="status"
        className="rounded-panel border border-line bg-neutral px-5 py-6 sm:px-6"
      >
        <h3 ref={sentHeading} tabIndex={-1} className="text-lg outline-none">
          Message sent
        </h3>
        <p className="measure mt-2 text-base text-ink-soft">
          Thanks{sent.name ? `, ${sent.name}` : ""}. Your message has reached us, and we will reply
          to <span className="text-ink">{sent.email}</span>.
          {sent.topic === "complaint"
            ? ` We aim to acknowledge every complaint within ${COMPLAINT_ACK_DAYS} working days.`
            : ""}
        </p>
        <button
          type="button"
          className="link mt-4 text-sm"
          onClick={() => {
            setSent(null);
            setTopicId("");
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="label" htmlFor={`${id}-topic`}>
          What is it about?
        </label>
        <select
          id={`${id}-topic`}
          name="topic"
          required
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          aria-describedby={topic?.hint ? `${id}-topic-hint` : undefined}
          className="field"
        >
          <option value="" disabled>
            Choose a topic
          </option>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {topic?.hint ? (
          <p id={`${id}-topic-hint`} className="measure mt-2 text-sm text-ink-soft">
            {topic.hint}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-name`}>
            Your name
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-email`}>
            Email
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

      {topic?.asksOrder ? (
        <div>
          <label className="label" htmlFor={`${id}-order`}>
            Order number <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id={`${id}-order`}
            name="orderRef"
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-order-hint`}
            className="field"
          />
          <p id={`${id}-order-hint`} className="mt-2 text-sm text-ink-soft">
            It is in your order confirmation email.
          </p>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor={`${id}-message`}>
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          required
          minLength={10}
          maxLength={CONTACT_MESSAGE_MAX}
          rows={6}
          className="field min-h-40 resize-y"
        />
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

      <div className="space-y-3">
        <button type="submit" disabled={pending} aria-busy={pending} className="btn-cta sm:!w-auto">
          {pending ? "Sending…" : "Send message"}
        </button>
        <p className="text-xs text-ink-soft">
          We use what you send only to reply to you.{" "}
          <a href="/privacy#contact" className="underline underline-offset-4">
            Privacy
          </a>
        </p>
      </div>
    </form>
  );
}
