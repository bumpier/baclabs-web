"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, CHART_LINE } from "@/lib/theme";

/**
 * The two charts on /admin/finance. Amounts arrive in pounds, already added
 * up per day, week or month by lib/finance/ledger.ts; series colours come
 * from lib/theme.ts, because Recharts cannot read a CSS variable.
 */

export interface FinancePoint {
  label: string;
  goods: number;
  delivery: number;
  afterCosts: number;
  postage: number;
  fulfilment: number;
}

const pounds = (v: unknown) =>
  `£${Number(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const axisPounds = (v: unknown) => `£${Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

function Key({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={i.line ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-sm"}
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Frame({ data, children }: { data: FinancePoint[]; children: React.ReactNode }) {
  return (
    <div className="mt-4 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_LINE} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={axisPounds} width={56} />
          <ReferenceLine y={0} stroke={CHART_LINE} />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Takings split into goods and delivery, with what is left after shipping costs. */
export function TakingsChart({ data }: { data: FinancePoint[] }) {
  return (
    <>
      <Frame data={data}>
        <Tooltip formatter={(v: unknown, name: unknown) => [pounds(v), String(name)]} />
        <Bar dataKey="goods" name="Order value" stackId="taken" fill={CHART[0]} />
        <Bar dataKey="delivery" name="Delivery" stackId="taken" fill={CHART[1]} radius={[3, 3, 0, 0]} />
        <Line
          dataKey="afterCosts"
          name="After shipping costs"
          type="monotone"
          stroke={CHART[3]}
          strokeWidth={2}
          dot={false}
        />
      </Frame>
      <Key
        items={[
          { label: "Order value excl. delivery", color: CHART[0] },
          { label: "Delivery charged", color: CHART[1] },
          { label: "After shipping costs", color: CHART[3], line: true },
        ]}
      />
    </>
  );
}

/** What customers paid for delivery against what sending it cost. */
export function ShippingChart({ data }: { data: FinancePoint[] }) {
  return (
    <>
      <Frame data={data}>
        <Tooltip formatter={(v: unknown, name: unknown) => [pounds(v), String(name)]} />
        <Bar dataKey="delivery" name="Delivery charged" fill={CHART[1]} radius={[3, 3, 0, 0]} />
        <Bar dataKey="postage" name="Postage paid" stackId="cost" fill={CHART[2]} />
        <Bar dataKey="fulfilment" name="Fulfilment" stackId="cost" fill={CHART[4]} radius={[3, 3, 0, 0]} />
      </Frame>
      <Key
        items={[
          { label: "Delivery charged", color: CHART[1] },
          { label: "Postage paid", color: CHART[2] },
          { label: "Fulfilment", color: CHART[4] },
        ]}
      />
    </>
  );
}
