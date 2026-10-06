"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Truck } from "lucide-react";
import { nextDayOffered } from "@/config/funnel";
import { dayAfter, formatCutoffHour, formatDeliveryDay, nextDayDeadline, ukDayKey } from "@/lib/delivery-date";

/**
 * The next-day countdown: "Want it tomorrow? Order within 02:14:33".
 *
 * WHY IT CAN RENDER NOTHING. It promises a service, so it shows only where
 * checkout can sell that service (nextDayOffered). While the delivery choice
 * is off in live, the customer cannot pick Next day, and a banner saying they
 * can would be a misleading claim under the CPUTR / DMCC Act.
 *
 * WHY THE CLOCK IS CLIENT-ONLY. Storefront pages are cached for five minutes
 * (app/(store)/layout.tsx), so a countdown rendered on the server would be
 * up to five minutes wrong before it ever reached the screen. The server and
 * the no-JS page get the timeless line, "Order by 3pm for next-day delivery",
 * in a box of the same height, and the ticking clock replaces it after
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
 * The clock's tiles. Under a day: hours, minutes, seconds. A day or more out
 * (a Friday evening, a bank-holiday weekend): days, hours, minutes, since a
 * seconds hand 60 hours from the deadline is noise, not urgency.
 */
function tilesFor(secondsLeft: number): { value: string; unit: string }[] {
  const days = Math.floor(secondsLeft / 86_400);
  const hours = Math.floor((secondsLeft % 86_400) / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  if (days > 0) {
    return [
      { value: String(days), unit: days === 1 ? "day" : "days" },
      { value: pad(hours), unit: "hrs" },
      { value: pad(mins), unit: "mins" },
    ];
  }
  return [
    { value: pad(hours), unit: "hrs" },
    { value: pad(mins), unit: "mins" },
    { value: pad(secs), unit: "secs" },
  ];
}

/** "2 hours 14 minutes" — for screen readers, to the minute. */
function spokenDuration(secondsLeft: number): string {
  if (secondsLeft < 60) return "under a minute";
  const days = Math.floor(secondsLeft / 86_400);
  const hours = Math.floor((secondsLeft % 86_400) / 3600);
  // Floored, like the tiles, so the two never disagree.
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

  return (
    <section aria-label="Next-day delivery" className="no-print relative overflow-hidden bg-abyss text-white">
      {/* A cyan rule along the top: the band's one hard edge of colour,
          so it reads as an alert rather than as more footer. */}
      <div aria-hidden="true" className="h-1 bg-gradient-to-r from-cyan via-brand to-cyan" />

      <div className="shell-wide flex flex-col items-center gap-3 py-4 sm:py-5 lg:flex-row lg:justify-center lg:gap-10">
        {/* Headline */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            aria-hidden="true"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan text-abyss sm:h-14 sm:w-14"
          >
            <Truck className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.25} />
            {/* "Live" pulse. Off for anyone who has asked for less motion. */}
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-abyss bg-cyan" />
            </span>
          </span>
          <div>
            <p className="font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
              {when ? (
                <>
                  Want it <span className="text-cyan">{when}</span>?
                </>
              ) : (
                <>
                  <span className="text-cyan">Next-day</span> delivery
                </>
              )}
            </p>
            <p className="mt-0.5 text-sm text-white/70 sm:text-base">
              {/* Two lines on a phone, broken at the dot, rather than one
                  that wraps and strands "at checkout" on its own. */}
              {deliveryDate ? <>Delivered {deliveryDate}</> : <>Order by {cutoffLabel}</>}
              <span className="hidden sm:inline"> &middot; </span>
              <br className="sm:hidden" />
              Choose Next day at checkout
            </p>
          </div>
        </div>

        {/* The clock. Fixed height in both states so hydration moves nothing. */}
        <div className="flex h-[76px] items-center gap-3 sm:h-[88px] sm:gap-4">
          {deadline ? (
            <>
              <p className="text-right text-xs font-semibold uppercase leading-tight tracking-[0.14em] text-white/70 sm:text-sm">
                Order
                <br />
                within
              </p>
              {/* The visual clock is hidden from screen readers, which get
                  the sentence below instead: a region that changed every
                  second would be either silent or unbearable. */}
              <ol aria-hidden="true" className="flex items-start gap-1.5 sm:gap-2">
                {tilesFor(secondsLeft).map((t, i) => (
                  <li key={t.unit} className="flex items-start gap-1.5 sm:gap-2">
                    {i > 0 ? (
                      <span className="pt-2 font-display text-2xl font-bold text-cyan sm:pt-2.5 sm:text-4xl">:</span>
                    ) : null}
                    <span className="flex flex-col items-center">
                      {/* tabular-nums despite the display size (see .tabular
                          in globals.css): there is no decimal point here, and
                          without it the digits shuffle sideways every second. */}
                      <span className="flex h-14 min-w-14 items-center justify-center rounded-control bg-white px-2 font-display text-3xl font-bold tabular-nums text-abyss shadow-[0_0_0_3px_rgb(0_209_255/0.35)] sm:h-16 sm:min-w-16 sm:text-4xl">
                        {t.value}
                      </span>
                      <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                        {t.unit}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="sr-only">
                Order within {spokenDuration(secondsLeft)} for delivery{" "}
                {when === "tomorrow" ? `tomorrow, ${deliveryDate}` : `on ${deliveryDate}`}.
              </p>
            </>
          ) : (
            <p className="font-display text-xl font-bold sm:text-2xl">
              Order by <span className="text-cyan">{cutoffLabel}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
