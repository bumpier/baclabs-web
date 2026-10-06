import { SHOP_TIME_ZONE } from "@/lib/saleTime";

/**
 * When a next-day order arrives, in UK time.
 *
 * An order placed before the cutoff on a working day is dispatched that day;
 * after it, or on a weekend or bank holiday, it goes out on the next working
 * day. It arrives the working day after dispatch. "Working day" is Monday to
 * Friday, less England and Wales bank holidays, for dispatch and delivery
 * alike.
 *
 * Pure, and safe to import on the client: Intl only, no env, no server code.
 * Days are named by date, "2026-10-06", as lib/saleTime.ts names them.
 */

/** Orders placed before this hour, UK time, on a working day go out that day. */
export const NEXT_DAY_CUTOFF_HOUR = 15;

/**
 * England and Wales bank holidays, from gov.uk/bank-holidays.json. Add the
 * next year's when gov.uk publishes them: past the end of this list every
 * weekday counts as a working day.
 */
export const BANK_HOLIDAYS: readonly string[] = [
  "2026-12-25",
  "2026-12-28",
  "2027-01-01",
  "2027-03-26",
  "2027-03-29",
  "2027-05-03",
  "2027-05-31",
  "2027-08-30",
  "2027-12-27",
  "2027-12-28",
  "2028-01-03",
  "2028-04-14",
  "2028-04-17",
  "2028-05-01",
  "2028-05-29",
  "2028-08-28",
  "2028-12-25",
  "2028-12-26",
];

// Built once: constructing an Intl formatter is far slower than using one.
const wallFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** The clock on a UK wall at this moment, as if it were a UTC timestamp. */
function wallMs(d: Date): number {
  const p: Record<string, number> = {};
  for (const part of wallFmt.formatToParts(d)) p[part.type] = Number(part.value);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

/** The UK day a moment falls on: "2026-10-06". */
export function ukDayKey(d: Date): string {
  return new Date(wallMs(d)).toISOString().slice(0, 10);
}

/** The calendar day after this one. */
export function dayAfter(dayKey: string): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

export function isWorkingDay(dayKey: string): boolean {
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !BANK_HOLIDAYS.includes(dayKey);
}

function nextWorkingDay(dayKey: string): string {
  let day = dayAfter(dayKey);
  while (!isWorkingDay(day)) day = dayAfter(day);
  return day;
}

/**
 * The cutoff on a day, as a moment. The clocks change at 01:00 UTC, so the
 * UK offset at the cutoff hour read as UTC is the offset at the cutoff itself.
 */
function cutoffOn(dayKey: string): Date {
  const asUtc = Date.parse(`${dayKey}T${String(NEXT_DAY_CUTOFF_HOUR).padStart(2, "0")}:00:00Z`);
  return new Date(asUtc - (wallMs(new Date(asUtc)) - asUtc));
}

export interface NextDayDeadline {
  /** The next cutoff still ahead: the one an order placed now must beat. */
  cutoff: Date;
  /** The UK day an order placed now is dispatched. */
  dispatchDayKey: string;
  /** The UK day an order placed now arrives. */
  deliveryDayKey: string;
  /** Placed now, the order goes out today: a working day, before its cutoff. */
  dispatchedToday: boolean;
}

export function nextDayDeadline(now: Date): NextDayDeadline {
  const today = ukDayKey(now);
  const dispatchedToday = isWorkingDay(today) && now.getTime() < cutoffOn(today).getTime();
  const dispatchDayKey = dispatchedToday ? today : nextWorkingDay(today);
  return {
    cutoff: cutoffOn(dispatchDayKey),
    dispatchDayKey,
    deliveryDayKey: nextWorkingDay(dispatchDayKey),
    dispatchedToday,
  };
}

/** "Wed 7 Oct" */
export function formatDeliveryDay(dayKey: string): string {
  return dayFmt.format(new Date(`${dayKey}T12:00:00Z`)).replace(",", "");
}

/** "3pm" */
export function formatCutoffHour(hour = NEXT_DAY_CUTOFF_HOUR): string {
  return hour === 12 ? "12pm" : hour > 12 ? `${hour - 12}pm` : `${hour}am`;
}
