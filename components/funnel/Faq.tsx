"use client";

import { useState } from "react";
import { FAQ } from "@/config/faq";

/**
 * Accordion built on native <details>/<summary>.
 *
 * Native gives keyboard support, the correct expanded/collapsed semantics and
 * find-in-page for free. The only thing it does not give is an animated open,
 * so the height is animated with a CSS grid-rows trick (0fr → 1fr), which
 * transitions smoothly without needing a measured pixel height and without
 * ever blocking the click.
 *
 * Rows are cards rather than hairline-separated lines: at the wider measure
 * the page now uses, a bare rule left the question stranded from its answer.
 */
export function Faq() {
  return (
    <div className="space-y-3">
      {FAQ.map((item, i) => (
        // The first row opens by default so the plain-English definition is
        // readable without a click — it was the only place on the page a
        // first-time visitor could find one, and it was collapsed.
        <FaqRow key={i} question={item.q} answer={item.a} defaultOpen={i === 0} />
      ))}
    </div>
  );
}

function FaqRow({
  question,
  answer,
  defaultOpen = false,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={[
        "rounded-panel border bg-surface px-5 transition-colors duration-150 sm:px-6",
        open ? "border-brand/35" : "border-line",
      ].join(" ")}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
        <span className="text-base font-semibold text-ink">{question}</span>
        {/* A 45° rotation reads as +/− without needing two icons. 200ms is
            long enough to see, short enough not to gate the reading. */}
        <span
          aria-hidden="true"
          className="mt-1 shrink-0 transition-transform duration-200"
          style={{
            transitionTimingFunction: "var(--ease-out)",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 1v14M1 8h14"
              stroke="var(--color-primary)"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </summary>

      {/* grid-rows 0fr → 1fr animates to the content's natural height with no
          measurement and no layout thrash. */}
      <div
        className="grid transition-[grid-template-rows] duration-200"
        style={{
          transitionTimingFunction: "var(--ease-out)",
          gridTemplateRows: open ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="measure pb-5 text-base text-ink-soft">
            <p>{answer}</p>
          </div>
        </div>
      </div>
    </details>
  );
}
