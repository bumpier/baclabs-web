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
 * Layout: two independent columns on wider screens, hairline-separated rows
 * rather than cards. Twelve stacked cards was the tallest block on the page.
 * The columns are separate lists, not one CSS grid, so opening a row only
 * grows its own column instead of leaving a hole beside it. Every row starts
 * closed: the plain-English definition now has its own section higher up.
 */
export function Faq() {
  const half = Math.ceil(FAQ.length / 2);
  const columns = [FAQ.slice(0, half), FAQ.slice(half)];

  return (
    <div className="grid gap-x-12 border-t border-line md:grid-cols-2">
      {columns.map((items, c) => (
        <div key={c}>
          {items.map((item) => (
            <FaqRow key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="border-b border-line"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-3.5 text-left [&::-webkit-details-marker]:hidden">
        <span
          className={[
            "text-[15px] font-medium",
            open ? "text-brand" : "text-ink",
          ].join(" ")}
        >
          {question}
        </span>
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
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
          <p className="pb-4 pr-8 text-[15px] leading-relaxed text-ink-soft">
            {answer}
          </p>
        </div>
      </div>
    </details>
  );
}
