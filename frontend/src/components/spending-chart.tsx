/**
 * Spending Chart — bar + line chart of monthly spending.
 *
 * Uses Recharts ComposedChart for a dual bar/line visualisation.
 */
"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlySpending, YearlySpending } from "@/types/order";

interface SpendingChartProps {
  monthly: MonthlySpending[];
  yearly: YearlySpending[];
}

/** Format a "YYYY-MM" string as a short month label (e.g. "Jan 24"). */
function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("fr-CH", { month: "short", year: "2-digit" });
}

export function SpendingChart({ monthly, yearly }: SpendingChartProps) {
  const monthlyData = monthly.map((m) => ({
    name: formatMonth(m.month),
    total: m.total,
    commandes: m.count,
  }));

  const yearlyData = yearly.map((y) => ({
    name: y.year.toString(),
    total: y.total,
    commandes: y.count,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Monthly chart */}
      <Card className="col-span-1 md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Dépenses mensuelles (24 mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v} CHF`}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "total" ? [`${value.toFixed(2)} CHF`, "Total"] : [value, "Commandes"]
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="total"
                name="Total (CHF)"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="commandes"
                name="Commandes"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Yearly chart */}
      <Card className="col-span-1 md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Dépenses par année</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v} CHF`}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "total" ? [`${value.toFixed(2)} CHF`, "Total"] : [value, "Commandes"]
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="total"
                name="Total (CHF)"
                fill="hsl(var(--chart-3))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="commandes"
                name="Commandes"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
