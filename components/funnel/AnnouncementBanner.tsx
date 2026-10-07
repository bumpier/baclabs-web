"use client";

import { Fragment, useSyncExternalStore } from "react";
import Link from "next/link";
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
 * The promotion band under the header: the offer, the next-day countdown,
 * free delivery and a way to buy, in one place.
 *
 *   30% off   every bundle             Want it tomorrow?          [02]:[31]:[27]   [ Shop the sale → ]
 *             Free next-day delivery   Choose Next day and order   hrs  min  sec
 *
 * WHY IT IS BIG. It is the page's one promotion, so it is built to be seen:
 * the offer in the display face at 40px, the clock in white tiles, and its
 * own button, which on a phone is the only buy button above the fold (the
 * header's is hidden there). It stays inside the house system all the same.
 * Brand blue rather than a dark band (the page's one dark band is the
 * footer), flat white tiles rather than glowing ones, and nothing that moves
 * but the clock itself. A dark, glowing, pulsing countdown band was tried
 * first and rejected as off-brand.
 *
 * WHY ONE BAND. There used to be two: a countdown strip on every page and the
 * home page's announcement bar under it, two bands of small print stacked
 * above the price. One band says the things that move an order in the order
 * a shopper weighs them: what it costs, how soon it comes, what delivery
 * costs. The price-match line goes to the hero, the trust bar and the buy
 * bar, which all carry it, and comes back here only when there is no
 * countdown.
 *
 * WHY "NEXT-DAY". Over the threshold the only option is next day, free, so
 * beside the countdown the free-delivery line names it: "Free next-day
 * delivery over £40" is the stronger offer and says which service is free.
 *
 * WHY PARTS RENDER NOTHING. Each part is dropped when its source goes empty,
 * and the band vanishes when all of them do. The countdown promises a
 * service, so it shows only where checkout can sell it (nextDayOffered).
 * While the delivery choice is off in live, the customer cannot pick Next
 * day, and a banner saying they can would be a misleading claim under the
 * CPUTR / DMCC Act. For the same reason there is no "sale ends" clock: the
 * sale has no end date, and inventing one would be fake urgency.
 *
 * WHY THE CLOCK IS CLIENT-ONLY. Storefront pages are cached for five minutes
 * (app/(store)/layout.tsx), so a countdown rendered on the server would be
 * up to five minutes wrong before it ever reached the screen. The server and
 * the no-JS page get the timeless "order by [3pm]" in a tile of the same
 * height, and the ticking tiles replace it after hydration with nothing
 * below them moving.
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

// Payment and the receipt are past the point of choosing a delivery, or a
// pack: nothing here would help, and the band would only distract.
const HIDDEN_ON = ["/checkout", "/order-confirmation"];

const cutoffLabel = formatCutoffHour();

// "Want it Wednesday?" when the next delivery is not tomorrow. The date
// beside it, for screen readers, is formatDeliveryDay, the same "Wed 7 Oct"
// checkout shows.
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" });
const weekdayOf = (dayKey: string) => weekdayFmt.format(new Date(`${dayKey}T12:00:00Z`));

const pad = (n: number) => String(n).padStart(2, "0");

type Tile = { value: string; unit: string };

/**
 * The clock's tiles, [03] hrs [17] min [44] sec. Under a day: hours,
 * minutes, seconds. A day or more out (a Friday evening, a bank-holiday
 * weekend): days, hours, minutes, since a seconds hand 60 hours from the
 * deadline is noise, not urgency.
 */
function tilesFor(secondsLeft: number): Tile[] {
  const days = Math.floor(secondsLeft / 86_400);
  const hours = Math.floor((secondsLeft % 86_400) / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  if (days > 0) {
    return [
      { value: String(days), unit: days === 1 ? "day" : "days" },
      { value: pad(hours), unit: "hrs" },
      { value: pad(mins), unit: "min" },
    ];
  }
  return [
    { value: pad(hours), unit: "hrs" },
    { value: pad(mins), unit: "min" },
    { value: pad(secs), unit: "sec" },
  ];
}

// Before hydration, and without JavaScript: the cutoff itself, in one tile.
const serverTiles: Tile[] = [{ value: cutoffLabel, unit: "cutoff" }];

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
 * prices the hero and the packs, so the band can never announce a sale the
 * page below it is not showing.
 */
export function AnnouncementBanner({ sale }: { sale: boolean }) {
  const pathname = usePathname();
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSeconds);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const offer = sale ? SALE.bannerText || saleLabel() : ANNOUNCEMENT;
  const nextDay = nextDayOffered();
  const perks = [freeDeliveryBadge({ named: nextDay }), nextDay ? "" : PRICE_MATCH_BADGE].filter(Boolean);
  if (!offer && !nextDay && perks.length === 0) return null;

  const at = now === null ? null : new Date(now * 1000);
  const deadline = nextDay && at ? nextDayDeadline(at) : null;
  const secondsLeft = deadline ? Math.max(0, Math.floor(deadline.cutoff.getTime() / 1000) - now!) : 0;
  const deliveryDate = deadline ? formatDeliveryDay(deadline.deliveryDayKey) : null;
  const when = !deadline
    ? null
    : deadline.deliveryDayKey === dayAfter(ukDayKey(at!))
      ? "tomorrow"
      : weekdayOf(deadline.deliveryDayKey);
  const tiles = deadline ? tilesFor(secondsLeft) : serverTiles;
  const headline = deadline ? `Want it ${when}?` : "Next-day delivery";

  // "30% off" set large and "every bundle" beside it, when the banner text
  // opens with the sale label as it does by default. Any other wording is
  // shown whole at the smaller size rather than split somewhere arbitrary.
  const label = saleLabel();
  const big = sale && offer.startsWith(label) ? label : "";
  const rest = big ? offer.slice(label.length).trim() : offer;

  // On a pack page the button goes to that page's own buy panel; everywhere
  // else to the chooser on the home page, as the header's button does.
  const ctaHref = pathname.startsWith("/products/") ? "#buy" : "/#buy";
  const cta = sale ? "Shop the sale" : "Shop now";

  // The lead: the offer, or with no offer the next-day headline, or with
  // neither the perks themselves.
  const leadTitle = offer ? rest : nextDay ? headline : perks[0];
  const leadPerks = offer || nextDay ? perks : perks.slice(1);

  return (
    <section aria-label="Offers and delivery" className="no-print bg-brand text-white">
      {/* lg and up: lead, countdown and button on one row. All three need
          about 1,100px, so from lg to xl the button gives way: the header's
          own "Buy now" is on screen at those widths. Without a countdown
          there is room, and the button stays. */}
      <div className="shell-wide hidden min-h-[5.75rem] items-center justify-between gap-8 py-4 lg:flex">
        <div className="flex min-w-0 items-center gap-4">
          {big ? <BigFigure className="text-[2.75rem]">{big}</BigFigure> : !offer && nextDay ? <VanMark size={30} /> : null}
          <div className="whitespace-nowrap">
            <p className="font-display text-xl font-bold leading-tight">{leadTitle}</p>
            {leadPerks.length > 0 ? <p className="mt-0.5 text-sm text-white/85">{leadPerks.join(" · ")}</p> : null}
          </div>
        </div>

        {nextDay ? (
          <div className="flex shrink-0 items-center gap-5 border-l border-white/25 pl-8">
            <div className="whitespace-nowrap text-right">
              {offer ? <p className="text-base font-semibold">{headline}</p> : null}
              <p className="text-sm text-white/85">
                Choose Next day and order {deadline ? "within" : "by"}
              </p>
            </div>
            <Tiles tiles={tiles} size="lg" />
          </div>
        ) : null}

        <CtaLink
          href={ctaHref}
          className={`${nextDay ? "hidden xl:inline-flex" : "inline-flex"} min-h-[50px] px-6 text-base`}
        >
          {cta}
        </CtaLink>
      </div>

      {/* Below lg: the lead and the button on top, the countdown under a
          hairline. Free delivery is left to the hero and the trust bar while
          the countdown shows: three things in a phone's width is one too
          many. Held to max-w-xl so a tablet does not spread it edge to edge. */}
      <div className="shell-wide py-3.5 lg:hidden">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {big ? null : !offer && nextDay ? <VanMark size={24} /> : null}
              <div className="min-w-0">
                {big ? <BigFigure className="block text-[2.125rem]">{big}</BigFigure> : null}
                <p className={big ? "font-display text-base font-bold leading-tight" : "font-display text-lg font-bold leading-tight"}>
                  {leadTitle}
                </p>
              </div>
            </div>
            <CtaLink href={ctaHref} className="inline-flex min-h-[44px] px-4 text-sm">
              {cta}
            </CtaLink>
          </div>

          {nextDay ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/25 pt-3">
              <div className="min-w-0">
                {offer ? <p className="text-sm font-semibold">{headline}</p> : null}
                <p className="text-xs text-white/85">
                  Choose Next day<span className="hidden sm:inline"> at checkout</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-white/85">
                  Order {deadline ? "within" : "by"}
                </p>
                <Tiles tiles={tiles} size="sm" />
              </div>
            </div>
          ) : leadPerks.length > 0 ? (
            <ul className="mt-3 flex flex-col items-center gap-0.5 border-t border-white/25 pt-3 text-sm text-white/85 sm:flex-row sm:justify-center sm:gap-3">
              {leadPerks.map((perk, i) => (
                <li key={perk} className={i > 0 ? "hidden sm:flex sm:items-center sm:gap-3" : "flex"}>
                  {i > 0 ? (
                    <span aria-hidden="true" className="text-white/60">
                      &middot;
                    </span>
                  ) : null}
                  {perk}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {deadline ? (
        <p className="sr-only">
          Order within {spokenDuration(secondsLeft)} and choose Next day at checkout for delivery{" "}
          {when === "tomorrow" ? `tomorrow, ${deliveryDate}` : `on ${deliveryDate}`}.
        </p>
      ) : nextDay ? (
        <p className="sr-only">Next-day delivery: order by {cutoffLabel} and choose Next day at checkout.</p>
      ) : null}
    </section>
  );
}

/** The offer's figure, "30% off", in the display face. */
function BigFigure({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`shrink-0 font-display font-bold leading-none tracking-tight ${className}`}>{children}</span>
  );
}

/**
 * The clock as white tiles, hidden from screen readers, which get the
 * sentence at the foot of the band instead: a region that changed every
 * second would be either silent or unbearable. Fixed tile heights, and
 * `.tabular` so the digits hold their places rather than shuffling sideways
 * every second.
 */
function Tiles({ tiles, size }: { tiles: Tile[]; size: "lg" | "sm" }) {
  const tile =
    size === "lg"
      ? "h-12 min-w-[3.25rem] px-2 text-[1.75rem]"
      : "h-9 min-w-[2.375rem] px-1.5 text-xl";
  const colon = size === "lg" ? "h-12 text-2xl" : "h-9 text-lg";
  return (
    <div aria-hidden="true" className="flex items-start gap-1">
      {tiles.map((t, i) => (
        <Fragment key={t.unit}>
          {i > 0 ? <span className={`flex items-center font-display font-bold text-white/60 ${colon}`}>:</span> : null}
          <span className="flex flex-col items-center">
            <span
              className={`tabular flex items-center justify-center rounded-control bg-white font-display font-bold leading-none text-brand ${tile}`}
            >
              {t.value}
            </span>
            <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-wide text-white/85">{t.unit}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * White on the blue band: the inverse of .btn-cta, at its radius. The caller
 * supplies the display (`inline-flex`, or `hidden xl:inline-flex`): two
 * display utilities on one element resolve by stylesheet order, not by the
 * order they are written.
 */
function CtaLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 items-center justify-center gap-2 rounded-control bg-white font-semibold text-brand transition-colors duration-150 hover:bg-brand-tint active:scale-[0.985] ${className}`}
    >
      {children}
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />
      </svg>
    </Link>
  );
}

/**
 * The trust bar's delivery van at the same 1.6 stroke, so the band draws
 * from the page's one set of marks rather than an icon library.
 */
function VanMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
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
