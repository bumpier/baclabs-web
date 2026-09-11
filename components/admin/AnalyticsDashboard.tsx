"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART, CHART_LINE } from "@/lib/theme";

/**
 * Series colour comes from lib/theme.ts, not from literals here.
 *
 * This file used to hard-code `#121271` and `#3ec7ed` — a blue that matches
 * nothing in the current system, and the cyan the palette explicitly retired
 * for measuring 1.82:1. Recharts cannot read a CSS variable, so the values
 * still have to be strings; they just have to be the RIGHT strings, from the
 * one place that owns them.
 */
const COLORS = CHART;

export interface DailyRevenue {
  date: string;
  revenue: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ProductCount {
  name: string;
  count: number;
}

export interface PaymentMethod {
  name: string;
  value: number;
}

interface Props {
  dailyRevenue: DailyRevenue[];
  statusCounts: StatusCount[];
  topProducts: ProductCount[];
  paymentMethods: PaymentMethod[];
  totalRevenueGbp: number;
  totalOrders: number;
}

export default function AnalyticsDashboard({
  dailyRevenue,
  statusCounts,
  topProducts,
  paymentMethods,
  totalRevenueGbp,
  totalOrders,
}: Props) {
  const paidCount = statusCounts.find((s) => s.status === "paid")?.count ?? 0;
  const shippedCount = statusCounts.find((s) => s.status === "shipped")?.count ?? 0;

  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Total Revenue
          </p>
          <p className="mt-2 font-display text-3xl font-medium text-brand-deep">
            £ {totalRevenueGbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Total Orders
          </p>
          <p className="mt-2 font-display text-3xl font-medium text-brand-deep">
            {totalOrders}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Awaiting Fulfilment
          </p>
          <p className="mt-2 font-display text-3xl font-medium text-brand-deep">{paidCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Shipped
          </p>
          <p className="mt-2 font-display text-3xl font-medium text-brand-deep">{shippedCount}</p>
        </div>
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue chart — 2 cols */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-medium text-brand-deep">
            Revenue — last 30 days (GBP)
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyRevenue}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_LINE} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: unknown) => [`£${Number(v).toFixed(0)}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART[0]}
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by status */}
        <div className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">
            Orders by status
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_LINE} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="status"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={68}
                />
                <Tooltip />
                <Bar dataKey="count" fill={CHART[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top products */}
        <div className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">
            Top products (units)
          </h2>
          <div className="mt-4 h-48">
            {topProducts.length === 0 ? (
              <p className="text-sm text-ink-soft">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_LINE} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10 }}
                    width={90}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART[1]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment methods */}
        <div className="card p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">
            Payment methods
          </h2>
          <div className="mt-4 h-48">
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-ink-soft">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {paymentMethods.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
