import type { Granularity } from "@/lib/finance/ledger";
import { daysInRange, parseDayKey, shiftDayKey } from "@/lib/saleTime";

/**
 * Which days /admin/finance shows: a preset, or from/to typed into the form.
 * Every range is a pair of UK days, both included, and never runs past today.
 */

export type PresetId = "7d" | "30d" | "this-month" | "last-month" | "90d" | "this-year";

export const PRESETS: readonly { id: PresetId; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "90d", label: "Last 90 days" },
  { id: "this-year", label: "This year" },
];

const DEFAULT_PRESET: PresetId = "30d";

/** The longest range shown: two years, which keeps the order query bounded. */
export const MAX_RANGE_DAYS = 731;

export interface DayRange {
  from: string;
  to: string;
}

export function presetRange(id: PresetId, today: string): DayRange {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (id) {
    case "7d":
      return { from: shiftDayKey(today, -6), to: today };
    case "30d":
      return { from: shiftDayKey(today, -29), to: today };
    case "90d":
      return { from: shiftDayKey(today, -89), to: today };
    case "this-month":
      return { from: monthStart, to: today };
    case "last-month": {
      const to = shiftDayKey(monthStart, -1);
      return { from: `${to.slice(0, 7)}-01`, to };
    }
    case "this-year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/**
 * The range a request asks for. A from/to pair wins over a preset; dates
 * typed the wrong way round are swapped, a future end becomes today, and a
 * range longer than MAX_RANGE_DAYS keeps its end and loses its start.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  today: string
): DayRange & { preset: PresetId | null } {
  let from = parseDayKey(params.from);
  let to = parseDayKey(params.to);
  if (from && to) {
    if (from > to) [from, to] = [to, from];
    if (to > today) to = today;
    if (from > today) from = today;
    if (daysInRange(from, to) > MAX_RANGE_DAYS) from = shiftDayKey(to, -(MAX_RANGE_DAYS - 1));
    const preset = PRESETS.find((p) => {
      const r = presetRange(p.id, today);
      return r.from === from && r.to === to;
    });
    return { from, to, preset: preset?.id ?? null };
  }
  const id = PRESETS.some((p) => p.id === params.range) ? (params.range as PresetId) : DEFAULT_PRESET;
  return { ...presetRange(id, today), preset: id };
}

/** The same number of days immediately before, for "vs previous period". */
export function previousRange({ from, to }: DayRange): DayRange {
  const days = daysInRange(from, to);
  return { from: shiftDayKey(from, -days), to: shiftDayKey(from, -1) };
}

/** Daily bars up to two months, then weekly, then monthly. */
export function granularityFor(days: number): Granularity {
  if (days <= 62) return "day";
  if (days <= 200) return "week";
  return "month";
}
