import type { GuideFaq } from "@/content/guides/types";
import { RichText } from "@/components/guides/RichText";

/**
 * Server-rendered question list on native <details>. The home page FAQ
 * animates its rows (components/funnel/Faq.tsx); these do not need to, and
 * staying server-side keeps every answer in the HTML for crawlers and for
 * find-in-page. `open` on the first row so the page never looks empty.
 */
export function FaqList({ items, openFirst = true }: { items: readonly GuideFaq[]; openFirst?: boolean }) {
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <details
          key={f.q}
          open={openFirst && i === 0}
          className="group rounded-panel border border-line bg-surface px-5 open:border-brand/35 sm:px-6"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-base font-semibold text-ink">{f.q}</span>
            <span
              aria-hidden="true"
              className="mt-1 shrink-0 transition-transform duration-200 group-open:rotate-45"
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
          <p className="measure pb-5 text-base text-ink-soft">
            <RichText text={f.a} />
          </p>
        </details>
      ))}
    </div>
  );
}
