"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TodayChartDatum = { name: string; value: number };

/**
 * Knowledge-growth bar chart.
 * Split out of the Today page so the recharts/d3 vendor chunk is fetched
 * lazily instead of blocking the first paint of the post-login landing route.
 */
export default function TodayChart({ data }: { data: TodayChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--text-3)", fontSize: 12 }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--text-3)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--signal-dim)" }}
          contentStyle={{
            background: "var(--bg-2)",
            border: "1px solid var(--line-strong)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--text-1)",
          }}
          labelStyle={{ color: "var(--text-2)" }}
        />
        <Bar dataKey="value" fill="var(--signal)" radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}
