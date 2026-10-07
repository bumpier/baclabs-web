/**
 * When a sale happened, in UK time.
 *
 * The server runs in UTC (Docker on the VPS), so a bare toLocaleString() shows
 * a 21:30 sale in summer as 20:30. Every sale time — the order pages, the
 * owner's alert email, the dashboard's busy-times chart — goes through here,
 * so they all agree with the clock on the wall.
 */
export const SHOP_TIME_ZONE = "Europe/London";

/**
 * The moment of the sale: when payment confirmed. An order that has not been
 * paid falls back to when checkout began, so lists still have a time to show.
 */
export function saleTime(order: { paidAt: Date | null; createdAt: Date }): Date {
  return order.paidAt ?? order.createdAt;
}

// Built once: constructing an Intl formatter is far slower than using one.
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  day: "2-digit",
  month: "short",
});
const clockFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});

/** "Tue, 22 Sept 2026, 14:05" */
export function formatSaleDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}

/** "22 Sept" */
export function formatSaleDate(d: Date): string {
  return dateFmt.format(d);
}

/** "14:05" */
export function formatSaleClock(d: Date): string {
  return clockFmt.format(d);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Day of the week (0 = Monday) and hour (0–23) of a moment, in UK time. */
export function shopWeekdayAndHour(d: Date): { weekday: number; hour: number } {
  let weekday = 0;
  let hour = 0;
  for (const p of partsFmt.formatToParts(d)) {
    if (p.type === "weekday") weekday = WEEKDAYS.indexOf(p.value as (typeof WEEKDAYS)[number]);
    if (p.type === "hour") hour = Number(p.value);
  }
  return { weekday, hour };
}

// ── UK calendar days
//
// A day is named by its date, "2026-10-01", and runs from one UK midnight to
// the next: 23:00 UTC to 23:00 UTC in summer, and 23 or 25 hours long on the
// days the clocks change.

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
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** The clock on a UK wall at this moment, as if it were a UTC timestamp. */
function shopWallMs(d: Date): number {
  const p: Record<string, number> = {};
  for (const part of wallFmt.formatToParts(d)) p[part.type] = Number(part.value);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

const utcDayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The UK day a moment falls on: "2026-10-01". */
export function shopDayKey(d: Date): string {
  return utcDayKey(shopWallMs(d));
}

/** The moment a UK wall clock showed this time, given as if it were UTC. */
function fromShopWall(wall: number): Date {
  // UK time is ahead of UTC by (wall clock − UTC). Taken once at the UTC
  // guess and again at the answer, in case the clocks changed in between.
  const offsetAt = (ms: number) => shopWallMs(new Date(ms)) - ms;
  const guess = wall - offsetAt(wall);
  return new Date(wall - offsetAt(guess));
}

/** The UK midnight that starts a day. */
function shopMidnight(dayKey: string): Date {
  return fromShopWall(Date.parse(`${dayKey}T00:00:00Z`));
}

/**
 * A UK wall-clock time with no zone, "2026-10-07 14:05:00" (how SmartTrack
 * writes tracking events), as a moment. Null when it is not one.
 */
export function shopWallClockToDate(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s = 0] = m.slice(1).filter((v) => v !== undefined).map(Number) as number[];
  if (h! > 23 || mi! > 59 || s > 59) return null;
  const wall = Date.UTC(y!, mo! - 1, d!, h!, mi!, s);
  // Date.UTC rolls 31 September over into October rather than refusing it.
  const back = new Date(wall);
  if (back.getUTCMonth() !== mo! - 1 || back.getUTCDate() !== d!) return null;
  return fromShopWall(wall);
}

/** A UK day as a half-open range of moments: start ≤ t < end. */
export function shopDayBounds(dayKey: string): { start: Date; end: Date } {
  return { start: shopMidnight(dayKey), end: shopMidnight(shiftDayKey(dayKey, 1)) };
}

/** The day `days` after this one (negative for before). */
export function shiftDayKey(dayKey: string, days: number): string {
  return utcDayKey(Date.parse(`${dayKey}T00:00:00Z`) + days * 24 * 60 * 60 * 1000);
}

/** A day from a URL parameter, or null when it is not a real date. */
export function parseDayKey(raw: string | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const ms = Date.parse(`${raw}T00:00:00Z`);
  // Date.parse rolls 30 February over into March rather than refusing it.
  return Number.isNaN(ms) || utcDayKey(ms) !== raw ? null : raw;
}

/** "Thursday 1 October 2026" */
export function formatShopDay(dayKey: string): string {
  return dayFmt.format(new Date(`${dayKey}T12:00:00Z`)).replace(",", "");
}

// ── Ranges of UK days, for /admin/finance
//
// Days are grouped by their names, never by moments: "2026-10-25" is one day
// whatever the clocks did, so arithmetic on the name at UTC midnight is safe.

const DAY_MS = 24 * 60 * 60 * 1000;
const dayMs = (dayKey: string) => Date.parse(`${dayKey}T00:00:00Z`);

/** The days from `from` to `to`, both included, as one half-open range of moments. */
export function shopRangeBounds(from: string, to: string): { start: Date; end: Date } {
  return { start: shopDayBounds(from).start, end: shopDayBounds(to).end };
}

/** How many days from `from` to `to`, both included: 1 for a single day. */
export function daysInRange(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;
}

/** Every day from `from` to `to`, both included, earliest first. */
export function dayKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  for (let ms = dayMs(from); ms <= dayMs(to); ms += DAY_MS) keys.push(utcDayKey(ms));
  return keys;
}

/** The Monday that starts this day's week: "2026-10-05" for Wednesday 7 October. */
export function weekKey(dayKey: string): string {
  const weekday = (new Date(dayMs(dayKey)).getUTCDay() + 6) % 7; // 0 = Monday
  return shiftDayKey(dayKey, -weekday);
}

/** The month a day is in: "2026-10". */
export function monthKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

const shortDayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const monthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });

/** "Wed 7 Oct" */
export function formatShopDayShort(dayKey: string): string {
  return shortDayFmt.format(new Date(`${dayKey}T12:00:00Z`)).replace(",", "");
}

/** "Oct 2026", from "2026-10". */
export function formatMonth(month: string): string {
  return monthFmt.format(new Date(`${month}-15T12:00:00Z`));
}
