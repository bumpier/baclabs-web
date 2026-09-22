import { shopWeekdayAndHour } from "@/lib/saleTime";

/**
 * When people buy: sales counted by hour of the day and day of the week, in
 * UK time, for the dashboard's busy-times chart. Bucketed on the server so the
 * chart shows UK hours whatever time zone the viewing browser is in.
 *
 * Counts, not revenue: order totals are in the customer's currency, so they
 * cannot be summed into one figure without converting them first.
 */

export const ACTIVITY_RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

export type ActivityRangeKey = (typeof ACTIVITY_RANGES)[number]["key"];

export interface SalesActivity {
  /** Sales in the range. */
  total: number;
  /** Sales per hour of the day, index 0–23. */
  byHour: number[];
  /** Sales per day and hour: grid[weekday][hour], weekday 0 = Monday. */
  grid: number[][];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function empty(): SalesActivity {
  return {
    total: 0,
    byHour: Array.from({ length: 24 }, () => 0),
    grid: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
  };
}

export function buildSalesActivity(
  saleTimes: Date[],
  now: Date
): Record<ActivityRangeKey, SalesActivity> {
  const out = Object.fromEntries(ACTIVITY_RANGES.map((r) => [r.key, empty()])) as Record<
    ActivityRangeKey,
    SalesActivity
  >;
  for (const t of saleTimes) {
    const { weekday, hour } = shopWeekdayAndHour(t);
    const age = now.getTime() - t.getTime();
    for (const r of ACTIVITY_RANGES) {
      if (r.days !== null && age > r.days * DAY_MS) continue;
      const a = out[r.key];
      a.total += 1;
      a.byHour[hour]! += 1;
      a.grid[weekday]![hour]! += 1;
    }
  }
  return out;
}
