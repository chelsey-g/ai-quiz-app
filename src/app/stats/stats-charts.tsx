// src/app/stats/stats-charts.tsx
"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid oklch(0.5 0 0 / 0.2)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
};

export function StatsCharts({
  activityByWeek,
  accuracyByDay,
}: {
  activityByWeek: { week: string; count: number }[];
  accuracyByDay: { date: string; pct: number }[];
}) {
  const hasActivity = activityByWeek.some((w) => w.count > 0);
  const hasAccuracy = accuracyByDay.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Activity bar chart */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Sessions per week
        </p>
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={activityByWeek}
              margin={{ top: 0, right: 0, left: -24, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="oklch(0.5 0 0 / 0.08)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "oklch(0.5 0 0 / 0.05)" }}
              />
              <Bar dataKey="count" name="Sessions" fill="var(--dashboard-accent-teal)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground/40">No study sessions yet</p>
          </div>
        )}
      </div>

      {/* Accuracy line chart */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Accuracy (last 30 days)
        </p>
        {hasAccuracy ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={accuracyByDay}
              margin={{ top: 0, right: 0, left: -24, bottom: 0 }}
            >
              <CartesianGrid stroke="oklch(0.5 0 0 / 0.08)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(d: string) =>
                  new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "oklch(0.6 0 0 / 0.6)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${v}%`, "Accuracy"] as [string, string]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="var(--dashboard-accent-coral)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground/40">No data yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
