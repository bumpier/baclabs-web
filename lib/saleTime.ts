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
