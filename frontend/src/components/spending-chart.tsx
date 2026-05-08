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
import { useFormatter } from "@/lib/formatter-context";
import { useTranslations } from "next-intl";
import type { MonthlySpending, YearlySpending } from "@/types/order";

interface SpendingChartProps {
  monthly: MonthlySpending[];
  yearly: YearlySpending[];
}

export function SpendingChart({ monthly, yearly }: SpendingChartProps) {
  const { formatCHF, formatCHFAxis, formatDecimal, formatMonth } = useFormatter();
  const t = useTranslations("SpendingChart");
  const monthlyData = monthly.map((m) => ({
    name: formatMonth(m.month),
    total: m.total,
    orders: m.count,
  }));

  const yearlyData = yearly.map((y) => ({
    name: y.year.toString(),
    total: y.total,
    orders: y.count,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Monthly chart */}
      <Card className="col-span-1 md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">{t("monthlyTitle")}</CardTitle>
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
                width={90}
                tickFormatter={formatCHFAxis}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatDecimal} />
              <Tooltip
                formatter={(value, name) =>
                  name === t("legendTotal")
                    ? [formatCHF(Number(value)), t("tooltipTotal")]
                    : [formatDecimal(Number(value)), t("tooltipOrders")]
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="total"
                name={t("legendTotal")}
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name={t("legendOrders")}
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
          <CardTitle className="text-base">{t("yearlyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                width={90}
                tickFormatter={formatCHFAxis}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatDecimal} />
              <Tooltip
                formatter={(value, name) =>
                  name === t("legendTotal")
                    ? [formatCHF(Number(value)), t("tooltipTotal")]
                    : [formatDecimal(Number(value)), t("tooltipOrders")]
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="total"
                name={t("legendTotal")}
                fill="hsl(var(--chart-3))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name={t("legendOrders")}
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
