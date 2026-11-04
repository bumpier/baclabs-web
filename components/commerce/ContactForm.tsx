"use client";

import { useEffect, useId, useRef, useState } from "react";

/** A topic the form offers (lib/commerce/contact.ts brandContactTopics). */
export interface ContactTopicOption {
  /** One of ContactSchema's topic ids (lib/contact.ts): the route refuses any other. */
  id: string;
  label: string;
  /** Show the order number box. Still optional: people lose the email. */
  asksOrder: boolean;
  /** Shown under the topic once it is chosen. */
  hint?: string;
}

type Slot = "form" | "field" | "label" | "input" | "hint" | "error" | "button" | "note" | "link" | "sent" | "sentHeading" | "sentText" | "again";

/**
 * A brand's contact form, posting to /api/contact, which stores the message
 * against the Host's brand and sends it to that brand's inbox. BacLab's is
 * components/contact/ContactForm.tsx; it reads its topics from lib/contact.ts,
 * which carries BacLab's address, so a brand's bundle cannot import it.
 * Everything brand-specific is a prop here instead:
 *  - `topics`: the brand's list, from the server (brandContactTopics);
 *  - `complaintAckDays`: the acknowledgement time its terms publish
 *    (lib/legal.ts COMPLAINT_ACK_DAYS);
 *  - `replyTime`: a general reply promise ("two working days"), only if the
 *    operator has made one. Empty promises nothing, as on BacLab;
 *  - `messageMax`: the route's limit (lib/contact.ts CONTACT_MESSAGE_MAX).
 *
 * A topic can be preselected with ?topic=<id>. The browser's own validation
 * runs first, with ContactSchema's rules, so the route's 400 is only for a
 * request that skipped it. After sending, the confirmation replaces the form
 * and takes focus, for screen readers.
 */
export function ContactForm({
  topics,
  complaintAckDays,
  messageMax,
  replyTime = "",
  privacyHref = "/privacy#contact",
  classNames = {},
}: {
  topics: readonly ContactTopicOption[];
  complaintAckDays: number;
  messageMax: number;
  replyTime?: string;
  privacyHref?: string;
  classNames?: Partial<Record<Slot, string>>;
}) {
  const id = useId();
  const [topicId, setTopicId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; email: string; topic: string } | null>(null);
  const sentPanel = useRef<HTMLDivElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const c = (slot: Slot, fallback: string) => classNames[slot] ?? fallback;

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("topic");
    if (wanted && topics.some((t) => t.id === wanted)) setTopicId(wanted);
  }, [topics]);

  useEffect(() => {
    if (!sent) return;
    sentPanel.current?.scrollIntoView({ block: "start" });
    sentHeading.current?.focus({ preventScroll: true });
  }, [sent]);

  const topic = topics.find((t) => t.id === topicId);

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
      <div ref={sentPanel} role="status" className={c("sent", "commerce-panel px-5 py-6")}>
        <h3 ref={sentHeading} tabIndex={-1} className={c("sentHeading", "text-lg font-semibold outline-none")}>
          Message sent
        </h3>
        <p className={c("sentText", "mt-2")}>
          Thanks{sent.name ? `, ${sent.name}` : ""}. Your message has reached us, and we will reply to{" "}
          <span className="font-medium">{sent.email}</span>
          {replyTime ? ` within ${replyTime}` : ""}.
          {sent.topic === "complaint"
            ? ` We aim to acknowledge every complaint within ${complaintAckDays} working days.`
            : ""}
        </p>
        <button
          type="button"
          className={c("again", "link mt-4 text-sm")}
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
    <form onSubmit={submit} className={c("form", "space-y-6")}>
      <div className={c("field", "")}>
        <label className={c("label", "label")} htmlFor={`${id}-topic`}>
          What is it about?
        </label>
        <select
          id={`${id}-topic`}
          name="topic"
          required
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          aria-describedby={topic?.hint ? `${id}-topic-hint` : undefined}
          className={c("input", "field")}
        >
          <option value="" disabled>
            Choose a topic
          </option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {topic?.hint ? (
          <p id={`${id}-topic-hint`} className={c("hint", "mt-2 text-sm")}>
            {topic.hint}
          </p>
        ) : null}
      </div>

      <div className={c("field", "")}>
        <label className={c("label", "label")} htmlFor={`${id}-name`}>
          Your name
        </label>
        <input
          id={`${id}-name`}
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          className={c("input", "field")}
        />
      </div>

      <div className={c("field", "")}>
        <label className={c("label", "label")} htmlFor={`${id}-email`}>
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
          className={c("input", "field")}
        />
      </div>

      {topic?.asksOrder ? (
        <div className={c("field", "")}>
          <label className={c("label", "label")} htmlFor={`${id}-order`}>
            Order number (optional)
          </label>
          <input
            id={`${id}-order`}
            name="orderRef"
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-order-hint`}
            className={c("input", "field")}
          />
          <p id={`${id}-order-hint`} className={c("hint", "mt-2 text-sm")}>
            It is in your order confirmation email.
          </p>
        </div>
      ) : null}

      <div className={c("field", "")}>
        <label className={c("label", "label")} htmlFor={`${id}-message`}>
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          required
          minLength={10}
          maxLength={messageMax}
          rows={6}
          className={c("input", "field")}
        />
      </div>

      {/* Honeypot: off screen and out of the tab order, so only a bot fills it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error ? (
        <p role="alert" className={c("error", "alert-error")}>
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} aria-busy={pending} className={c("button", "btn-cta")}>
          {pending ? "Sending…" : "Send message"}
        </button>
        <p className={c("note", "mt-3 text-xs")}>
          We use what you send only to reply to you.{" "}
          <a href={privacyHref} className={c("link", "link")}>
            Privacy
          </a>
        </p>
      </div>
    </form>
  );
}
