"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  ANNOUNCEMENT,
  PRICE_MATCH_BADGE,
  SALE,
  freeDeliveryBadge,
  nextDayOffered,
  saleLabel,
} from "@/config/funnel";
import { dayAfter, formatCutoffHour, formatDeliveryDay, nextDayDeadline, ukDayKey } from "@/lib/delivery-date";

/**
 * The one strip under the header: "30% off every bundle · Want it tomorrow?
 * Order within 02h 14m 33s and choose Next day · Free standard delivery over
 * £40".
 *
 * WHY ONE STRIP. There used to be two: this countdown on every page and the
 * home page's announcement bar directly under it, two bands of small print
 * stacked above the price, where the second read as more of the first. One
 * strip says the three things that move an order, in the order a shopper
 * weighs them: what it costs, how soon it comes, what delivery costs. The
 * price-match line goes to the hero, the trust bar and the buy bar, which
 * all carry it, and comes back here only when there is no countdown.
 *
 * WHY IT TURNS BLUE. While the sale shows, the strip is solid brand blue with
 * the offer in bold, so the first thing on any page says there is a sale.
 * Otherwise it is the header's neutral wash and hairline. Either way it is
 * one slim strip of 14px text; the page's one dark band is the footer.
 *
 * WHY "STANDARD". Next day is never free (over the threshold it costs the
 * difference), so beside the countdown the free-delivery line names the
 * service it covers. Without the word, the pair reads as free next day.
 *
 * WHY PARTS RENDER NOTHING. Each part is dropped when its source goes empty,
 * and the strip vanishes when all of them do. The countdown promises a
 * service, so it shows only where checkout can sell it (nextDayOffered).
 * While the delivery choice is off in live, the customer cannot pick Next
 * day, and a banner saying they can would be a misleading claim under the
 * CPUTR / DMCC Act.
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
 * imply it is. The countdown names the day the order actually arrives.
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

// Payment and the receipt are past the point of choosing a delivery, or a
// pack: nothing here would help, and the sale line would only distract.
const HIDDEN_ON = ["/checkout", "/order-confirmation"];

const cutoffLabel = formatCutoffHour();

// "Want it Wednesday?" when the next delivery is not tomorrow. The date
// beside it, for screen readers, is formatDeliveryDay, the same "Wed 7 Oct"
// checkout shows.
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

/**
 * `sale` comes from the server layout (saleVisible()), the same call that
 * prices the hero and the packs, so the strip can never announce a sale the
 * page below it is not showing.
 */
export function AnnouncementBanner({ sale }: { sale: boolean }) {
  const pathname = usePathname();
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSeconds);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const offer = sale ? SALE.bannerText || saleLabel() : ANNOUNCEMENT;
  const nextDay = nextDayOffered();
  const freeDelivery = freeDeliveryBadge({ standard: nextDay });
  if (!offer && !nextDay && !freeDelivery) return null;

  const at = now === null ? null : new Date(now * 1000);
  const deadline = nextDay && at ? nextDayDeadline(at) : null;
  const secondsLeft = deadline ? Math.max(0, Math.floor(deadline.cutoff.getTime() / 1000) - now!) : 0;
  const deliveryDate = deadline ? formatDeliveryDay(deadline.deliveryDayKey) : null;
  const when = !deadline
    ? null
    : deadline.deliveryDayKey === dayAfter(ukDayKey(at!))
      ? "tomorrow"
      : weekdayOf(deadline.deliveryDayKey);

  // Blue for the sale, the header's wash otherwise. `figure` is the tone the
  // clock and the van take: brand blue on the wash, white on the blue.
  const tone = sale
    ? { strip: "border-brand bg-brand text-white", soft: "text-white/85", sep: "text-white/60", figure: "text-white" }
    : { strip: "border-line bg-neutral text-ink", soft: "text-ink-soft", sep: "text-ink-soft", figure: "text-brand" };

  const offerText = sale ? <span className="font-bold">{offer}</span> : offer;

  // The line, in order. Later parts fall away first as the width narrows,
  // so a hidden part is never the first and never strands a separator.
  // Below md the countdown takes the fixed two-row layout instead. Without a
  // countdown a phone stacks the parts, one to a row with no separators: left
  // to wrap, the second row would open on a stray dot.
  const parts: { key: string; node: React.ReactNode; show: string }[] = [];
  if (offer) parts.push({ key: "offer", node: offerText, show: "flex" });
  if (nextDay) {
    parts.push({
      key: "next-day",
      show: "flex",
      node: (
        <span className="flex items-center gap-2">
          <VanMark className={tone.figure} />
          {deadline ? (
            <span>
              Want it {when}? Order within <Clock secondsLeft={secondsLeft} className={tone.figure} /> and choose
              Next day
            </span>
          ) : (
            <span>Next-day delivery, order by {cutoffLabel}</span>
          )}
        </span>
      ),
    });
  }
  if (freeDelivery) parts.push({ key: "delivery", node: freeDelivery, show: nextDay ? "hidden lg:flex" : "flex" });
  if (!nextDay && PRICE_MATCH_BADGE) parts.push({ key: "price-match", node: PRICE_MATCH_BADGE, show: "hidden sm:flex" });

  return (
    <section aria-label="Offers and delivery" className={`no-print border-b text-sm ${tone.strip}`}>
      {/* Phone, with a countdown: the offer and the instruction left, the
          clock right, on two fixed rows. A centred sentence wraps
          unpredictably on a 360px phone, and "Wednesday" is longer than
          "tomorrow". The server text and the ticking text fill the same rows,
          so hydration moves nothing. Free delivery is left to the hero and
          the trust bar here: three things on two short rows is one too many. */}
      {nextDay ? (
        <div className="shell-wide flex items-center justify-between gap-4 py-2 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            {offer ? null : <VanMark className={tone.figure} />}
            <div className="min-w-0">
              <p className={offer ? "" : "font-semibold"}>
                {offer ? offerText : deadline ? `Want it ${when}?` : "Next-day delivery"}
              </p>
              <p className={`text-xs ${tone.soft}`}>
                {/* "Want it tomorrow? Choose Next day" wraps to a third row
                    on a 360px phone; this says the same in fewer letters. */}
                {offer && deadline ? `Choose Next day for ${when}` : "Choose Next day at checkout"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-xs ${tone.soft}`}>{deadline ? "Order within" : "Order by"}</p>
            {deadline ? (
              <Clock secondsLeft={secondsLeft} className={tone.figure} />
            ) : (
              <p className={`font-semibold ${tone.figure}`}>{cutoffLabel}</p>
            )}
          </div>
        </div>
      ) : null}

      <ul
        className={[
          "shell-wide min-h-11 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 py-2 font-medium",
          nextDay ? "hidden md:flex" : "flex flex-col sm:flex-row",
        ].join(" ")}
      >
        {parts.map((part, i) => (
          // The conditional supplies the base display itself: two display
          // utilities on one element resolve by stylesheet order, not by the
          // order they are written here.
          <li key={part.key} className={`${part.show} items-center gap-3`}>
            {i > 0 ? (
              <span aria-hidden="true" className={`hidden sm:inline ${tone.sep}`}>
                &middot;
              </span>
            ) : null}
            {part.node}
          </li>
        ))}
      </ul>

      {deadline ? (
        <p className="sr-only">
          Order within {spokenDuration(secondsLeft)} and choose Next day at checkout for delivery{" "}
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
function Clock({ secondsLeft, className }: { secondsLeft: number; className: string }) {
  return (
    <span aria-hidden="true" className={`tabular inline-block font-bold ${className}`}>
      {clockFor(secondsLeft).map((p, i) => (
        <span key={p.unit}>
          {i > 0 ? " " : null}
          {p.value}
          <span className="font-semibold">{p.unit}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * The trust bar's delivery van at the same 1.6 stroke, so the banner draws
 * from the page's one set of marks rather than an icon library. It takes its
 * colour from `className`: brand blue on the wash, white on the sale blue.
 */
function VanMark({ className }: { className: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="M1.8 5.2h9.4v8.2H1.8z" />
      <path d="M11.2 8h3l3 2.6v2.8h-6z" />
      <circle cx="5.4" cy="15.4" r="1.7" />
      <circle cx="13.6" cy="15.4" r="1.7" />
    </svg>
  );
}
