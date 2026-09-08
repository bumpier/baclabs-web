import { trustBadges, type TrustIcon } from "@/config/funnel";

/**
 * The band of reasons to buy here rather than somewhere else.
 *
 * It sits directly under the hero — the first thing after the price — because
 * the two objections it answers ("is this the best price?" and "what does
 * delivery cost?") are the ones a shopper raises before they will read a
 * specification.
 *
 * Every card is read from `trustBadges()`, so nothing here is a claim typed
 * into a component: withdraw a badge in config/funnel.ts and it leaves this
 * bar, the hero, the sticky bar and the announcement bar together. Each card
 * carries its own substantiation line rather than the label alone, which is
 * what keeps a superlative like "cheapest in the UK" attached to the
 * undertaking that backs it.
 */
export function TrustBar() {
  const badges = trustBadges();
  if (badges.length === 0) return null;

  return (
    <section className="border-y border-line bg-neutral" aria-labelledby="trust-heading">
      <div className="shell-wide py-10 sm:py-12">
        <h2 id="trust-heading" className="sr-only">
          Why buy from us
        </h2>
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((b) => (
            <li key={b.label} className="flex gap-3">
              <TrustMark icon={b.icon} />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-ink">
                  {b.href ? (
                    <a
                      href={b.href}
                      className="underline decoration-line underline-offset-4 transition-colors duration-150 hover:decoration-brand"
                    >
                      {b.label}
                    </a>
                  ) : (
                    b.label
                  )}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{b.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * One 20px mark per badge kind. Stroked, not filled, so they sit at the same
 * visual weight as the hero's check mark, and `aria-hidden` throughout — the
 * label beside each one is already the accessible text.
 */
function TrustMark({ icon }: { icon: TrustIcon }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "var(--color-primary)",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "mt-0.5 shrink-0",
  };

  switch (icon) {
    // A price tag.
    case "price":
      return (
        <svg {...common}>
          <path d="M10.6 2.5H16a1.5 1.5 0 0 1 1.5 1.5v5.4a1.5 1.5 0 0 1-.44 1.06l-6.1 6.1a1.5 1.5 0 0 1-2.12 0l-5.4-5.4a1.5 1.5 0 0 1 0-2.12l6.1-6.1a1.5 1.5 0 0 1 1.06-.44Z" />
          <circle cx="13.6" cy="6.4" r="1.15" />
        </svg>
      );
    // A delivery van.
    case "delivery":
      return (
        <svg {...common}>
          <path d="M1.8 5.2h9.4v8.2H1.8z" />
          <path d="M11.2 8h3l3 2.6v2.8h-6z" />
          <circle cx="5.4" cy="15.4" r="1.7" />
          <circle cx="13.6" cy="15.4" r="1.7" />
        </svg>
      );
    // A padlock.
    case "secure":
      return (
        <svg {...common}>
          <rect x="3.6" y="8.6" width="12.8" height="8.4" rx="1.6" />
          <path d="M6.8 8.6V6.3a3.2 3.2 0 0 1 6.4 0v2.3" />
        </svg>
      );
    // The vial itself, matching the mark in the logo.
    case "sealed":
      return (
        <svg {...common}>
          <path d="M7.4 2.4h5.2" />
          <path d="M8 2.4v2.2L6.4 6.4v9.1a1.5 1.5 0 0 0 1.5 1.5h4.2a1.5 1.5 0 0 0 1.5-1.5V6.4L12 4.6V2.4" />
          <path d="M6.4 10.6h7.2" />
        </svg>
      );
  }
}
