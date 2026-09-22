"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART, CHART_EMPTY, CHART_LINE, CHART_SEQUENTIAL } from "@/lib/theme";
import { ACTIVITY_RANGES, type ActivityRangeKey, type SalesActivity } from "@/lib/salesActivity";

/**
 * When people buy, for the dashboard: sales by hour of the day, and a
 * day-by-hour heatmap under it. All hours are UK time — the bucketing is done
 * on the server (lib/salesActivity.ts), so this only draws.
 */

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pad = (h: number) => String(h).padStart(2, "0");
const hourSpan = (h: number) => `${pad(h)}:00–${pad(h)}:59`;
const sales = (n: number) => `${n} ${n === 1 ? "sale" : "sales"}`;

/** Index of the largest value, or null when every value is zero. Ties go to the earlier index. */
function peakIndex(values: number[]): number | null {
  let best: number | null = null;
  values.forEach((v, i) => {
    if (v > 0 && (best === null || v > values[best]!)) best = i;
  });
  return best;
}

/** Heatmap fill: grey for none, then five steps of blue scaled to the busiest cell. */
function cellColour(count: number, max: number): string {
  if (count === 0 || max === 0) return CHART_EMPTY;
  const step = Math.ceil((count / max) * CHART_SEQUENTIAL.length) - 1;
  return CHART_SEQUENTIAL[Math.min(step, CHART_SEQUENTIAL.length - 1)]!;
}

function HourTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: { hour: number; count: number } }>;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold text-ink">{hourSpan(d.hour)}</p>
      <p className="mt-0.5 text-ink-soft">{sales(d.count)}</p>
    </div>
  );
}

export function SalesActivityChart({
  activity,
}: {
  activity: Record<ActivityRangeKey, SalesActivity>;
}) {
  const [range, setRange] = useState<ActivityRangeKey>("30d");
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null);

  const a = activity[range];
  const busiestHour = peakIndex(a.byHour);
  const byDay = a.grid.map((row) => row.reduce((s, n) => s + n, 0));
  const busiestDay = peakIndex(byDay);
  const cells = a.grid.flat();
  const maxCell = Math.max(0, ...cells);
  const busiestCell = peakIndex(cells);
  const hourData = a.byHour.map((count, hour) => ({ hour, label: pad(hour), count }));

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-medium text-brand-deep">When people buy</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Paid orders by the time the payment went through, in UK time.
          </p>
        </div>
        <div role="group" aria-label="Date range" className="flex flex-wrap gap-1.5">
          {ACTIVITY_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => {
                setRange(r.key);
                setHovered(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                range === r.key
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink-soft hover:border-brand"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {a.total === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">No sales in this period yet.</p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Busiest hour
              </dt>
              <dd className="mt-1 font-display text-xl font-medium text-brand-deep">
                {busiestHour === null ? "—" : hourSpan(busiestHour)}
              </dd>
              {busiestHour !== null && (
                <dd className="text-xs text-ink-soft">{sales(a.byHour[busiestHour]!)}</dd>
              )}
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Busiest day
              </dt>
              <dd className="mt-1 font-display text-xl font-medium text-brand-deep">
                {busiestDay === null ? "—" : DAYS[busiestDay]}
              </dd>
              {busiestDay !== null && (
                <dd className="text-xs text-ink-soft">{sales(byDay[busiestDay]!)}</dd>
              )}
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Sales
              </dt>
              <dd className="mt-1 font-display text-xl font-medium text-brand-deep">{a.total}</dd>
            </div>
          </dl>

          <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            By hour of the day
          </h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke={CHART_LINE} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<HourTooltip />} cursor={{ fill: CHART_EMPTY, opacity: 0.5 }} />
                <Bar dataKey="count" fill={CHART[0]} maxBarSize={24} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            By day and hour
          </h3>
          <div
            role="img"
            aria-label={
              busiestCell === null
                ? "Heatmap of sales by day and hour."
                : `Heatmap of sales by day and hour. Busiest: ${DAYS[Math.floor(busiestCell / 24)]} ${hourSpan(busiestCell % 24)}, ${sales(maxCell)}.`
            }
            className="mt-3 grid gap-[2px]"
            style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }}
            onPointerLeave={() => setHovered(null)}
          >
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center text-[10px] leading-4 text-ink-soft">
                {h % 3 === 0 ? pad(h) : ""}
              </span>
            ))}
            {a.grid.map((row, day) => (
              <div key={day} className="contents">
                <span className="self-center pr-1 text-[11px] leading-none text-ink-soft">
                  {DAYS[day]!.slice(0, 3)}
                </span>
                {row.map((n, hour) => {
                  const on = hovered?.day === day && hovered.hour === hour;
                  return (
                    <span
                      key={hour}
                      onPointerEnter={() => setHovered({ day, hour })}
                      onPointerDown={() => setHovered({ day, hour })}
                      className={`h-3.5 rounded-[3px] sm:h-6 ${on ? "ring-2 ring-ink ring-offset-1" : ""}`}
                      style={{ backgroundColor: cellColour(n, maxCell) }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
            <p aria-live="polite" className="min-h-4">
              {hovered
                ? `${DAYS[hovered.day]} ${hourSpan(hovered.hour)} · ${sales(a.grid[hovered.day]![hovered.hour]!)}`
                : "Point at a square to see its count."}
            </p>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span>None</span>
              <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: CHART_EMPTY }} />
              <span className="ml-2">Fewer</span>
              {CHART_SEQUENTIAL.map((c) => (
                <span key={c} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: c }} />
              ))}
              <span>More</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
