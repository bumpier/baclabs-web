"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { nextDayOffered } from "@/config/funnel";
import { dayAfter, formatCutoffHour, formatDeliveryDay, nextDayDeadline, ukDayKey } from "@/lib/delivery-date";

/**
 * The next-day countdown: "Want it tomorrow? Order within 02h 14m 33s".
 *
 * WHY IT LOOKS LIKE THE HEADER. It is a strip, not a band: the neutral wash,
 * a hairline under it and 14px text, so it reads as part of the header
 * rather than as a second hero. The page's one dark band is the footer, and
 * on the home page the announcement bar directly below may be solid blue,
 * so anything louder here stacks three heavy bands above the price.
 *
 * WHY IT CAN RENDER NOTHING. It promises a service, so it shows only where
 * checkout can sell that service (nextDayOffered). While the delivery choice
 * is off in live, the customer cannot pick Next day, and a banner saying they
 * can would be a misleading claim under the CPUTR / DMCC Act.
 *
 * WHY THE CLOCK IS CLIENT-ONLY. Storefront pages are cached for five minutes
 * (app/(store)/layout.tsx), so a countdown rendered on the server would be
 * up to five minutes wrong before it ever reached the screen. The server and
 * the no-JS page get the timeless line, "Next-day delivery, order by 3pm",
 * on the same number of lines, and the ticking clock replaces it after
 * hydration with nothing below it moving.
 *
 * WHY THE DAY IS NAMED. After the cutoff, at weekends and over bank holidays
 * the next delivery is not tomorrow, and "next-day delivery" alone would
 * imply it is. The headline names the day the order actually arrives.
 */

// One tick a second, shared by every subscriber. useSyncExternalStore rather
// than useState + useEffect: the server snapshot (null) is what hydration
// renders, so the server HTML and the first client render agree, and the
// real time takes over immediately afterwards.
function subscribe(onTick: () => void) {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
}
// Whole seconds, so two reads within the same second return the same value
// and React sees a stable snapshot.
const nowSeconds = () => Math.floor(Date.now() / 1000);
const serverSeconds = () => null;

// Payment and the receipt are past the point of choosing a delivery.
const HIDDEN_ON = ["/checkout", "/order-confirmation"];

const cutoffLabel = formatCutoffHour();

// The headline's day in full, "Want it Wednesday?". The date beside it is
// formatDeliveryDay, the same "Wed 7 Oct" checkout shows.
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" });
const weekdayOf = (dayKey: string) => weekdayFmt.format(new Date(`${dayKey}T12:00:00Z`));

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The clock's parts, "03h 17m 44s". Under a day: hours, minutes, seconds. A
 * day or more out (a Friday evening, a bank-holiday weekend): days, hours,
 * minutes, since a seconds hand 60 hours from the deadline is noise, not
 * urgency.
 */
function clockFor(secondsLeft: number): { value: string; unit: string }[] {
  const days = Math.floor(secondsLeft / 86_400);
  const hours = Math.floor((secondsLeft % 86_400) / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  if (days > 0) {
    return [
      { value: String(days), unit: "d" },
      { value: pad(hours), unit: "h" },
      { value: pad(mins), unit: "m" },
    ];
  }
  return [
    { value: pad(hours), unit: "h" },
    { value: pad(mins), unit: "m" },
    { value: pad(secs), unit: "s" },
  ];
}

/** "2 hours 14 minutes" — for screen readers, to the minute. */
function spokenDuration(secondsLeft: number): string {
  if (secondsLeft < 60) return "under a minute";
  const days = Math.floor(secondsLeft / 86_400);
  const hours = Math.floor((secondsLeft % 86_400) / 3600);
  // Floored, like the clock, so the two never disagree.
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const part = (n: number, word: string) => (n > 0 ? `${n} ${word}${n === 1 ? "" : "s"}` : "");
  return [part(days, "day"), part(hours, "hour"), part(mins, "minute")].filter(Boolean).join(" ");
}

export function NextDayBanner() {
  const pathname = usePathname();
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSeconds);

  if (!nextDayOffered()) return null;
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const at = now === null ? null : new Date(now * 1000);
  const deadline = at ? nextDayDeadline(at) : null;
  const secondsLeft = deadline ? Math.max(0, Math.floor(deadline.cutoff.getTime() / 1000) - now!) : 0;
  const deliveryDate = deadline ? formatDeliveryDay(deadline.deliveryDayKey) : null;
  const when = !deadline
    ? null
    : deadline.deliveryDayKey === dayAfter(ukDayKey(at!))
      ? "tomorrow"
      : weekdayOf(deadline.deliveryDayKey);

  const headline = when ? `Want it ${when}?` : "Next-day delivery";

  // Two layouts rather than one that wraps. A centred sentence wraps
  // unpredictably on a 360px phone, and "Wednesday" is longer than
  // "tomorrow", so the phone gets two fixed rows with the clock set apart on
  // the right. The server text and the ticking text fill the same rows in
  // both layouts, so hydration moves nothing.
  return (
    <section aria-label="Next-day delivery" className="no-print border-b border-line bg-neutral text-sm">
      {/* Phone: headline and instruction left, clock right. */}
      <div className="shell-wide flex items-center justify-between gap-4 py-2 sm:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <VanMark />
          <div>
            <p className="font-semibold text-ink">{headline}</p>
            <p className="text-xs text-ink-soft">Choose Next day at checkout</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-soft">{deadline ? "Order within" : "Order by"}</p>
          {deadline ? (
            <Clock secondsLeft={secondsLeft} />
          ) : (
            <p className="font-semibold text-brand">{cutoffLabel}</p>
          )}
        </div>
      </div>

      {/* sm and up: one centred line. */}
      <div className="shell-wide hidden min-h-11 items-center justify-center gap-3 py-2 sm:flex">
        <p className="flex items-center gap-2 text-ink">
          <VanMark />
          <span>
            <span className="font-semibold">{headline}</span>
            {deadline ? (
              <>
                {" "}
                Order within <Clock secondsLeft={secondsLeft} />
              </>
            ) : (
              <>, order by {cutoffLabel}</>
            )}
          </span>
        </p>
        <span aria-hidden="true" className="text-ink-soft">
          &middot;
        </span>
        <p className="text-ink-soft">
          {deliveryDate ? <>Arrives {deliveryDate}. </> : null}
          Choose Next day at checkout
        </p>
      </div>

      {deadline ? (
        <p className="sr-only">
          Order within {spokenDuration(secondsLeft)} for delivery{" "}
          {when === "tomorrow" ? `tomorrow, ${deliveryDate}` : `on ${deliveryDate}`}.
        </p>
      ) : null}
    </section>
  );
}

/**
 * The visible clock, hidden from screen readers, which get the sentence at
 * the foot of the banner instead: a region that changed every second would be
 * either silent or unbearable. `.tabular` so the digits hold their places
 * rather than shuffling sideways every second.
 */
function Clock({ secondsLeft }: { secondsLeft: number }) {
  return (
    <span aria-hidden="true" className="tabular inline-block font-semibold text-brand">
      {clockFor(secondsLeft).map((p, i) => (
        <span key={p.unit}>
          {i > 0 ? " " : null}
          {p.value}
          <span className="font-medium">{p.unit}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * The trust bar's delivery van at the same 1.6 stroke, so the banner draws
 * from the page's one set of marks rather than an icon library.
 */
function VanMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--color-primary)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M1.8 5.2h9.4v8.2H1.8z" />
      <path d="M11.2 8h3l3 2.6v2.8h-6z" />
      <circle cx="5.4" cy="15.4" r="1.7" />
      <circle cx="13.6" cy="15.4" r="1.7" />
    </svg>
  );
}
